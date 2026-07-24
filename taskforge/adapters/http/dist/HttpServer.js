"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
class HttpServer {
    services;
    app = (0, express_1.default)();
    server;
    wss;
    clients = new Set();
    constructor(services) {
        this.services = services;
        this.app.use(express_1.default.json());
        this.app.use(this.corsMiddleware);
        this.setupRoutes();
        this.server = (0, http_1.createServer)(this.app);
        this.wss = new ws_1.WebSocketServer({ server: this.server, path: '/api/events/stream' });
        this.setupWebSocket();
    }
    corsMiddleware(_req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (_req.method === 'OPTIONS') {
            res.sendStatus(204);
            return;
        }
        next();
    }
    setupRoutes() {
        this.app.get('/api/tasks', this.listTasks);
        this.app.post('/api/tasks', this.createTask);
        this.app.get('/api/tasks/:id', this.getTask);
        this.app.patch('/api/tasks/:id', this.updateTask);
        this.app.delete('/api/tasks/:id', this.deleteTask);
        this.app.post('/api/tasks/:id/claim', this.claimTask);
        this.app.post('/api/tasks/:id/close', this.closeTask);
        this.app.post('/api/tasks/:id/reopen', this.reopenTask);
        this.app.post('/api/tasks/:id/comment', this.addComment);
        this.app.get('/api/actors', this.listActors);
        this.app.post('/api/actors', this.createActor);
        this.app.get('/api/events', this.listEvents);
        this.app.get('/api/gates', this.listGates);
        this.app.post('/api/gates', this.createGate);
        this.app.post('/api/gates/:id/resolve', this.resolveGate);
        this.app.get('/api/templates', this.listTemplates);
        this.app.get('/api/templates/:name', this.getTemplate);
        this.app.post('/api/templates', this.createTemplate);
        this.app.post('/api/templates/:name/pour', this.pourTemplate);
        this.app.delete('/api/templates/:name', this.deleteTemplate);
        this.app.use(this.errorHandler);
    }
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            ws.on('close', () => this.clients.delete(ws));
        });
        this.services.events.subscribe((event) => {
            const data = JSON.stringify(event);
            for (const client of this.clients) {
                if (client.readyState === 1) {
                    client.send(data);
                }
            }
        });
    }
    listTasks = async (req, res, next) => {
        try {
            const { status, assignee, labels, type, sort, limit, offset } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            if (assignee)
                filter.assignee = assignee;
            if (labels)
                filter.labels = labels.split(',');
            if (type)
                filter.type = type;
            let tasks = await this.services.tasks.list(filter);
            if (sort === 'priority') {
                tasks.sort((a, b) => a.priority - b.priority);
            }
            const start = offset ? parseInt(offset, 10) : 0;
            const end = limit ? start + parseInt(limit, 10) : tasks.length;
            tasks = tasks.slice(start, end);
            res.json(tasks);
        }
        catch (err) {
            next(err);
        }
    };
    createTask = async (req, res, next) => {
        try {
            const task = await this.services.tasks.create(req.body);
            res.status(201).json(task);
        }
        catch (err) {
            next(err);
        }
    };
    getTask = async (req, res, next) => {
        try {
            const task = await this.services.tasks.get(req.params.id);
            res.json(task);
        }
        catch (err) {
            next(err);
        }
    };
    updateTask = async (req, res, next) => {
        try {
            const task = await this.services.tasks.update(req.params.id, req.body);
            res.json(task);
        }
        catch (err) {
            next(err);
        }
    };
    deleteTask = async (req, res, next) => {
        try {
            await this.services.tasks.close(req.params.id, 'Deleted');
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    };
    claimTask = async (req, res, next) => {
        try {
            const { actorId } = req.body;
            if (!actorId) {
                res.status(400).json({ error: 'actorId is required' });
                return;
            }
            const task = await this.services.tasks.claim(req.params.id, actorId);
            res.json(task);
        }
        catch (err) {
            next(err);
        }
    };
    closeTask = async (req, res, next) => {
        try {
            const task = await this.services.tasks.close(req.params.id, req.body.reason);
            res.json(task);
        }
        catch (err) {
            next(err);
        }
    };
    reopenTask = async (req, res, next) => {
        try {
            const task = await this.services.tasks.reopen(req.params.id);
            res.json(task);
        }
        catch (err) {
            next(err);
        }
    };
    addComment = async (req, res, next) => {
        try {
            const { actorId, body } = req.body;
            if (!actorId || !body) {
                res.status(400).json({ error: 'actorId and body are required' });
                return;
            }
            const event = await this.services.events.create(req.params.id, actorId, 'commented', { body });
            res.status(201).json(event);
        }
        catch (err) {
            next(err);
        }
    };
    listActors = async (_req, res, next) => {
        try {
            const actors = await this.services.actors.list();
            res.json(actors);
        }
        catch (err) {
            next(err);
        }
    };
    createActor = async (req, res, next) => {
        try {
            const actor = await this.services.actors.create(req.body);
            res.status(201).json(actor);
        }
        catch (err) {
            next(err);
        }
    };
    listEvents = async (req, res, next) => {
        try {
            const { taskId } = req.query;
            const events = await this.services.events.list(taskId);
            res.json(events);
        }
        catch (err) {
            next(err);
        }
    };
    listGates = async (req, res, next) => {
        try {
            const { taskId } = req.query;
            const gates = await this.services.gates.list(taskId);
            res.json(gates);
        }
        catch (err) {
            next(err);
        }
    };
    createGate = async (req, res, next) => {
        try {
            const { taskId, type, reason, awaitId } = req.body;
            if (!taskId || !type) {
                res.status(400).json({ error: 'taskId and type are required' });
                return;
            }
            const gate = await this.services.gates.create(taskId, type, reason, awaitId);
            res.status(201).json(gate);
        }
        catch (err) {
            next(err);
        }
    };
    resolveGate = async (req, res, next) => {
        try {
            const { resolvedBy } = req.body;
            if (!resolvedBy) {
                res.status(400).json({ error: 'resolvedBy is required' });
                return;
            }
            const gate = await this.services.gates.resolve(req.params.id, resolvedBy);
            res.json(gate);
        }
        catch (err) {
            next(err);
        }
    };
    listTemplates = async (_req, res, next) => {
        try {
            const templates = await this.services.templates.list();
            res.json(templates);
        }
        catch (err) {
            next(err);
        }
    };
    getTemplate = async (req, res, next) => {
        try {
            const template = await this.services.templates.get(req.params.name);
            res.json(template);
        }
        catch (err) {
            next(err);
        }
    };
    createTemplate = async (req, res, next) => {
        try {
            const template = await this.services.templates.create(req.body);
            res.status(201).json(template);
        }
        catch (err) {
            next(err);
        }
    };
    pourTemplate = async (req, res, next) => {
        try {
            const { vars } = req.body;
            if (!vars) {
                res.status(400).json({ error: 'vars is required' });
                return;
            }
            const tasks = await this.services.templates.pour(req.params.name, vars);
            res.status(201).json(tasks);
        }
        catch (err) {
            next(err);
        }
    };
    deleteTemplate = async (req, res, next) => {
        try {
            await this.services.templates.delete(req.params.name);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    };
    errorHandler(err, _req, res, _next) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
    listen(port, callback) {
        this.server.listen(port, callback);
    }
}
exports.HttpServer = HttpServer;
//# sourceMappingURL=HttpServer.js.map