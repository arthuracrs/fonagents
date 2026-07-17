import type {
  AgentStreamEvent,
  Comment,
  Dependency,
  FormulaSummary,
  Gate,
  GateId,
  Issue,
  IssueId,
  Molecule,
  MoleculeId,
  ReadyWork,
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
import type { UiCommandPort } from '../ports/UiCommandPort.js'
import type { UiEvent, UiEventPort } from '../ports/UiEventPort.js'

const DEFAULT_MANAGER_RUNTIME = 'opencode'

export interface OrchestratorConfig {
  projectDir: string
  managerRuntimeId?: string
}

export class Orchestrator implements UiCommandPort, ManagerToolsPort {
  private currentMoleculeId?: MoleculeId
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
  listMolecules(): Promise<Molecule[]> { return this.tracker.listMolecules() }
  showMolecule(id: MoleculeId): Promise<unknown> { return this.tracker.showMolecule(id) }
  listReadyWork(): Promise<ReadyWork[]> { return this.tracker.readyWork() }
  listGates(): Promise<Gate[]> { return this.tracker.listGates({ open: true }) }
  getWorkerStatus(workerId: WorkerId): Promise<WorkerHandle | undefined> {
    return Promise.resolve(this.runtime.getWorker(workerId))
  }
  listRuntimes(): Promise<RuntimeInfo[]> { return this.runtime.listRuntimes() }
  listComments(issueId: IssueId): Promise<Comment[]> { return this.tracker.listComments(issueId) }
  listDependencies(issueId: IssueId): Promise<Dependency[]> { return this.tracker.listDependencies(issueId) }
  children(parentId: IssueId): Promise<Issue[]> { return this.tracker.children(parentId) }
  listFormulas(): Promise<FormulaSummary[]> { return this.tracker.listFormulas() }

  // ── UiCommandPort: direct issue CRUD ──────────────────────────────────────────

  createIssue(input: IssueCreateInput): Promise<Issue> { return this.tracker.createIssue(input) }
  updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue> { return this.tracker.updateIssue(id, patch) }
  closeIssue(id: IssueId, reason?: string): Promise<Issue> { return this.tracker.closeIssue(id, reason) }
  reopenIssue(id: IssueId): Promise<Issue> { return this.tracker.reopenIssue(id) }
  claimIssue(id: IssueId): Promise<Issue> { return this.tracker.claimIssue(id) }
  addComment(issueId: IssueId, body: string): Promise<Comment> { return this.tracker.addComment(issueId, body) }
  addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void> {
    return this.tracker.addDependency(childId, parentId, type)
  }

  // ── ManagerToolsPort: tools the manager LLM calls via MCP ──────────────────────

  async decompose(input: {
    formulaName: string
    vars: Record<string, string>
  }): Promise<{ moleculeId: MoleculeId; childIssueIds: IssueId[] }> {
    const mol = await this.tracker.pourMolecule(input.formulaName, input.vars)
    this.currentMoleculeId = mol.id
    const children = await this.tracker.children(mol.rootIssueId)
    this.emit({ type: 'molecule_poured', moleculeId: mol.id, formulaName: input.formulaName })
    return { moleculeId: mol.id, childIssueIds: children.map((c) => c.id) }
  }

  async dispatchWorker(input: {
    issueId: IssueId
    runtimeId?: string
    prompt?: string
  }): Promise<{ workerId: WorkerId }> {
    const issue = await this.tracker.getIssue(input.issueId)
    if (!issue) throw new Error(`Cannot dispatch: issue ${input.issueId} not found`)
    await this.tracker.claimIssue(input.issueId)

    const spawnInput: SpawnWorkerInput = {
      issueId: input.issueId,
      runtimeId: input.runtimeId ?? this.config.managerRuntimeId ?? DEFAULT_MANAGER_RUNTIME,
      prompt: input.prompt ?? `Resolve ${input.issueId}: ${issue.title}`,
      systemPrompt: `You are a worker agent executing beads issue ${input.issueId}.\n\n${issue.description}`,
      mode: 'headless',
      cwd: this.config.projectDir,
    }
    const worker = await this.runtime.spawnWorker(spawnInput)
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

  async listReady(input: { moleculeId?: MoleculeId }): Promise<{ issueId: IssueId; title: string; status: string }[]> {
    const ready = await this.tracker.readyWork({ molId: input.moleculeId })
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
    return []
  }

  async escalate(input: { reason: string; issueId?: IssueId }): Promise<{ gateId: string }> {
    const issueId = input.issueId ?? await this.currentMoleculeRoot()
    if (!issueId) throw new Error('Cannot escalate without an issue context — provide issueId or decompose first.')
    const gate = await this.tracker.createGate({
      issueId,
      type: 'human',
      reason: input.reason,
    })
    this.emit({ type: 'gate_opened', gate })
    return { gateId: gate.id }
  }

  async recordProgress(input: { issueId: IssueId; body: string }): Promise<void> {
    await this.tracker.addComment(input.issueId, input.body)
    this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'commented' })
  }

  async completeIssue(input: { issueId: IssueId; reason?: string }): Promise<void> {
    await this.tracker.closeIssue(input.issueId, input.reason)
    this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'closed' })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────

  private forwardWorkerEvent(workerId: WorkerId, ev: AgentStreamEvent): void {
    if (ev.type === 'text') this.emit({ type: 'worker_output', workerId, delta: ev.delta })
    else if (ev.type === 'done') this.emit({ type: 'worker_status', workerId, status: 'completed', exitCode: ev.exitCode })
    else if (ev.type === 'failed') this.emit({ type: 'worker_status', workerId, status: 'failed', exitCode: ev.exitCode })
  }

  private async currentMoleculeRoot(): Promise<IssueId | undefined> {
    if (!this.currentMoleculeId) return undefined
    const molecules = await this.tracker.listMolecules()
    const mol = molecules.find((m) => m.id === this.currentMoleculeId)
    return mol?.rootIssueId
  }

  private emit(event: UiEvent): void { this.events.emit(event) }
}
