import type { Issue, IssueId, RuntimeId, WorkerId } from '../domain/types.js'
import type { IssueFilter } from './IssueTrackerPort.js'

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
  // Create a new task on the board.
  createTask(input: {
    title: string
    description?: string
    type?: string
    priority?: number
  }): Promise<{ taskId: IssueId }>

  // Dispatch a worker onto a ready task.
  dispatchWorker(input: {
    issueId: IssueId
    runtimeId?: RuntimeId
    prompt?: string
  }): Promise<{ workerId: WorkerId }>

  // List all tasks on the board, with optional filtering.
  listTasks(input?: IssueFilter): Promise<Issue[]>

  // List ready tasks.
  listReady(): Promise<{ issueId: IssueId; title: string; status: string }[]>

  // Inspect worker progress.
  workerStatus(input: { workerId?: WorkerId; issueId?: IssueId }): Promise<{
    id: WorkerId
    status: string
    issueId: IssueId
  }[]>

  // Escalate to the human. Creates a human gate; core emits gate_opened and the
  // UI surfaces it. The manager blocks (its turn does not end) until resolved.
  escalate(input: { reason: string; issueId?: IssueId }): Promise<{ gateId: string }>

  // Record progress on a task (audit trail). Distinct from UiCommandPort.addComment
  // to avoid signature collision on the Orchestrator.
  recordProgress(input: { issueId: IssueId; body: string }): Promise<void>

  // Mark a task as complete. Distinct from UiCommandPort.closeIssue.
  completeTask(input: { taskId: IssueId; reason?: string }): Promise<void>

  // Reset in_progress tasks that have no active workers back to open.
  // Recovers from stale state after machine reboots or crashed workers.
  resetStaleTasks(): Promise<{ resetIssueIds: IssueId[] }>

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
    name: 'createTask',
    description: 'Create a new task on the board.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title.' },
        description: { type: 'string', description: 'Optional task description.' },
        type: { type: 'string', description: 'Task type (task, bug, feature, epic, chore).' },
        priority: { type: 'number', description: 'Priority (1-5, lower is higher).' },
      },
      required: ['title'],
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
        prompt: { type: 'string', description: 'Optional override prompt; defaults to task context.' },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'listTasks',
    description: 'List all tasks on the board, with optional filtering by status, type, assignee, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (e.g. open, in_progress, closed).' },
        type: { type: 'string', description: 'Filter by task type (e.g. task, bug, feature).' },
        assignee: { type: 'string', description: 'Filter by assignee.' },
      },
    },
  },
  {
    name: 'listReady',
    description: 'List ready tasks.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'workerStatus',
    description: 'Inspect worker progress by worker id or task id. With no arguments, returns all workers.',
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
        issueId: { type: 'string', description: 'Optional related task id.' },
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
    name: 'completeTask',
    description: 'Mark a task as complete.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' }, reason: { type: 'string' } },
      required: ['taskId'],
    },
  },
  {
    name: 'resetStaleTasks',
    description: 'Reset in_progress tasks with no active workers back to open. Use when listReady returns empty but tasks are stuck in_progress with zero running workers.',
    inputSchema: {
      type: 'object',
      properties: {},
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
