import type { IssueId, MoleculeId, RuntimeId, WorkerId } from '../domain/types.js'

// Tools core exposes to the manager LLM via MCP.
//
// The manager (running in anagent) calls these instead of shelling out to bd or
// spawning workers with raw bash. This keeps core the single authority over side
// effects — which is what makes the UI real-time and the audit trail complete.
//
// The MCP adapter (in adapters/http-sse or a dedicated adapters/mcp) translates
// MCP tool invocations into calls on this interface. The Orchestrator implements
// it by delegating to IssueTrackerPort + AgentRuntimePort and emitting UiEvents.
export interface ManagerToolsPort {
  // Decompose a request into a swarm molecule. Returns the molecule id + the
  // child issue ids the manager can then dispatch workers onto.
  decompose(input: {
    formulaName: string
    vars: Record<string, string>
  }): Promise<{ moleculeId: MoleculeId; childIssueIds: IssueId[] }>

  // Dispatch a one-shot worker onto a ready child issue.
  dispatchWorker(input: {
    issueId: IssueId
    runtimeId?: RuntimeId
    prompt?: string
  }): Promise<{ workerId: WorkerId }>

  // List claimable/ready steps, optionally scoped to a molecule.
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
    description: 'Decompose a request into a swarm molecule of child issues using a beads formula.',
    inputSchema: {
      type: 'object',
      properties: {
        formulaName: { type: 'string', description: 'Name of the beads formula to pour.' },
        vars: { type: 'object', description: 'Variable substitutions for the formula.' },
      },
      required: ['formulaName'],
    },
  },
  {
    name: 'dispatchWorker',
    description: 'Dispatch a one-shot coding agent onto a ready child issue.',
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
    description: 'List claimable/ready work, optionally scoped to a molecule.',
    inputSchema: {
      type: 'object',
      properties: { moleculeId: { type: 'string' } },
    },
  },
  {
    name: 'workerStatus',
    description: 'Inspect worker progress by worker id or issue id.',
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
    description: 'Escalate to the human operator. Creates a human gate and blocks until it is resolved via the UI.',
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
    description: 'Record a progress comment on an issue (audit trail).',
    inputSchema: {
      type: 'object',
      properties: { issueId: { type: 'string' }, body: { type: 'string' } },
      required: ['issueId', 'body'],
    },
  },
  {
    name: 'completeIssue',
    description: 'Mark an issue as complete.',
    inputSchema: {
      type: 'object',
      properties: { issueId: { type: 'string' }, reason: { type: 'string' } },
      required: ['issueId'],
    },
  },
]
