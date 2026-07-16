import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import type {
  AgentRuntimePort,
  AgentStreamEvent,
  ExecMode,
  IssueId,
  ManagerSession,
  RuntimeInfo,
  SessionId,
  SpawnWorkerInput,
  StartManagerInput,
  SendManagerTurnInput,
  WorkerHandle,
  WorkerId,
} from '@fonagents/core'
import { translateEvent, parseNdjsonLine } from './protocol.js'

export interface AnagentAdapterConfig {
  anagentPath?: string
  cwd: string
}

// Implements AgentRuntimePort by shelling out to `anagent run --stream`.
// Workers are one-shot anagent invocations. The manager is a series of
// anagent invocations linked by --resume (each turn is a separate process;
// claude code's session JSONL provides continuity).
export class AnagentAdapter implements AgentRuntimePort {
  private readonly workers = new Map<WorkerId, WorkerHandle & { process?: ChildProcess }>()
  private readonly listeners = new Map<WorkerId, Set<(event: AgentStreamEvent) => void>>()
  private readonly managerSessions = new Map<SessionId, ManagerSession & { runtimeId?: string; mcpConfigPath?: string }>()
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

    // Track whether the NDJSON stream emitted a terminal (done/failed) event.
    // If the process is killed without emitting one, we synthesize it in the
    // close handler so the UI learns the worker stopped.
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

  // ── Manager (persistent session via --resume) ────────────────────────────────

  async startManager(input: StartManagerInput): Promise<{ sessionId: SessionId; events: AgentStreamEvent[] }> {
    const args = [
      ...this.binArgs,
      'run', input.bootstrapMessage,
      '--stream',
      '--runtime', input.runtimeId,
      '--mode', 'headless',
      '--system-prompt', input.systemPrompt,
      '--cwd', input.cwd ?? this.cwd,
    ]
    if (input.mcpConfigPath) args.push('--mcp-config', input.mcpConfigPath)

    const events = await this.runStreamingSession(args, input.onEvent)
    const sessionEvent = events.find((e) => e.type === 'session')
    if (!sessionEvent || sessionEvent.type !== 'session') {
      throw new Error('Manager bootstrap did not emit a session event — cannot resume.')
    }
    const sessionId = sessionEvent.sessionId

    this.managerSessions.set(sessionId, {
      sessionId,
      startedAt: new Date().toISOString(),
      status: 'active',
      runtimeId: input.runtimeId,
      mcpConfigPath: input.mcpConfigPath,
    })

    return { sessionId, events }
  }

  async sendManagerTurn(input: SendManagerTurnInput): Promise<AgentStreamEvent[]> {
    const session = this.managerSessions.get(input.sessionId)
    if (!session) throw new Error(`No manager session found for id ${input.sessionId}`)

    // Reuse the same runtime + MCP config as the bootstrap turn.
    // Without --runtime, anagent defaults to 'opencode' — this was the bug
    // that caused manager turns to run opencode instead of claude-code.
    const args = [
      ...this.binArgs,
      'run', input.message,
      '--stream',
      '--resume', input.sessionId,
      '--cwd', this.cwd,
    ]
    if (session.runtimeId) args.push('--runtime', session.runtimeId)
    if (session.mcpConfigPath) args.push('--mcp-config', session.mcpConfigPath)

    const events = await this.runStreamingSession(args, input.onEvent)
    return events
  }

  async endManager(sessionId: SessionId): Promise<void> {
    const session = this.managerSessions.get(sessionId)
    if (session) {
      session.status = 'ended'
      this.managerSessions.delete(sessionId)
    }
  }

  getManagerSession(sessionId: SessionId): ManagerSession | undefined {
    return this.managerSessions.get(sessionId)
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

  private runStreamingSession(
    args: string[],
    onEvent?: (event: AgentStreamEvent) => void,
  ): Promise<AgentStreamEvent[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.bin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.cwd,
      })

      const events: AgentStreamEvent[] = []
      let buf = ''
      let stderr = ''

      proc.stdout?.on('data', (data: Buffer) => {
        buf += data.toString()
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const raw = parseNdjsonLine(line)
          if (!raw) continue
          const translated = translateEvent(raw)
          if (translated) {
            events.push(translated)
            onEvent?.(translated)
          }
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        // Flush remaining buffer
        if (buf.trim()) {
          const raw = parseNdjsonLine(buf)
          if (raw) {
            const translated = translateEvent(raw)
            if (translated) {
              events.push(translated)
              onEvent?.(translated)
            }
          }
        }

        if (code !== 0 && !events.some((e) => e.type === 'done' || e.type === 'failed')) {
          const failEvent: AgentStreamEvent = {
            type: 'failed',
            error: stderr.trim().slice(0, 500) || `Exit code ${code}`,
            exitCode: code ?? -1,
            durationMs: 0,
          }
          events.push(failEvent)
          onEvent?.(failEvent)
        }
        resolve(events)
      })

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn anagent: ${err.message}`))
      })
    })
  }
}

// ── Anagent binary resolution ─────────────────────────────────────────────────

function resolveAnagent(override?: string): { bin: string; prefixArgs: string[] } {
  if (override) return { bin: override, prefixArgs: [] }

  // 1. Local dev — adjacent monorepo repo
  const localDist = path.join(__dirname, '../../../anagent/dist/cli.js')
  if (fs.existsSync(localDist)) return { bin: 'node', prefixArgs: [localDist] }

  // 2. PATH
  const PATH = process.env.PATH || ''
  for (const dir of PATH.split(':')) {
    const candidate = path.join(dir, 'anagent')
    if (fs.existsSync(candidate)) return { bin: candidate, prefixArgs: [] }
  }

  // 3. npx fallback
  return { bin: 'npx', prefixArgs: ['--yes', 'github:arthuracrs/anagent'] }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
