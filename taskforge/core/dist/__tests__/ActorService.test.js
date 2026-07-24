"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ActorService_js_1 = require("../services/ActorService.js");
function createMockStorage() {
    const actors = new Map();
    let idCounter = 0;
    return {
        listTasks: vitest_1.vi.fn(async () => []),
        getTask: vitest_1.vi.fn(async () => undefined),
        createTask: vitest_1.vi.fn(async (input) => ({
            ...input,
            id: 'task-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })),
        updateTask: vitest_1.vi.fn(async (id) => ({
            id,
            title: 'Task',
            status: 'open',
            priority: 2,
            type: 'task',
            labels: [],
            dependencies: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })),
        deleteTask: vitest_1.vi.fn(async () => { }),
        listActors: vitest_1.vi.fn(async () => Array.from(actors.values())),
        getActor: vitest_1.vi.fn(async (id) => actors.get(id)),
        createActor: vitest_1.vi.fn(async (input) => {
            const actor = { ...input, id: `actor-${++idCounter}` };
            actors.set(actor.id, actor);
            return actor;
        }),
        listEvents: vitest_1.vi.fn(async () => []),
        createEvent: vitest_1.vi.fn(async (input) => ({
            ...input,
            id: 'event-1',
            timestamp: new Date().toISOString(),
        })),
        listGates: vitest_1.vi.fn(async () => []),
        getGate: vitest_1.vi.fn(async () => undefined),
        createGate: vitest_1.vi.fn(async (input) => ({
            ...input,
            id: 'gate-1',
            status: 'open',
            createdAt: new Date().toISOString(),
        })),
        resolveGate: vitest_1.vi.fn(async (id, resolvedBy) => ({
            id,
            taskId: 'task-1',
            type: 'human',
            status: 'resolved',
            createdAt: new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
            resolvedBy,
        })),
        listTemplates: vitest_1.vi.fn(async () => []),
        getTemplate: vitest_1.vi.fn(async () => undefined),
        createTemplate: vitest_1.vi.fn(async (input) => input),
        deleteTemplate: vitest_1.vi.fn(async () => { }),
    };
}
(0, vitest_1.describe)('ActorService', () => {
    let storage;
    let service;
    (0, vitest_1.beforeEach)(() => {
        storage = createMockStorage();
        service = new ActorService_js_1.ActorService(storage);
    });
    (0, vitest_1.describe)('list', () => {
        (0, vitest_1.it)('should return all actors', async () => {
            await service.create({ name: 'Alice', type: 'human' });
            await service.create({ name: 'Bob', type: 'agent' });
            const actors = await service.list();
            (0, vitest_1.expect)(actors).toHaveLength(2);
        });
        (0, vitest_1.it)('should return empty array when no actors', async () => {
            const actors = await service.list();
            (0, vitest_1.expect)(actors).toEqual([]);
        });
    });
    (0, vitest_1.describe)('get', () => {
        (0, vitest_1.it)('should return an actor by id', async () => {
            const created = await service.create({ name: 'Alice', type: 'human' });
            const actor = await service.get(created.id);
            (0, vitest_1.expect)(actor?.name).toBe('Alice');
        });
        (0, vitest_1.it)('should return undefined for non-existent actor', async () => {
            const actor = await service.get('nonexistent');
            (0, vitest_1.expect)(actor).toBeUndefined();
        });
    });
    (0, vitest_1.describe)('create', () => {
        (0, vitest_1.it)('should create an actor', async () => {
            const actor = await service.create({ name: 'Alice', type: 'human' });
            (0, vitest_1.expect)(actor.name).toBe('Alice');
            (0, vitest_1.expect)(actor.type).toBe('human');
            (0, vitest_1.expect)(actor.id).toBeDefined();
        });
        (0, vitest_1.it)('should create an actor with email', async () => {
            const actor = await service.create({
                name: 'Bob',
                type: 'agent',
                email: 'bob@example.com',
            });
            (0, vitest_1.expect)(actor.email).toBe('bob@example.com');
        });
    });
});
//# sourceMappingURL=ActorService.test.js.map