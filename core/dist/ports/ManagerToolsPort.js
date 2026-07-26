"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANAGER_TOOL_SCHEMAS = void 0;
exports.MANAGER_TOOL_SCHEMAS = [
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
];
//# sourceMappingURL=ManagerToolsPort.js.map