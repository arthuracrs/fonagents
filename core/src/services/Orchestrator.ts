import type {
  AgentStreamEvent,
  Comment,
  Dependency,
  Gate,
  GateId,
  Issue,
  IssueId,
  RuntimeInfo,
  WorkerHandle,
  WorkerId,
} from '../domain/types.js'
import type {
  AgentRuntimePort,
  SpawnWorkerInput,
} from '../ports/AgentRuntimePort.js'
import type { IssueCreateInput, IssueFilter, IssueTrackerPort, IssueUpdatePatch } from '../ports/IssueTrackerPort.js'
import type { ManagerToolsPort } from '../ports/ManagerToolsPort.js'
import { buildWorkerSystemPrompt, DEFAULT_PROMPT } from '../prompts/index.js'
import type { UiCommandPort } from '../ports/UiCommandPort.js'
import type { UiEvent, UiEventPort } from '../ports/UiEventPort.js'

const DEFAULT_WORKER_RUNTIME = 'opencode'

export interface OrchestratorConfig {
  projectDir: string
  managerRuntimeId?: string
  overseer?: { enabled: boolean; mode: string }
  maxWorkers?: number
}

export class Orchestrator implements UiCommandPort, ManagerToolsPort {
  private readonly workerSubscriptions = new Map<WorkerId, { unsubscribe(): void }>()

  constructor(
    private readonly tracker: IssueTrackerPort,
    private readonly runtime: AgentRuntimePort,
    private readonly events: UiEventPort,
    private readonly config: OrchestratorConfig,
  ) {}

  // ── UiCommandPort: gates ───────────────────────────────────────────────────────

  async resolveGate(gateId: GateId, note?: string): Promise<void> {
    await this.tracker.resolveGate(gateId)
    if (note) await this.tracker.recordAudit({ actor: 'human', event: 'gate.resolved', payload: { gateId, note } })
    this.emit({ type: 'gate_resolved', gateId })
  }

  // ── UiCommandPort: worker control ──────────────────────────────────────────────

  async cancelWorker(workerId: WorkerId): Promise<void> {
    await this.runtime.cancelWorker(workerId)
  }

  // ── UiCommandPort: queries (delegate to tracker/runtime) ────────────────────

  listIssues(filter?: IssueFilter): Promise<Issue[]> { return this.tracker.listIssues(filter) }
  getIssue(id: IssueId): Promise<Issue | undefined> { return this.tracker.getIssue(id) }
  listGates(): Promise<Gate[]> { return this.tracker.listGates({ open: true }) }
  getWorkerStatus(workerId: WorkerId): Promise<WorkerHandle | undefined> {
    return Promise.resolve(this.runtime.getWorker(workerId))
  }
  listWorkers(): Promise<WorkerHandle[]> {
    return Promise.resolve(this.runtime.listWorkers())
  }
  listRuntimes(): Promise<RuntimeInfo[]> { return this.runtime.listRuntimes() }
  listComments(issueId: IssueId): Promise<Comment[]> { return this.tracker.listComments(issueId) }
  listDependencies(issueId: IssueId): Promise<Dependency[]> { return this.tracker.listDependencies(issueId) }
  children(parentId: IssueId): Promise<Issue[]> { return this.tracker.children(parentId) }

  // ── UiCommandPort: direct issue CRUD ──────────────────────────────────────────

  createIssue(input: IssueCreateInput): Promise<Issue> { return this.tracker.createIssue(input) }
  updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue> { return this.tracker.updateIssue(id, patch) }
  closeIssue(id: IssueId, reason?: string): Promise<Issue> { return this.tracker.closeIssue(id, reason) }
  reopenIssue(id: IssueId): Promise<Issue> { return this.tracker.reopenIssue(id) }
  claimIssue(id: IssueId): Promise<Issue> { return this.tracker.claimIssue(id) }
  addComment(issueId: IssueId, body: string): Promise<Comment> { return this.tracker.addComment(issueId, body, 'Human') }
  addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void> {
    return this.tracker.addDependency(childId, parentId, type)
  }

  // ── ManagerToolsPort: tools the manager LLM calls via MCP ──────────────────────

  async createTask(input: {
    title: string
    description?: string
    type?: string
    priority?: number
  }): Promise<{ taskId: IssueId }> {
    const issue = await this.tracker.createIssue({
      title: input.title,
      description: input.description,
      type: (input.type ?? 'task') as any,
      priority: input.priority,
    })
    return { taskId: issue.id }
  }

  listTasks(filter?: IssueFilter): Promise<Issue[]> { return this.listIssues(filter) }

  async dispatchWorker(input: {
    issueId: IssueId
    runtimeId?: string
    prompt?: string
  }): Promise<{ workerId: WorkerId }> {
    const max = this.config.maxWorkers ?? 5
    const active = this.workerSubscriptions.size
    if (active >= max) {
      throw new Error(`Cannot dispatch: ${active} workers already running (max ${max}). Wait for one to finish or increase the limit.`)
    }
    const issue = await this.tracker.getIssue(input.issueId)
    if (!issue) throw new Error(`Cannot dispatch: issue ${input.issueId} not found`)
    const spawnInput: SpawnWorkerInput = {
      issueId: input.issueId,
      runtimeId: input.runtimeId ?? DEFAULT_WORKER_RUNTIME,
      prompt: input.prompt ?? DEFAULT_PROMPT.replaceAll('{id}', input.issueId),
      systemPrompt: buildWorkerSystemPrompt(input.issueId),
      mode: 'tmux',
      cwd: this.config.projectDir,
    }
    const worker = await this.runtime.spawnWorker(spawnInput)
    await this.tracker.updateIssue(input.issueId, { status: 'in_progress', assignee: worker.id })
    this.emit({ type: 'worker_started', worker })

    const unsub = this.runtime.subscribeWorker(worker.id, (ev) => {
      this.forwardWorkerEvent(worker.id, ev)
      if (ev.type === 'done' || ev.type === 'failed') {
        const cleanup = this.workerSubscriptions.get(worker.id)
        if (cleanup) { cleanup.unsubscribe(); this.workerSubscriptions.delete(worker.id) }
      }
    })
    this.workerSubscriptions.set(worker.id, unsub)
    return { workerId: worker.id }
  }

  async listReady(): Promise<{ issueId: IssueId; title: string; status: string }[]> {
    const ready = await this.tracker.readyWork()
    return ready.map((r) => ({ issueId: r.issueId, title: r.title, status: 'ready' }))
  }

  async workerStatus(input: { workerId?: WorkerId; issueId?: IssueId }): Promise<{
    id: WorkerId
    status: string
    issueId: IssueId
  }[]> {
    if (input.workerId) {
      const w = this.runtime.getWorker(input.workerId)
      return w ? [{ id: w.id, status: w.status, issueId: w.issueId }] : []
    }
    if (input.issueId) {
      return this.runtime.getWorkersForIssue(input.issueId).map((w) => ({ id: w.id, status: w.status, issueId: w.issueId }))
    }
    return this.runtime.listWorkers().map((w) => ({ id: w.id, status: w.status, issueId: w.issueId }))
  }

  async escalate(input: { reason: string; issueId: IssueId }): Promise<{ gateId: string }> {
    const { issueId } = input
    const gate = await this.tracker.createGate({
      issueId,
      type: 'human',
      reason: input.reason,
    })
    this.emit({ type: 'gate_opened', gate })
    return { gateId: gate.id }
  }

  async recordProgress(input: { issueId: IssueId; body: string }): Promise<void> {
    await this.tracker.addComment(input.issueId, input.body, 'fonagents-manager')
    this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'commented' })
  }

  async completeTask(input: { taskId: IssueId; reason?: string }): Promise<void> {
    await this.tracker.closeIssue(input.taskId, input.reason)
    this.emit({ type: 'issue_changed', issueId: input.taskId, change: 'closed' })
    const workers = this.runtime.listWorkers()
    for (const w of workers) {
      if (w.issueId === input.taskId && w.status === 'running') {
        await this.runtime.cancelWorker(w.id)
      }
    }
  }

  async resetStaleTasks(): Promise<{ resetIssueIds: IssueId[] }> {
    const inProgress = await this.tracker.listIssues({ status: 'in_progress' })
    const resetIds: IssueId[] = []
    for (const issue of inProgress) {
      const workers = this.runtime.getWorkersForIssue(issue.id)
      if (workers.length === 0) {
        await this.tracker.updateIssue(issue.id, { status: 'open' })
        resetIds.push(issue.id)
        this.emit({ type: 'issue_changed', issueId: issue.id, change: 'reset' })
      }
    }
    return { resetIssueIds: resetIds }
  }

  async overseerStatus(): Promise<{ enabled: boolean; mode: string; activeOverseers: number; queueLength: number }> {
    return {
      enabled: this.config.overseer?.enabled ?? true,
      mode: this.config.overseer?.mode ?? 'queue',
      activeOverseers: 0,
      queueLength: 0,
    }
  }

  // Update overseer config at runtime (called by daemon after UI toggle).
  setOverseerConfig(config: { enabled: boolean; mode: string }): void {
    this.config.overseer = config
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────

  private forwardWorkerEvent(workerId: WorkerId, ev: AgentStreamEvent): void {
    if (ev.type === 'text') this.emit({ type: 'worker_output', workerId, delta: ev.delta })
    else if (ev.type === 'done') {
      const worker = this.runtime.getWorker(workerId)
      this.emit({ type: 'worker_status', workerId, issueId: worker?.issueId ?? '', status: 'completed', exitCode: ev.exitCode })
    } else if (ev.type === 'failed') {
      const worker = this.runtime.getWorker(workerId)
      this.emit({ type: 'worker_status', workerId, issueId: worker?.issueId ?? '', status: 'failed', exitCode: ev.exitCode })
    }
  }

  private emit(event: UiEvent): void { this.events.emit(event) }
}
