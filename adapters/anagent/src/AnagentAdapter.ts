import { spawn, execFile, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import type {
  AgentRuntimePort,
  AgentStreamEvent,
  ExecMode,
  IssueId,
  RuntimeInfo,
  SpawnWorkerInput,
  WorkerHandle,
  WorkerId,
} from '@fonagents/core'
import { translateEvent, parseNdjsonLine, type AnagentEvent } from './protocol.js'

export interface AnagentAdapterConfig {
  anagentPath?: string
  cwd: string
}

export class AnagentAdapter implements AgentRuntimePort {
  private readonly workers = new Map<WorkerId, WorkerHandle & { process?: ChildProcess }>()
  private readonly listeners = new Map<WorkerId, Set<(event: AgentStreamEvent) => void>>()
  private readonly bin: string
  private readonly binArgs: string[]
  private readonly cwd: string

  constructor(config: AnagentAdapterConfig) {
    const resolved = resolveAnagent(config.anagentPath)
    this.bin = resolved.bin
    this.binArgs = resolved.prefixArgs
    this.cwd = config.cwd
  }

  // ── Runtimes ────────────────────────────────────────────────────────────────

  async listRuntimes(): Promise<RuntimeInfo[]> {
    return new Promise((resolve, reject) => {
      const args = [...this.binArgs, 'runtimes', '--json']
      const proc = spawn(this.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout) as { id: string; name: string; description: string; defaultMode: string }[]
            resolve(parsed.map((r) => ({
              id: r.id,
              name: r.name,
              description: r.description,
              defaultMode: r.defaultMode as ExecMode,
            })))
          } catch (e) {
            reject(new Error(`Failed to parse anagent runtimes: ${(e as Error).message}`))
          }
        } else {
          reject(new Error(`anagent runtimes exited ${code}: ${stderr.slice(0, 200)}`))
        }
      })
      proc.on('error', reject)
    })
  }

  // ── Workers ──────────────────────────────────────────────────────────────────

  async spawnWorker(input: SpawnWorkerInput): Promise<WorkerHandle> {
    const id = genId()
    const mode = input.mode ?? 'headless'
    const handle: WorkerHandle & { process?: ChildProcess } = {
      id,
      issueId: input.issueId,
      runtimeId: input.runtimeId,
      mode,
      status: 'running',
      startedAt: new Date().toISOString(),
    }
    this.workers.set(id, handle)

    const args = [
      ...this.binArgs,
      'run', input.prompt,
      '--stream',
      '--runtime', input.runtimeId,
      '--mode', mode,
      '--system-prompt', input.systemPrompt,
      '--cwd', input.cwd ?? this.cwd,
    ]

    const proc = spawn(this.bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: input.cwd ?? this.cwd,
    })
    handle.process = proc

    this.pipeEvents(id, proc)

    let streamEmittedTerminal = false
    const tracker = this.subscribeWorker(id, (event) => {
      if (event.type === 'done' || event.type === 'failed') streamEmittedTerminal = true
    })

    proc.on('close', (code) => {
      handle.exitCode = code ?? undefined
      handle.status = code === 0 ? 'completed' : (code === null ? 'cancelled' : 'failed')
      handle.finishedAt = new Date().toISOString()
      delete handle.process

      if (!streamEmittedTerminal) {
        const synthetic: AgentStreamEvent = code === 0
          ? { type: 'done', exitCode: 0, durationMs: 0 }
          : { type: 'failed', error: `Worker exited with code ${code ?? -1}`, exitCode: code ?? -1, durationMs: 0 }
        this.notify(id, synthetic)
      }
      tracker.unsubscribe()
    })

    proc.on('error', (err) => {
      handle.status = 'failed'
      handle.finishedAt = new Date().toISOString()
      this.notify(id, { type: 'failed', error: err.message, exitCode: -1, durationMs: 0 })
    })

    return handle
  }

  cancelWorker(workerId: WorkerId): Promise<boolean> {
    const worker = this.workers.get(workerId)
    if (!worker) return Promise.resolve(false)
    if (worker.process) {
      worker.process.kill('SIGTERM')
      delete worker.process
    }
    if (worker.status === 'running') {
      worker.status = 'cancelled'
      worker.finishedAt = new Date().toISOString()
    }
    if (worker.tmuxSession) {
      killTmuxSession(worker.tmuxSession).catch(() => {})
    }
    return Promise.resolve(true)
  }

  subscribeWorker(workerId: WorkerId, cb: (event: AgentStreamEvent) => void): { unsubscribe(): void } {
    if (!this.listeners.has(workerId)) this.listeners.set(workerId, new Set())
    this.listeners.get(workerId)!.add(cb)
    return { unsubscribe: () => this.listeners.get(workerId)?.delete(cb) }
  }

  getWorker(workerId: WorkerId): WorkerHandle | undefined {
    const w = this.workers.get(workerId)
    return w ? { ...w } : undefined
  }

  getWorkersForIssue(issueId: IssueId): WorkerHandle[] {
    return Array.from(this.workers.values())
      .filter((w) => w.issueId === issueId)
      .map((w) => ({ ...w }))
  }

  listWorkers(): WorkerHandle[] {
    return Array.from(this.workers.values()).map((w) => ({ ...w }))
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private pipeEvents(workerId: WorkerId, proc: ChildProcess): void {
    let buf = ''
    proc.stdout?.on('data', (data: Buffer) => {
      buf += data.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const raw = parseNdjsonLine(line)
        if (!raw) continue
        if (raw.type === 'start' && raw.tmuxSession) {
          const worker = this.workers.get(workerId)
          if (worker) worker.tmuxSession = raw.tmuxSession
        }
        const translated = translateEvent(raw)
        if (translated) this.notify(workerId, translated)
      }
    })
    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString().trim()
      if (chunk) this.notify(workerId, { type: 'text', delta: chunk })
    })
  }

  private notify(workerId: WorkerId, event: AgentStreamEvent): void {
    const subs = this.listeners.get(workerId)
    if (!subs) return
    for (const cb of subs) cb(event)
  }
}

// ── Anagent binary resolution ─────────────────────────────────────────────────

function resolveAnagent(override?: string): { bin: string; prefixArgs: string[] } {
  if (override) return { bin: override, prefixArgs: [] }

  if (process.env.ANAGENT_PATH) return { bin: process.env.ANAGENT_PATH, prefixArgs: [] }

  const PATH = process.env.PATH || ''
  for (const dir of PATH.split(':')) {
    const candidate = path.join(dir, 'anagent')
    if (fs.existsSync(candidate)) return { bin: candidate, prefixArgs: [] }
  }

  return { bin: 'npx', prefixArgs: ['--yes', 'github:arthuracrs/anagent'] }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function killTmuxSession(session: string): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('tmux', ['kill-session', '-t', session], (err) => err ? reject(err) : resolve())
    })
  } catch { /* ok */ }
}
