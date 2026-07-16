import type {
  ChatMessage,
  Comment,
  Dependency,
  Gate,
  GateId,
  Issue,
  IssueId,
  Molecule,
  MoleculeId,
  ReadyWork,
  RuntimeInfo,
  SessionId,
  WorkerHandle,
  WorkerId,
} from '../domain/types.js'
import type { IssueCreateInput, IssueFilter, IssueUpdatePatch } from './IssueTrackerPort.js'

// The driving port: UIs call INTO core through this.
// Each UI adapter (http-sse, terminal, discord) translates its transport into
// these method calls. Core never knows which UI is talking.
//
// Query methods delegate to IssueTrackerPort via the Orchestrator; they live
// here so a UI has a single entry point for everything it needs.
export interface UiCommandPort {
  // ── Conversation ─────────────────────────────────────────────────────────────
  // User sends a message to the manager. The manager processes it asynchronously
  // and emits UiEventPort events (manager_stream, manager_message, gate_opened,
  // worker_started, ...) as it works. Resolves once the message is accepted;
  // streaming happens via events.
  sendUserMessage(content: string): Promise<{ userMessageId: string; managerMessageId: string }>

  // ── Human-in-the-loop gates ───────────────────────────────────────────────────
  resolveGate(gateId: GateId, note?: string): Promise<void>

  // ── Worker control ────────────────────────────────────────────────────────────
  cancelWorker(workerId: WorkerId): Promise<void>

  // ── Queries ──────────────────────────────────────────────────────────────────
  listIssues(filter?: IssueFilter): Promise<Issue[]>
  getIssue(id: IssueId): Promise<Issue | undefined>
  listMolecules(): Promise<Molecule[]>
  showMolecule(id: MoleculeId): Promise<unknown>
  listReadyWork(): Promise<ReadyWork[]>
  listGates(): Promise<Gate[]>
  getWorkerStatus(workerId: WorkerId): Promise<WorkerHandle | undefined>
  listMessages(): Promise<ChatMessage[]>
  listRuntimes(): Promise<RuntimeInfo[]>
  listComments(issueId: IssueId): Promise<Comment[]>
  listDependencies(issueId: IssueId): Promise<Dependency[]>
  children(parentId: IssueId): Promise<Issue[]>
  listFormulas(): Promise<import('../domain/types.js').FormulaSummary[]>

  // ── Direct issue CRUD (the human manages tasks too, not just the manager) ────
  createIssue(input: IssueCreateInput): Promise<Issue>
  updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue>
  closeIssue(id: IssueId, reason?: string): Promise<Issue>
  reopenIssue(id: IssueId): Promise<Issue>
  claimIssue(id: IssueId): Promise<Issue>
  addComment(issueId: IssueId, body: string): Promise<Comment>
  addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void>

  // ── Manager lifecycle ─────────────────────────────────────────────────────────
  startManager(): Promise<{ sessionId: SessionId }>
  endManager(): Promise<void>
}
