"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANAGER_TOOL_SCHEMAS = void 0;
exports.MANAGER_TOOL_SCHEMAS = [
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