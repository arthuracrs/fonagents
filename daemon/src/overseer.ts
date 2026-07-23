import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface OverseerConfig {
  enabled: boolean
  mode: 'queue' | 'batch'
  debounceMs: number
  maxConcurrent: number
  timeoutSec: number
}

export interface OverseerHandle {
  id: string
  sessionName: string
  status: 'running' | 'completed' | 'failed' | 'timed_out'
  startedAt: number
  finishedAt?: number
}

interface QueuedEvent {
  type: 'done' | 'failed'
  issueId: string
  workerId: string
}

export class Overseer {
  private queue: QueuedEvent[] = []
  private active: Map<string, OverseerHandle> = new Map()
  private debounceTimer: NodeJS.Timeout | null = null
  private isProcessing = false
  private listener: ((event: any) => void) | null = null

  constructor(
    private eventBus: EventEmitter,
    private config: OverseerConfig,
    private projectDir: string,
  ) {}

  start(): void {
    this.listener = (event: any) => {
      if (event.type === 'worker_status') {
        this.handleWorkerEvent(event)
      }
    }
    this.eventBus.addListener('ui-event', this.listener)

    if (this.config.enabled) {
      console.log(`Overseer: started (mode=${this.config.mode}, maxConcurrent=${this.config.maxConcurrent})`)
    } else {
      console.log('Overseer: disabled')
    }
  }

  stop(): void {
    if (this.listener) {
      this.eventBus.removeListener('ui-event', this.listener)
      this.listener = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    for (const handle of this.active.values()) {
      execFile('tmux', ['kill-session', '-t', handle.sessionName], () => {})
    }
    this.active.clear()
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    this.persistConfig()
    console.log(`Overseer: ${enabled ? 'enabled' : 'disabled'}`)
  }

  getConfig(): OverseerConfig {
    return { ...this.config }
  }

  getStatus(): { config: OverseerConfig; activeOverseers: number; queueLength: number } {
    return {
      config: { ...this.config },
      activeOverseers: this.active.size,
      queueLength: this.queue.length,
    }
  }

  private persistConfig(): void {
    const configPath = path.join(this.projectDir, '.fonagents', 'overseer.json')
    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf8')
    } catch (err) {
      console.error('Overseer: failed to persist config:', err)
    }
  }

  private handleWorkerEvent(event: any): void {
    const { workerId, status } = event
    if (status !== 'completed' && status !== 'failed') return

    const queued: QueuedEvent = {
      type: status === 'completed' ? 'done' : 'failed',
      issueId: event.issueId || '',
      workerId,
    }

    if (this.config.mode === 'queue') {
      this.enqueue(queued)
    } else {
      this.batch(queued)
    }
  }

  // ── Queue mode ───────────────────────────────────────────────────────────────

  private enqueue(event: QueuedEvent): void {
    this.queue.push(event)
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    if (this.queue.length === 0) return
    if (this.active.size >= this.config.maxConcurrent) return

    this.isProcessing = true
    const event = this.queue.shift()!
    await this.runOverseer([event])
  }

  // ── Batch mode ───────────────────────────────────────────────────────────────

  private batch(event: QueuedEvent): void {
    this.queue.push(event)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.processBatch()
    }, this.config.debounceMs)
  }

  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return
    if (this.active.size >= this.config.maxConcurrent) return

    const events = [...this.queue]
    this.queue = []
    await this.runOverseer(events)
  }

  // ── Overseer spawning ────────────────────────────────────────────────────────

  private async runOverseer(events: QueuedEvent[]): Promise<void> {
    const completedIssues = events.filter(e => e.type === 'done').map(e => e.issueId).filter(Boolean)
    const failedIssues = events.filter(e => e.type === 'failed').map(e => e.issueId).filter(Boolean)

    const promptParts: string[] = []
    if (completedIssues.length > 0) {
      promptParts.push(`Workers for these issues just completed: ${completedIssues.join(', ')}`)
    }
    if (failedIssues.length > 0) {
      promptParts.push(`Workers for these issues failed: ${failedIssues.join(', ')}`)
    }
    promptParts.push('', 'Review the board state and dispatch ready work.')
    const prompt = promptParts.join('\n')

    const id = crypto.randomBytes(6).toString('hex')
    const sessionName = `overseer-${id}`

    try {
      await execFileAsync('tmux', [
        'new-session', '-d', '-s', sessionName,
        '-x', '220', '-y', '50',
        '-c', this.projectDir,
        'opencode', '--agent', 'fonagents-overseer', '--prompt', prompt,
      ])

      await execFileAsync('tmux', [
        'set-option', '-t', sessionName, 'remain-on-exit', 'on',
      ]).catch(() => {})

      const handle: OverseerHandle = {
        id,
        sessionName,
        status: 'running',
        startedAt: Date.now(),
      }

      this.active.set(id, handle)
      console.log(`Overseer: spawned ${sessionName} for ${events.length} event(s)`)

      this.pollOverseer(handle).catch((err) => {
        console.error(`Overseer: ${sessionName} polling error:`, err)
        this.active.delete(id)
        this.onOverseerDone()
      })
    } catch (err) {
      console.error(`Overseer: failed to spawn ${sessionName}:`, err)
      this.onOverseerDone()
    }
  }

  private async pollOverseer(handle: OverseerHandle): Promise<void> {
    const deadline = Date.now() + this.config.timeoutSec * 1000

    while (Date.now() < deadline) {
      await sleep(5000)

      try {
        const { stdout } = await execFileAsync('tmux', [
          'display-message', '-p', '-t', handle.sessionName,
          '#{pane_dead}:#{pane_dead_status}',
        ])
        const [dead, statusStr] = stdout.trim().split(':')

        if (dead === '1') {
          handle.status = 'completed'
          handle.finishedAt = Date.now()
          this.active.delete(handle.id)
          console.log(`Overseer: ${handle.sessionName} exited (code: ${statusStr})`)
          this.onOverseerDone()
          return
        }
      } catch {
        handle.status = 'completed'
        handle.finishedAt = Date.now()
        this.active.delete(handle.id)
        console.log(`Overseer: ${handle.sessionName} session gone`)
        this.onOverseerDone()
        return
      }
    }

    handle.status = 'timed_out'
    handle.finishedAt = Date.now()
    console.log(`Overseer: ${handle.sessionName} timed out after ${this.config.timeoutSec}s`)
    await execFileAsync('tmux', ['kill-session', '-t', handle.sessionName]).catch(() => {})
    this.active.delete(handle.id)
    this.onOverseerDone()
  }

  private onOverseerDone(): void {
    if (this.config.mode === 'queue') {
      this.isProcessing = false
      this.processQueue()
    }
    if (this.config.mode === 'batch' && this.queue.length > 0) {
      this.processBatch()
    }
  }
}
