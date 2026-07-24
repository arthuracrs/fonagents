"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const GateService_js_1 = require("../services/GateService.js");
function createMockStorage() {
    const gates = new Map();
    const tasks = new Map();
    let gateIdCounter = 0;
    let taskIdCounter = 0;
    return {
        listTasks: vitest_1.vi.fn(async () => []),
        getTask: vitest_1.vi.fn(async (id) => tasks.get(id)),
        createTask: vitest_1.vi.fn(async (input) => {
            const task = {
                ...input,
                id: `task-${++taskIdCounter}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            tasks.set(task.id, task);
            return task;
        }),
        updateTask: vitest_1.vi.fn(async (id, patch) => {
            const existing = tasks.get(id);
            if (!existing)
                throw new Error(`Task not found: ${id}`);
            const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
            tasks.set(id, updated);
            return updated;
        }),
        deleteTask: vitest_1.vi.fn(async (id) => { tasks.delete(id); }),
        listActors: vitest_1.vi.fn(async () => []),
        getActor: vitest_1.vi.fn(async () => undefined),
        createActor: vitest_1.vi.fn(async (input) => ({ ...input, id: 'actor-1' })),
        listEvents: vitest_1.vi.fn(async () => []),
        createEvent: vitest_1.vi.fn(async (input) => ({
            ...input,
            id: 'event-1',
            timestamp: new Date().toISOString(),
        })),
        listGates: vitest_1.vi.fn(async (taskId) => {
            const allGates = Array.from(gates.values());
            if (taskId)
                return allGates.filter(g => g.taskId === taskId);
            return allGates;
        }),
        getGate: vitest_1.vi.fn(async (id) => gates.get(id)),
        createGate: vitest_1.vi.fn(async (input) => {
            const gate = {
                ...input,
                id: `gate-${++gateIdCounter}`,
                status: 'open',
                createdAt: new Date().toISOString(),
            };
            gates.set(gate.id, gate);
            return gate;
        }),
        resolveGate: vitest_1.vi.fn(async (id, resolvedBy) => {
            const existing = gates.get(id);
            if (!existing)
                throw new Error(`Gate not found: ${id}`);
            const resolved = {
                ...existing,
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolvedBy,
            };
            gates.set(id, resolved);
            return resolved;
        }),
        listTemplates: vitest_1.vi.fn(async () => []),
        getTemplate: vitest_1.vi.fn(async () => undefined),
        createTemplate: vitest_1.vi.fn(async (input) => input),
        deleteTemplate: vitest_1.vi.fn(async () => { }),
    };
}
function createMockEventBus() {
    return {
        emit: vitest_1.vi.fn(),
        subscribe: vitest_1.vi.fn(() => () => { }),
    };
}
(0, vitest_1.describe)('GateService', () => {
    let storage;
    let eventBus;
    let service;
    (0, vitest_1.beforeEach)(() => {
        storage = createMockStorage();
        eventBus = createMockEventBus();
        service = new GateService_js_1.GateService(storage, eventBus);
    });
    (0, vitest_1.describe)('list', () => {
        (0, vitest_1.it)('should return all gates', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            await service.create('task-1', 'human');
            await service.create('task-1', 'external');
            const gates = await service.list();
            (0, vitest_1.expect)(gates).toHaveLength(2);
        });
        (0, vitest_1.it)('should filter gates by taskId', async () => {
            await storage.createTask({
                title: 'Task 1',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            await storage.createTask({
                title: 'Task 2',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            await service.create('task-1', 'human');
            await service.create('task-2', 'external');
            const gates = await service.list('task-1');
            (0, vitest_1.expect)(gates).toHaveLength(1);
            (0, vitest_1.expect)(gates[0].taskId).toBe('task-1');
        });
    });
    (0, vitest_1.describe)('get', () => {
        (0, vitest_1.it)('should return a gate by id', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const created = await service.create('task-1', 'human');
            const gate = await service.get(created.id);
            (0, vitest_1.expect)(gate?.taskId).toBe('task-1');
        });
        (0, vitest_1.it)('should return undefined for non-existent gate', async () => {
            const gate = await service.get('nonexistent');
            (0, vitest_1.expect)(gate).toBeUndefined();
        });
    });
    (0, vitest_1.describe)('create', () => {
        (0, vitest_1.it)('should create a gate', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const gate = await service.create('task-1', 'human', 'Needs review');
            (0, vitest_1.expect)(gate.taskId).toBe('task-1');
            (0, vitest_1.expect)(gate.type).toBe('human');
            (0, vitest_1.expect)(gate.reason).toBe('Needs review');
            (0, vitest_1.expect)(gate.status).toBe('open');
        });
        (0, vitest_1.it)('should block the task', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            await service.create('task-1', 'human');
            (0, vitest_1.expect)(storage.updateTask).toHaveBeenCalledWith('task-1', vitest_1.expect.objectContaining({ status: 'blocked' }));
        });
        (0, vitest_1.it)('should emit gate_opened event', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            await service.create('task-1', 'human');
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'gate_opened' }));
        });
    });
    (0, vitest_1.describe)('resolve', () => {
        (0, vitest_1.it)('should resolve a gate', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const gate = await service.create('task-1', 'human');
            const resolved = await service.resolve(gate.id, 'actor-1');
            (0, vitest_1.expect)(resolved.status).toBe('resolved');
            (0, vitest_1.expect)(resolved.resolvedBy).toBe('actor-1');
            (0, vitest_1.expect)(resolved.resolvedAt).toBeDefined();
        });
        (0, vitest_1.it)('should emit gate_resolved event', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const gate = await service.create('task-1', 'human');
            await service.resolve(gate.id, 'actor-1');
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'gate_resolved', gateId: gate.id }));
        });
        (0, vitest_1.it)('should unblock task when all gates resolved', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const gate = await service.create('task-1', 'human');
            await service.resolve(gate.id, 'actor-1');
            (0, vitest_1.expect)(storage.updateTask).toHaveBeenCalledWith('task-1', vitest_1.expect.objectContaining({ status: 'open' }));
        });
        (0, vitest_1.it)('should not unblock task if other gates remain open', async () => {
            await storage.createTask({
                title: 'Task',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const gate1 = await service.create('task-1', 'human');
            await service.create('task-1', 'external');
            // Reset mock to track only resolve calls
            vitest_1.vi.mocked(storage.updateTask).mockClear();
            await service.resolve(gate1.id, 'actor-1');
            // Should not have called updateTask to unblock
            (0, vitest_1.expect)(storage.updateTask).not.toHaveBeenCalledWith('task-1', vitest_1.expect.objectContaining({ status: 'open' }));
        });
    });
});
//# sourceMappingURL=GateService.test.js.map