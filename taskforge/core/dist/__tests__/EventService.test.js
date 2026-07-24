"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const EventService_js_1 = require("../services/EventService.js");
function createMockStorage() {
    const events = [];
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
        listActors: vitest_1.vi.fn(async () => []),
        getActor: vitest_1.vi.fn(async () => undefined),
        createActor: vitest_1.vi.fn(async (input) => ({ ...input, id: 'actor-1' })),
        listEvents: vitest_1.vi.fn(async (taskId) => {
            if (taskId)
                return events.filter(e => e.taskId === taskId);
            return events;
        }),
        createEvent: vitest_1.vi.fn(async (input) => {
            const event = {
                ...input,
                id: `event-${++idCounter}`,
                timestamp: new Date().toISOString(),
            };
            events.push(event);
            return event;
        }),
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
function createMockEventBus() {
    const handlers = [];
    return {
        emit: vitest_1.vi.fn((event) => handlers.forEach(h => h(event))),
        subscribe: vitest_1.vi.fn((handler) => {
            handlers.push(handler);
            return () => {
                const index = handlers.indexOf(handler);
                if (index > -1)
                    handlers.splice(index, 1);
            };
        }),
    };
}
(0, vitest_1.describe)('EventService', () => {
    let storage;
    let eventBus;
    let service;
    (0, vitest_1.beforeEach)(() => {
        storage = createMockStorage();
        eventBus = createMockEventBus();
        service = new EventService_js_1.EventService(storage, eventBus);
    });
    (0, vitest_1.describe)('list', () => {
        (0, vitest_1.it)('should return all events', async () => {
            await service.create('task-1', 'actor-1', 'created', { title: 'Task' });
            await service.create('task-2', 'actor-2', 'updated', { status: 'open' });
            const events = await service.list();
            (0, vitest_1.expect)(events).toHaveLength(2);
        });
        (0, vitest_1.it)('should filter events by taskId', async () => {
            await service.create('task-1', 'actor-1', 'created', { title: 'Task 1' });
            await service.create('task-2', 'actor-2', 'created', { title: 'Task 2' });
            const events = await service.list('task-1');
            (0, vitest_1.expect)(events).toHaveLength(1);
            (0, vitest_1.expect)(events[0].taskId).toBe('task-1');
        });
    });
    (0, vitest_1.describe)('create', () => {
        (0, vitest_1.it)('should create an event', async () => {
            const event = await service.create('task-1', 'actor-1', 'created', { title: 'Task' });
            (0, vitest_1.expect)(event.taskId).toBe('task-1');
            (0, vitest_1.expect)(event.actorId).toBe('actor-1');
            (0, vitest_1.expect)(event.type).toBe('created');
            (0, vitest_1.expect)(event.payload).toEqual({ title: 'Task' });
            (0, vitest_1.expect)(event.id).toBeDefined();
            (0, vitest_1.expect)(event.timestamp).toBeDefined();
        });
        (0, vitest_1.it)('should emit comment_added event', async () => {
            await service.create('task-1', 'actor-1', 'commented', { body: 'Hello' });
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                type: 'comment_added',
                taskId: 'task-1',
            }));
        });
    });
    (0, vitest_1.describe)('subscribe', () => {
        (0, vitest_1.it)('should subscribe to events', async () => {
            const handler = vitest_1.vi.fn();
            service.subscribe(handler);
            await service.create('task-1', 'actor-1', 'created', {});
            (0, vitest_1.expect)(handler).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should unsubscribe', async () => {
            const handler = vitest_1.vi.fn();
            const unsubscribe = service.subscribe(handler);
            unsubscribe();
            await service.create('task-1', 'actor-1', 'created', {});
            (0, vitest_1.expect)(handler).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=EventService.test.js.map