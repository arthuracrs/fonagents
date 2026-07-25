import type { IssueId, MoleculeId, RuntimeId, WorkerId } from '../domain/types.js'

// Tools core exposes to the manager LLM via MCP.
//
// The manager (running in anagent) calls these via MCP tools instead of
// spawning workers with raw bash. This keeps core the single authority over
// side effects — which is what makes the UI real-time and the audit trail
// complete.
//
// The MCP adapter (in adapters/http-sse) translates MCP tool invocations into
// calls on this interface. The Orchestrator implements it by delegating to
// IssueTrackerPort + AgentRuntimePort and emitting UiEvents.
export interface ManagerToolsPort {
  // Break a request into a set of related tasks. Returns the task group id +
  // the child task ids the manager can then dispatch workers onto.
  decompose(input: {
    formulaName: string
    vars: Record<string, string>
  }): Promise<{ moleculeId: MoleculeId; childIssueIds: IssueId[] }>

  // Dispatch a worker onto a ready task.
  dispatchWorker(input: {
    issueId: IssueId
    runtimeId?: RuntimeId
    prompt?: string
  }): Promise<{ workerId: WorkerId }>

  // List ready tasks, optionally scoped to a task group.
  listReady(input: { moleculeId?: MoleculeId }): Promise<{ issueId: IssueId; title: string; status: string }[]>

  // Inspect worker progress.
  workerStatus(input: { workerId?: WorkerId; issueId?: IssueId }): Promise<{
    id: WorkerId
    status: string
    issueId: IssueId
  }[]>

  // Escalate to the human. Creates a human gate; core emits gate_opened and the
  // UI surfaces it. The manager blocks (its turn does not end) until resolved.
  escalate(input: { reason: string; issueId?: IssueId }): Promise<{ gateId: string }>

  // Record progress on an issue (audit trail). Distinct from UiCommandPort.addComment
  // to avoid signature collision on the Orchestrator.
  recordProgress(input: { issueId: IssueId; body: string }): Promise<void>

  // Mark an issue as complete. Distinct from UiCommandPort.closeIssue.
  completeIssue(input: { issueId: IssueId; reason?: string }): Promise<void>

  // Get the overseer status (auto-dispatch supervisor).
  overseerStatus(): Promise<{
    enabled: boolean
    mode: string
    activeOverseers: number
    queueLength: number
  }>
}

// Tool schemas exported for the MCP adapter to register. Keeping them here means
// the contract is defined once, in core, and the adapter just forwards.
export interface ToolSchema {
  name: keyof ManagerToolsPort
  description: string
  inputSchema: Record<string, unknown>
}

export const MANAGER_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'decompose',
    description: 'Break a request into a set of related tasks using a TaskForge template.',
    inputSchema: {
      type: 'object',
      properties: {
        formulaName: { type: 'string', description: 'Name of the TaskForge template.' },
        vars: { type: 'object', description: 'Variable substitutions for the template.' },
      },
      required: ['formulaName'],
    },
  },
  {
    name: 'dispatchWorker',
    description: 'Dispatch a coding agent onto a ready task. Respects a max-concurrent-workers limit (default 5, configurable via FONAGENTS_MAX_WORKERS).',
    inputSchema: {
      type: 'object',
      properties: {
        issueId: { type: 'string' },
        runtimeId: { type: 'string', description: 'Agent runtime id (e.g. claude-code). Defaults to the manager runtime.' },
        prompt: { type: 'string', description: 'Optional override prompt; defaults to issue context.' },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'listReady',
    description: 'List ready tasks, optionally scoped to a task group.',
    inputSchema: {
      type: 'object',
      properties: { moleculeId: { type: 'string', description: 'Optional task group id to scope to.' } },
    },
  },
  {
    name: 'workerStatus',
    description: 'Inspect worker progress by worker id or task id.',
    inputSchema: {
      type: 'object',
      properties: {
        workerId: { type: 'string' },
        issueId: { type: 'string' },
      },
    },
  },
  {
    name: 'escalate',
    description: 'Escalate to the human. Creates a human gate and blocks until resolved via the UI.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the human is needed.' },
        issueId: { type: 'string', description: 'Optional related issue.' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'recordProgress',
    description: 'Record a progress comment on a task (audit trail).',
    inputSchema: {
      type: 'object',
      properties: { issueId: { type: 'string' }, body: { type: 'string' } },
      required: ['issueId', 'body'],
    },
  },
  {
    name: 'completeIssue',
    description: 'Mark a task as complete.',
    inputSchema: {
      type: 'object',
      properties: { issueId: { type: 'string' }, reason: { type: 'string' } },
      required: ['issueId'],
    },
  },
  {
    name: 'overseerStatus',
    description: 'Get the overseer status — auto-dispatch supervisor that automatically dispatches workers after each worker completes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]
