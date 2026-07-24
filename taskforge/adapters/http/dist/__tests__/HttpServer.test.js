"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const HttpServer_js_1 = require("../HttpServer.js");
function createMockServices() {
    return {
        tasks: {
            list: vitest_1.vi.fn(async () => [
                { id: 'task-1', title: 'Task 1', status: 'open', priority: 2, type: 'task', labels: [], dependencies: [] },
            ]),
            get: vitest_1.vi.fn(async (id) => ({
                id,
                title: 'Task 1',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            create: vitest_1.vi.fn(async (input) => ({
                ...input,
                id: 'task-1',
                status: 'open',
                priority: input.priority ?? 2,
                type: input.type ?? 'task',
                labels: input.labels ?? [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            update: vitest_1.vi.fn(async (id, patch) => ({
                id,
                ...patch,
                title: patch.title ?? 'Task 1',
                status: patch.status ?? 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            claim: vitest_1.vi.fn(async (id, actorId) => ({
                id,
                title: 'Task 1',
                status: 'in_progress',
                assignee: actorId,
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            close: vitest_1.vi.fn(async (id, reason) => ({
                id,
                title: 'Task 1',
                status: 'closed',
                closeReason: reason,
                closedAt: new Date().toISOString(),
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            reopen: vitest_1.vi.fn(async (id) => ({
                id,
                title: 'Task 1',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            addDependency: vitest_1.vi.fn(async (taskId, dependsOn) => ({
                id: taskId,
                title: 'Task 1',
                status: 'blocked',
                dependencies: [dependsOn],
                priority: 2,
                type: 'task',
                labels: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            removeDependency: vitest_1.vi.fn(async (taskId) => ({
                id: taskId,
                title: 'Task 1',
                status: 'open',
                dependencies: [],
                priority: 2,
                type: 'task',
                labels: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            getDependencies: vitest_1.vi.fn(async () => []),
            getBlocked: vitest_1.vi.fn(async () => []),
        },
        actors: {
            list: vitest_1.vi.fn(async () => [
                { id: 'actor-1', name: 'Alice', type: 'human' },
            ]),
            get: vitest_1.vi.fn(async (id) => ({ id, name: 'Alice', type: 'human' })),
            create: vitest_1.vi.fn(async (input) => ({ ...input, id: 'actor-1' })),
        },
        events: {
            list: vitest_1.vi.fn(async () => [
                { id: 'event-1', taskId: 'task-1', actorId: 'actor-1', type: 'created', payload: {}, timestamp: new Date().toISOString() },
            ]),
            create: vitest_1.vi.fn(async (taskId, actorId, type, payload) => ({
                id: 'event-1',
                taskId,
                actorId,
                type,
                payload,
                timestamp: new Date().toISOString(),
            })),
            subscribe: vitest_1.vi.fn(() => () => { }),
        },
        gates: {
            list: vitest_1.vi.fn(async () => [
                { id: 'gate-1', taskId: 'task-1', type: 'human', status: 'open', createdAt: new Date().toISOString() },
            ]),
            get: vitest_1.vi.fn(async (id) => ({
                id,
                taskId: 'task-1',
                type: 'human',
                status: 'open',
                createdAt: new Date().toISOString(),
            })),
            create: vitest_1.vi.fn(async (taskId, type, reason, awaitId) => ({
                id: 'gate-1',
                taskId,
                type,
                reason,
                awaitId,
                status: 'open',
                createdAt: new Date().toISOString(),
            })),
            resolve: vitest_1.vi.fn(async (id, resolvedBy) => ({
                id,
                taskId: 'task-1',
                type: 'human',
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolvedBy,
                createdAt: new Date().toISOString(),
            })),
        },
        templates: {
            list: vitest_1.vi.fn(async () => [
                { name: 'template-1', tasks: [], variables: [] },
            ]),
            get: vitest_1.vi.fn(async (name) => ({
                name,
                tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: [],
            })),
            create: vitest_1.vi.fn(async (input) => input),
            pour: vitest_1.vi.fn(async (name, vars) => [
                {
                    id: 'task-1',
                    title: 'Poured Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ]),
            delete: vitest_1.vi.fn(async () => { }),
        },
    };
}
(0, vitest_1.describe)('HttpServer', () => {
    let server;
    let services;
    (0, vitest_1.beforeEach)(() => {
        services = createMockServices();
        server = new HttpServer_js_1.HttpServer(services);
    });
    (0, vitest_1.describe)('Tasks', () => {
        (0, vitest_1.it)('should list tasks', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/tasks')
                .expect(200);
            (0, vitest_1.expect)(response.body).toHaveLength(1);
            (0, vitest_1.expect)(response.body[0].title).toBe('Task 1');
        });
        (0, vitest_1.it)('should create a task', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/tasks')
                .send({ title: 'New Task' })
                .expect(201);
            (0, vitest_1.expect)(response.body.title).toBe('New Task');
        });
        (0, vitest_1.it)('should get a task', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/tasks/task-1')
                .expect(200);
            (0, vitest_1.expect)(response.body.id).toBe('task-1');
        });
        (0, vitest_1.it)('should update a task', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .patch('/api/tasks/task-1')
                .send({ title: 'Updated' })
                .expect(200);
            (0, vitest_1.expect)(response.body.title).toBe('Updated');
        });
        (0, vitest_1.it)('should delete a task', async () => {
            await (0, supertest_1.default)(server.app)
                .delete('/api/tasks/task-1')
                .expect(204);
        });
        (0, vitest_1.it)('should claim a task', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/tasks/task-1/claim')
                .send({ actorId: 'actor-1' })
                .expect(200);
            (0, vitest_1.expect)(response.body.assignee).toBe('actor-1');
            (0, vitest_1.expect)(response.body.status).toBe('in_progress');
        });
        (0, vitest_1.it)('should return 400 if actorId missing on claim', async () => {
            await (0, supertest_1.default)(server.app)
                .post('/api/tasks/task-1/claim')
                .send({})
                .expect(400);
        });
        (0, vitest_1.it)('should close a task', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/tasks/task-1/close')
                .send({ reason: 'Done' })
                .expect(200);
            (0, vitest_1.expect)(response.body.status).toBe('closed');
        });
        (0, vitest_1.it)('should reopen a task', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/tasks/task-1/reopen')
                .expect(200);
            (0, vitest_1.expect)(response.body.status).toBe('open');
        });
        (0, vitest_1.it)('should add a comment', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/tasks/task-1/comment')
                .send({ actorId: 'actor-1', body: 'Comment text' })
                .expect(201);
            (0, vitest_1.expect)(response.body.type).toBe('commented');
        });
        (0, vitest_1.it)('should return 400 if comment fields missing', async () => {
            await (0, supertest_1.default)(server.app)
                .post('/api/tasks/task-1/comment')
                .send({})
                .expect(400);
        });
    });
    (0, vitest_1.describe)('Actors', () => {
        (0, vitest_1.it)('should list actors', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/actors')
                .expect(200);
            (0, vitest_1.expect)(response.body).toHaveLength(1);
            (0, vitest_1.expect)(response.body[0].name).toBe('Alice');
        });
        (0, vitest_1.it)('should create an actor', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/actors')
                .send({ name: 'Bob', type: 'agent' })
                .expect(201);
            (0, vitest_1.expect)(response.body.name).toBe('Bob');
        });
    });
    (0, vitest_1.describe)('Events', () => {
        (0, vitest_1.it)('should list events', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/events')
                .expect(200);
            (0, vitest_1.expect)(response.body).toHaveLength(1);
            (0, vitest_1.expect)(response.body[0].type).toBe('created');
        });
        (0, vitest_1.it)('should filter events by taskId', async () => {
            await (0, supertest_1.default)(server.app)
                .get('/api/events?taskId=task-1')
                .expect(200);
            (0, vitest_1.expect)(services.events.list).toHaveBeenCalledWith('task-1');
        });
    });
    (0, vitest_1.describe)('Gates', () => {
        (0, vitest_1.it)('should list gates', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/gates')
                .expect(200);
            (0, vitest_1.expect)(response.body).toHaveLength(1);
            (0, vitest_1.expect)(response.body[0].type).toBe('human');
        });
        (0, vitest_1.it)('should create a gate', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/gates')
                .send({ taskId: 'task-1', type: 'human', reason: 'Review' })
                .expect(201);
            (0, vitest_1.expect)(response.body.taskId).toBe('task-1');
        });
        (0, vitest_1.it)('should return 400 if gate fields missing', async () => {
            await (0, supertest_1.default)(server.app)
                .post('/api/gates')
                .send({})
                .expect(400);
        });
        (0, vitest_1.it)('should resolve a gate', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/gates/gate-1/resolve')
                .send({ resolvedBy: 'actor-1' })
                .expect(200);
            (0, vitest_1.expect)(response.body.status).toBe('resolved');
        });
        (0, vitest_1.it)('should return 400 if resolvedBy missing', async () => {
            await (0, supertest_1.default)(server.app)
                .post('/api/gates/gate-1/resolve')
                .send({})
                .expect(400);
        });
    });
    (0, vitest_1.describe)('Templates', () => {
        (0, vitest_1.it)('should list templates', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/templates')
                .expect(200);
            (0, vitest_1.expect)(response.body).toHaveLength(1);
            (0, vitest_1.expect)(response.body[0].name).toBe('template-1');
        });
        (0, vitest_1.it)('should get a template', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/templates/template-1')
                .expect(200);
            (0, vitest_1.expect)(response.body.name).toBe('template-1');
        });
        (0, vitest_1.it)('should create a template', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/templates')
                .send({
                name: 'new-template',
                tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: [],
            })
                .expect(201);
            (0, vitest_1.expect)(response.body.name).toBe('new-template');
        });
        (0, vitest_1.it)('should pour a template', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .post('/api/templates/template-1/pour')
                .send({ vars: { name: 'test' } })
                .expect(201);
            (0, vitest_1.expect)(response.body).toHaveLength(1);
        });
        (0, vitest_1.it)('should return 400 if vars missing on pour', async () => {
            await (0, supertest_1.default)(server.app)
                .post('/api/templates/template-1/pour')
                .send({})
                .expect(400);
        });
        (0, vitest_1.it)('should delete a template', async () => {
            await (0, supertest_1.default)(server.app)
                .delete('/api/templates/template-1')
                .expect(204);
        });
    });
    (0, vitest_1.describe)('CORS', () => {
        (0, vitest_1.it)('should set CORS headers', async () => {
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/tasks')
                .expect(200);
            (0, vitest_1.expect)(response.headers['access-control-allow-origin']).toBe('*');
            (0, vitest_1.expect)(response.headers['access-control-allow-methods']).toContain('GET');
        });
        (0, vitest_1.it)('should handle OPTIONS preflight', async () => {
            await (0, supertest_1.default)(server.app)
                .options('/api/tasks')
                .expect(204);
        });
    });
    (0, vitest_1.describe)('Error Handling', () => {
        (0, vitest_1.it)('should return 500 on service error', async () => {
            services.tasks.get = vitest_1.vi.fn(async () => {
                throw new Error('Service error');
            });
            const response = await (0, supertest_1.default)(server.app)
                .get('/api/tasks/task-1')
                .expect(500);
            (0, vitest_1.expect)(response.body.error).toBe('Service error');
        });
    });
});
//# sourceMappingURL=HttpServer.test.js.map