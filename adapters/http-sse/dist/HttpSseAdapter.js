"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpSseApp = createHttpSseApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Creates an Express app that:
//   1. Exposes UiCommandPort methods as HTTP endpoints (UIs drive core)
//   2. Exposes UiEventPort as an SSE fanout (core emits to all connected UIs)
//   3. Exposes ManagerToolsPort methods as HTTP endpoints (MCP server calls these)
//
// The eventBus and mcpConfigPath are created OUTSIDE and passed in, so the
// Orchestrator can be constructed with them before the Express routes are wired.
// This breaks the circular dependency: Orchestrator needs mcpConfigPath →
// createHttpSseApp needs Orchestrator for route handlers.
function createHttpSseApp(command, managerTools, eventBus, config) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Wrap async handlers with uniform error handling so bd/anagent failures
    // return a clean 500 JSON instead of a raw Express stack trace.
    const wrap = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        }
        catch (err) {
            const e = err;
            if (!res.headersSent)
                res.status(500).json({ error: e.stderr || e.message });
        }
    };
    // Express 5 types req.params as string | string[]; extract the string.
    const param = (req, key) => {
        const v = req.params[key];
        return Array.isArray(v) ? v[0] : v;
    };
    // ── SSE event stream ──────────────────────────────────────────────────────
    // UIs connect here and receive all UiEvent broadcasts in real time.
    app.get('/api/events', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        res.socket?.setNoDelay(true);
        eventBus.addClient(res);
        req.on('close', () => eventBus.removeClient(res));
    });
    // ── Conversation ────────────────────────────────────────────────────────────
    app.post('/api/message', wrap(async (req, res) => {
        const { content } = req.body;
        if (!content) {
            res.status(400).json({ error: 'content is required' });
            return;
        }
        const result = await command.sendUserMessage(content);
        res.json(result);
    }));
    // ── Manager lifecycle ───────────────────────────────────────────────────────
    app.post('/api/manager/start', wrap(async (_req, res) => {
        res.json(await command.startManager());
    }));
    app.post('/api/manager/end', wrap(async (_req, res) => {
        await command.endManager();
        res.json({ ok: true });
    }));
    // ── Gates ───────────────────────────────────────────────────────────────────
    app.post('/api/gates/:id/resolve', wrap(async (req, res) => {
        const { note } = req.body;
        await command.resolveGate(param(req, 'id'), note);
        res.json({ ok: true });
    }));
    // ── Worker control ──────────────────────────────────────────────────────────
    app.post('/api/workers/:id/cancel', wrap(async (req, res) => {
        await command.cancelWorker(param(req, "id"));
        res.json({ ok: true });
    }));
    // ── Issue queries ───────────────────────────────────────────────────────────
    app.get('/api/issues', wrap(async (req, res) => {
        const filter = {};
        const { status, type, priority, assignee, parent } = req.query;
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        if (priority !== undefined)
            filter.priority = Number(priority);
        if (assignee)
            filter.assignee = assignee;
        if (parent)
            filter.parent = parent;
        res.json(await command.listIssues(filter));
    }));
    app.get('/api/issues/:id', wrap(async (req, res) => {
        const issue = await command.getIssue(param(req, "id"));
        if (!issue) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(issue);
    }));
    // ── Issue CRUD ──────────────────────────────────────────────────────────────
    app.post('/api/issues', wrap(async (req, res) => {
        const input = req.body;
        if (!input.title) {
            res.status(400).json({ error: 'title is required' });
            return;
        }
        res.json(await command.createIssue(input));
    }));
    app.patch('/api/issues/:id', wrap(async (req, res) => {
        const patch = req.body;
        res.json(await command.updateIssue(param(req, "id"), patch));
    }));
    app.post('/api/issues/:id/close', wrap(async (req, res) => {
        const { reason } = req.body;
        res.json(await command.closeIssue(param(req, "id"), reason));
    }));
    app.post('/api/issues/:id/reopen', wrap(async (req, res) => {
        res.json(await command.reopenIssue(param(req, "id")));
    }));
    app.post('/api/issues/:id/claim', wrap(async (req, res) => {
        res.json(await command.claimIssue(param(req, "id")));
    }));
    app.post('/api/issues/:id/comment', wrap(async (req, res) => {
        const { body } = req.body;
        if (!body) {
            res.status(400).json({ error: 'body is required' });
            return;
        }
        res.json(await command.addComment(param(req, "id"), body));
    }));
    app.get('/api/issues/:id/comments', wrap(async (req, res) => {
        res.json(await command.listComments(param(req, "id")));
    }));
    app.get('/api/issues/:id/deps', wrap(async (req, res) => {
        res.json(await command.listDependencies(param(req, "id")));
    }));
    app.post('/api/deps', wrap(async (req, res) => {
        const { child, parent, type } = req.body;
        await command.addDependency(child, parent, type);
        res.json({ ok: true });
    }));
    app.get('/api/issues/:id/children', wrap(async (req, res) => {
        res.json(await command.children(param(req, "id")));
    }));
    // ── Molecules & formulas ─────────────────────────────────────────────────────
    app.get('/api/molecules', wrap(async (_req, res) => {
        res.json(await command.listMolecules());
    }));
    app.get('/api/molecules/:id', wrap(async (req, res) => {
        res.json(await command.showMolecule(param(req, "id")));
    }));
    app.get('/api/formulas', wrap(async (_req, res) => {
        res.json(await command.listFormulas());
    }));
    // ── Ready work & gates ──────────────────────────────────────────────────────
    app.get('/api/ready', wrap(async (_req, res) => {
        res.json(await command.listReadyWork());
    }));
    app.get('/api/gates', wrap(async (_req, res) => {
        res.json(await command.listGates());
    }));
    // ── Workers & runtimes ──────────────────────────────────────────────────────
    app.get('/api/workers/:id', wrap(async (req, res) => {
        const worker = await command.getWorkerStatus(param(req, "id"));
        if (!worker) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(worker);
    }));
    app.get('/api/runtimes', wrap(async (_req, res) => {
        res.json(await command.listRuntimes());
    }));
    // ── Messages ────────────────────────────────────────────────────────────────
    app.get('/api/messages', wrap(async (_req, res) => {
        res.json(await command.listMessages());
    }));
    // ── MCP tool endpoint (called by the MCP server script) ──────────────────────
    app.post('/api/mcp/tools/:name', wrap(async (req, res) => {
        const toolName = param(req, "name");
        const args = req.body;
        const result = await executeManagerTool(managerTools, toolName, args);
        res.json(result);
    }));
    return { app };
}
// Dispatches an MCP tool call to the corresponding ManagerToolsPort method.
async function executeManagerTool(tools, name, args) {
    switch (name) {
        case 'decompose':
            return tools.decompose(args);
        case 'dispatchWorker':
            return tools.dispatchWorker(args);
        case 'listReady':
            return tools.listReady(args);
        case 'workerStatus':
            return tools.workerStatus(args);
        case 'escalate':
            return tools.escalate(args);
        case 'recordProgress':
            return tools.recordProgress(args);
        case 'completeIssue':
            return tools.completeIssue(args);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
//# sourceMappingURL=HttpSseAdapter.js.map