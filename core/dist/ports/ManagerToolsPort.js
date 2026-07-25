"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANAGER_TOOL_SCHEMAS = void 0;
exports.MANAGER_TOOL_SCHEMAS = [
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
        name: 'listIssues',
        description: 'List all tasks on the board, with optional filtering by status, type, assignee, etc.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', description: 'Filter by status (e.g. todo, in_progress, done).' },
                type: { type: 'string', description: 'Filter by issue type (e.g. task, bug).' },
                assignee: { type: 'string', description: 'Filter by assignee.' },
                moleculeId: { type: 'string', description: 'Filter by task group id.' },
            },
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
];
//# sourceMappingURL=ManagerToolsPort.js.map