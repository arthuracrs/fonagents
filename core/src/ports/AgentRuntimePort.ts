import type {
  AgentStreamEvent,
  ExecMode,
  IssueId,
  RuntimeId,
  RuntimeInfo,
  SessionId,
  WorkerHandle,
  WorkerId,
} from '../domain/types.js'

// The agent runtime port. Implemented by adapters/anagent.
// Handles BOTH one-shot workers and the persistent manager session (via --resume).
export interface AgentRuntimePort {
  // ── Runtimes ────────────────────────────────────────────────────────────────
  listRuntimes(): Promise<RuntimeInfo[]>

  // ── Workers (one-shot task execution) ─────────────────────────────────────────
  spawnWorker(input: SpawnWorkerInput): Promise<WorkerHandle>
  cancelWorker(workerId: WorkerId): Promise<boolean>
  subscribeWorker(workerId: WorkerId, cb: (event: AgentStreamEvent) => void): { unsubscribe(): void }
  getWorker(workerId: WorkerId): WorkerHandle | undefined
  getWorkersForIssue(issueId: IssueId): WorkerHandle[]

  // ── Manager (persistent session via --resume) ────────────────────────────────
  // Starts a manager by running a bootstrap turn. Returns the runtime-issued
  // session id (e.g. claude code's session id) which core reuses with --resume.
  startManager(input: StartManagerInput): Promise<{ sessionId: SessionId; events: AgentStreamEvent[] }>

  // Sends a follow-up turn to an existing manager session. Resolves when the
  // turn ends (assistant finishes responding + tool calls complete). Streams
  // via onEvent for live UI updates.
  sendManagerTurn(input: SendManagerTurnInput): Promise<AgentStreamEvent[]>

  endManager(sessionId: SessionId): Promise<void>
  getManagerSession(sessionId: SessionId): import('../domain/types.js').ManagerSession | undefined
}

export interface SpawnWorkerInput {
  issueId: IssueId
  runtimeId: RuntimeId
  prompt: string
  systemPrompt: string
  mode?: ExecMode
  cwd: string
}

export interface StartManagerInput {
  runtimeId: RuntimeId
  systemPrompt: string
  bootstrapMessage: string
  // Path to an MCP server config the runtime should load, so the manager LLM
  // can call core-exposed tools (decompose, dispatchWorker, escalate, ...).
  mcpConfigPath?: string
  cwd: string
  onEvent?: (event: AgentStreamEvent) => void
}

export interface SendManagerTurnInput {
  sessionId: SessionId
  message: string
  onEvent?: (event: AgentStreamEvent) => void
}
