"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const SQLiteStorage_js_1 = require("../SQLiteStorage.js");
(0, vitest_1.describe)('SQLiteStorage', () => {
    let storage;
    (0, vitest_1.beforeEach)(() => {
        storage = new SQLiteStorage_js_1.SQLiteStorage(':memory:');
    });
    (0, vitest_1.afterEach)(() => {
        storage.close();
    });
    (0, vitest_1.describe)('Tasks', () => {
        (0, vitest_1.describe)('createTask', () => {
            (0, vitest_1.it)('should create a task', async () => {
                const task = await storage.createTask({
                    title: 'Test Task',
                    description: 'A test task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: ['test'],
                    dependencies: [],
                });
                (0, vitest_1.expect)(task.id).toBeDefined();
                (0, vitest_1.expect)(task.title).toBe('Test Task');
                (0, vitest_1.expect)(task.description).toBe('A test task');
                (0, vitest_1.expect)(task.status).toBe('open');
                (0, vitest_1.expect)(task.priority).toBe(2);
                (0, vitest_1.expect)(task.type).toBe('task');
                (0, vitest_1.expect)(task.labels).toEqual(['test']);
                (0, vitest_1.expect)(task.dependencies).toEqual([]);
                (0, vitest_1.expect)(task.createdAt).toBeDefined();
                (0, vitest_1.expect)(task.updatedAt).toBeDefined();
            });
            (0, vitest_1.it)('should create a task with minimal fields', async () => {
                const task = await storage.createTask({
                    title: 'Minimal Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                (0, vitest_1.expect)(task.title).toBe('Minimal Task');
                (0, vitest_1.expect)(task.description).toBeUndefined();
            });
            (0, vitest_1.it)('should create a task with metadata', async () => {
                const task = await storage.createTask({
                    title: 'Task with Metadata',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                    metadata: { custom: 'value' },
                });
                (0, vitest_1.expect)(task.metadata).toEqual({ custom: 'value' });
            });
        });
        (0, vitest_1.describe)('getTask', () => {
            (0, vitest_1.it)('should get a task by id', async () => {
                const created = await storage.createTask({
                    title: 'Test Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                const task = await storage.getTask(created.id);
                (0, vitest_1.expect)(task).toBeDefined();
                (0, vitest_1.expect)(task?.title).toBe('Test Task');
            });
            (0, vitest_1.it)('should return undefined for non-existent task', async () => {
                const task = await storage.getTask('nonexistent');
                (0, vitest_1.expect)(task).toBeUndefined();
            });
        });
        (0, vitest_1.describe)('listTasks', () => {
            (0, vitest_1.it)('should list all tasks', async () => {
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
                const tasks = await storage.listTasks();
                (0, vitest_1.expect)(tasks).toHaveLength(2);
            });
            (0, vitest_1.it)('should filter by status', async () => {
                await storage.createTask({
                    title: 'Open Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                await storage.createTask({
                    title: 'Closed Task',
                    status: 'closed',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                const openTasks = await storage.listTasks({ status: 'open' });
                (0, vitest_1.expect)(openTasks).toHaveLength(1);
                (0, vitest_1.expect)(openTasks[0].title).toBe('Open Task');
            });
            (0, vitest_1.it)('should filter by assignee', async () => {
                await storage.createTask({
                    title: 'Assigned Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    assignee: 'actor-1',
                    labels: [],
                    dependencies: [],
                });
                await storage.createTask({
                    title: 'Unassigned Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                const assignedTasks = await storage.listTasks({ assignee: 'actor-1' });
                (0, vitest_1.expect)(assignedTasks).toHaveLength(1);
                (0, vitest_1.expect)(assignedTasks[0].title).toBe('Assigned Task');
            });
            (0, vitest_1.it)('should filter by type', async () => {
                await storage.createTask({
                    title: 'Bug Task',
                    status: 'open',
                    priority: 2,
                    type: 'bug',
                    labels: [],
                    dependencies: [],
                });
                await storage.createTask({
                    title: 'Feature Task',
                    status: 'open',
                    priority: 2,
                    type: 'feature',
                    labels: [],
                    dependencies: [],
                });
                const bugs = await storage.listTasks({ type: 'bug' });
                (0, vitest_1.expect)(bugs).toHaveLength(1);
                (0, vitest_1.expect)(bugs[0].title).toBe('Bug Task');
            });
            (0, vitest_1.it)('should filter by labels', async () => {
                await storage.createTask({
                    title: 'Urgent Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: ['urgent', 'bug'],
                    dependencies: [],
                });
                await storage.createTask({
                    title: 'Normal Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: ['normal'],
                    dependencies: [],
                });
                const urgentTasks = await storage.listTasks({ labels: ['urgent'] });
                (0, vitest_1.expect)(urgentTasks).toHaveLength(1);
                (0, vitest_1.expect)(urgentTasks[0].title).toBe('Urgent Task');
            });
            (0, vitest_1.it)('should filter by priority', async () => {
                await storage.createTask({
                    title: 'High Priority',
                    status: 'open',
                    priority: 1,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                await storage.createTask({
                    title: 'Low Priority',
                    status: 'open',
                    priority: 3,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                const highPriority = await storage.listTasks({ priority: 1 });
                (0, vitest_1.expect)(highPriority).toHaveLength(1);
                (0, vitest_1.expect)(highPriority[0].title).toBe('High Priority');
            });
        });
        (0, vitest_1.describe)('updateTask', () => {
            (0, vitest_1.it)('should update a task', async () => {
                const task = await storage.createTask({
                    title: 'Original Title',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                const updated = await storage.updateTask(task.id, {
                    title: 'Updated Title',
                    status: 'in_progress',
                });
                (0, vitest_1.expect)(updated.title).toBe('Updated Title');
                (0, vitest_1.expect)(updated.status).toBe('in_progress');
            });
            (0, vitest_1.it)('should update labels', async () => {
                const task = await storage.createTask({
                    title: 'Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: ['old'],
                    dependencies: [],
                });
                const updated = await storage.updateTask(task.id, {
                    labels: ['new', 'tags'],
                });
                (0, vitest_1.expect)(updated.labels).toEqual(['new', 'tags']);
            });
            (0, vitest_1.it)('should update dependencies', async () => {
                const task = await storage.createTask({
                    title: 'Task',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                const updated = await storage.updateTask(task.id, {
                    dependencies: ['dep-1', 'dep-2'],
                });
                (0, vitest_1.expect)(updated.dependencies).toEqual(['dep-1', 'dep-2']);
            });
            (0, vitest_1.it)('should throw if task not found', async () => {
                await (0, vitest_1.expect)(storage.updateTask('nonexistent', { title: 'Updated' })).rejects.toThrow('Task not found: nonexistent');
            });
        });
        (0, vitest_1.describe)('deleteTask', () => {
            (0, vitest_1.it)('should delete a task', async () => {
                const task = await storage.createTask({
                    title: 'To Delete',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: [],
                    dependencies: [],
                });
                await storage.deleteTask(task.id);
                const found = await storage.getTask(task.id);
                (0, vitest_1.expect)(found).toBeUndefined();
            });
            (0, vitest_1.it)('should delete task labels and dependencies', async () => {
                const task = await storage.createTask({
                    title: 'To Delete',
                    status: 'open',
                    priority: 2,
                    type: 'task',
                    labels: ['test'],
                    dependencies: ['dep-1'],
                });
                await storage.deleteTask(task.id);
                const found = await storage.getTask(task.id);
                (0, vitest_1.expect)(found).toBeUndefined();
            });
        });
    });
    (0, vitest_1.describe)('Actors', () => {
        (0, vitest_1.describe)('createActor', () => {
            (0, vitest_1.it)('should create an actor', async () => {
                const actor = await storage.createActor({
                    name: 'Alice',
                    type: 'human',
                    email: 'alice@example.com',
                });
                (0, vitest_1.expect)(actor.id).toBeDefined();
                (0, vitest_1.expect)(actor.name).toBe('Alice');
                (0, vitest_1.expect)(actor.type).toBe('human');
                (0, vitest_1.expect)(actor.email).toBe('alice@example.com');
            });
        });
        (0, vitest_1.describe)('getActor', () => {
            (0, vitest_1.it)('should get an actor by id', async () => {
                const created = await storage.createActor({
                    name: 'Alice',
                    type: 'human',
                });
                const actor = await storage.getActor(created.id);
                (0, vitest_1.expect)(actor).toBeDefined();
                (0, vitest_1.expect)(actor?.name).toBe('Alice');
            });
            (0, vitest_1.it)('should return undefined for non-existent actor', async () => {
                const actor = await storage.getActor('nonexistent');
                (0, vitest_1.expect)(actor).toBeUndefined();
            });
        });
        (0, vitest_1.describe)('listActors', () => {
            (0, vitest_1.it)('should list all actors', async () => {
                await storage.createActor({ name: 'Alice', type: 'human' });
                await storage.createActor({ name: 'Bob', type: 'agent' });
                const actors = await storage.listActors();
                (0, vitest_1.expect)(actors).toHaveLength(2);
            });
        });
    });
    (0, vitest_1.describe)('Events', () => {
        (0, vitest_1.describe)('createEvent', () => {
            (0, vitest_1.it)('should create an event', async () => {
                const event = await storage.createEvent({
                    taskId: 'task-1',
                    actorId: 'actor-1',
                    type: 'created',
                    payload: { title: 'Task' },
                });
                (0, vitest_1.expect)(event.id).toBeDefined();
                (0, vitest_1.expect)(event.taskId).toBe('task-1');
                (0, vitest_1.expect)(event.actorId).toBe('actor-1');
                (0, vitest_1.expect)(event.type).toBe('created');
                (0, vitest_1.expect)(event.payload).toEqual({ title: 'Task' });
                (0, vitest_1.expect)(event.timestamp).toBeDefined();
            });
        });
        (0, vitest_1.describe)('listEvents', () => {
            (0, vitest_1.it)('should list all events', async () => {
                await storage.createEvent({
                    taskId: 'task-1',
                    actorId: 'actor-1',
                    type: 'created',
                    payload: {},
                });
                await storage.createEvent({
                    taskId: 'task-2',
                    actorId: 'actor-2',
                    type: 'updated',
                    payload: {},
                });
                const events = await storage.listEvents();
                (0, vitest_1.expect)(events).toHaveLength(2);
            });
            (0, vitest_1.it)('should filter events by taskId', async () => {
                await storage.createEvent({
                    taskId: 'task-1',
                    actorId: 'actor-1',
                    type: 'created',
                    payload: {},
                });
                await storage.createEvent({
                    taskId: 'task-2',
                    actorId: 'actor-2',
                    type: 'updated',
                    payload: {},
                });
                const events = await storage.listEvents('task-1');
                (0, vitest_1.expect)(events).toHaveLength(1);
                (0, vitest_1.expect)(events[0].taskId).toBe('task-1');
            });
        });
    });
    (0, vitest_1.describe)('Gates', () => {
        (0, vitest_1.describe)('createGate', () => {
            (0, vitest_1.it)('should create a gate', async () => {
                const gate = await storage.createGate({
                    taskId: 'task-1',
                    type: 'human',
                    reason: 'Needs review',
                });
                (0, vitest_1.expect)(gate.id).toBeDefined();
                (0, vitest_1.expect)(gate.taskId).toBe('task-1');
                (0, vitest_1.expect)(gate.type).toBe('human');
                (0, vitest_1.expect)(gate.reason).toBe('Needs review');
                (0, vitest_1.expect)(gate.status).toBe('open');
                (0, vitest_1.expect)(gate.createdAt).toBeDefined();
            });
        });
        (0, vitest_1.describe)('getGate', () => {
            (0, vitest_1.it)('should get a gate by id', async () => {
                const created = await storage.createGate({
                    taskId: 'task-1',
                    type: 'human',
                });
                const gate = await storage.getGate(created.id);
                (0, vitest_1.expect)(gate).toBeDefined();
                (0, vitest_1.expect)(gate?.taskId).toBe('task-1');
            });
            (0, vitest_1.it)('should return undefined for non-existent gate', async () => {
                const gate = await storage.getGate('nonexistent');
                (0, vitest_1.expect)(gate).toBeUndefined();
            });
        });
        (0, vitest_1.describe)('listGates', () => {
            (0, vitest_1.it)('should list all gates', async () => {
                await storage.createGate({ taskId: 'task-1', type: 'human' });
                await storage.createGate({ taskId: 'task-2', type: 'external' });
                const gates = await storage.listGates();
                (0, vitest_1.expect)(gates).toHaveLength(2);
            });
            (0, vitest_1.it)('should filter gates by taskId', async () => {
                await storage.createGate({ taskId: 'task-1', type: 'human' });
                await storage.createGate({ taskId: 'task-2', type: 'external' });
                const gates = await storage.listGates('task-1');
                (0, vitest_1.expect)(gates).toHaveLength(1);
                (0, vitest_1.expect)(gates[0].taskId).toBe('task-1');
            });
        });
        (0, vitest_1.describe)('resolveGate', () => {
            (0, vitest_1.it)('should resolve a gate', async () => {
                const gate = await storage.createGate({
                    taskId: 'task-1',
                    type: 'human',
                });
                const resolved = await storage.resolveGate(gate.id, 'actor-1');
                (0, vitest_1.expect)(resolved.status).toBe('resolved');
                (0, vitest_1.expect)(resolved.resolvedBy).toBe('actor-1');
                (0, vitest_1.expect)(resolved.resolvedAt).toBeDefined();
            });
            (0, vitest_1.it)('should throw if gate not found', async () => {
                await (0, vitest_1.expect)(storage.resolveGate('nonexistent', 'actor-1')).rejects.toThrow('Gate not found: nonexistent');
            });
        });
    });
    (0, vitest_1.describe)('Templates', () => {
        (0, vitest_1.describe)('createTemplate', () => {
            (0, vitest_1.it)('should create a template', async () => {
                const template = await storage.createTemplate({
                    name: 'my-template',
                    description: 'A template',
                    tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                    variables: ['name'],
                });
                (0, vitest_1.expect)(template.name).toBe('my-template');
                (0, vitest_1.expect)(template.description).toBe('A template');
                (0, vitest_1.expect)(template.tasks).toHaveLength(1);
                (0, vitest_1.expect)(template.variables).toEqual(['name']);
            });
        });
        (0, vitest_1.describe)('getTemplate', () => {
            (0, vitest_1.it)('should get a template by name', async () => {
                await storage.createTemplate({
                    name: 'my-template',
                    tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                    variables: [],
                });
                const template = await storage.getTemplate('my-template');
                (0, vitest_1.expect)(template).toBeDefined();
                (0, vitest_1.expect)(template?.name).toBe('my-template');
            });
            (0, vitest_1.it)('should return undefined for non-existent template', async () => {
                const template = await storage.getTemplate('nonexistent');
                (0, vitest_1.expect)(template).toBeUndefined();
            });
        });
        (0, vitest_1.describe)('listTemplates', () => {
            (0, vitest_1.it)('should list all templates', async () => {
                await storage.createTemplate({
                    name: 'template-1',
                    tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                    variables: [],
                });
                await storage.createTemplate({
                    name: 'template-2',
                    tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                    variables: [],
                });
                const templates = await storage.listTemplates();
                (0, vitest_1.expect)(templates).toHaveLength(2);
            });
        });
        (0, vitest_1.describe)('deleteTemplate', () => {
            (0, vitest_1.it)('should delete a template', async () => {
                await storage.createTemplate({
                    name: 'my-template',
                    tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                    variables: [],
                });
                await storage.deleteTemplate('my-template');
                const found = await storage.getTemplate('my-template');
                (0, vitest_1.expect)(found).toBeUndefined();
            });
        });
    });
    (0, vitest_1.describe)('Edge Cases', () => {
        (0, vitest_1.it)('should handle concurrent operations', async () => {
            const promises = Array.from({ length: 10 }, (_, i) => storage.createTask({
                title: `Task ${i}`,
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            }));
            const tasks = await Promise.all(promises);
            (0, vitest_1.expect)(tasks).toHaveLength(10);
            const allTasks = await storage.listTasks();
            (0, vitest_1.expect)(allTasks).toHaveLength(10);
        });
        (0, vitest_1.it)('should handle special characters in strings', async () => {
            const task = await storage.createTask({
                title: 'Task with "quotes" and \'apostrophes\'',
                description: 'Description with\nnewlines and\ttabs',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            const found = await storage.getTask(task.id);
            (0, vitest_1.expect)(found?.title).toBe('Task with "quotes" and \'apostrophes\'');
            (0, vitest_1.expect)(found?.description).toBe('Description with\nnewlines and\ttabs');
        });
        (0, vitest_1.it)('should handle empty arrays', async () => {
            const task = await storage.createTask({
                title: 'Empty Arrays',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            (0, vitest_1.expect)(task.labels).toEqual([]);
            (0, vitest_1.expect)(task.dependencies).toEqual([]);
        });
        (0, vitest_1.it)('should handle null vs undefined correctly', async () => {
            const task = await storage.createTask({
                title: 'Null Test',
                status: 'open',
                priority: 2,
                type: 'task',
                labels: [],
                dependencies: [],
            });
            (0, vitest_1.expect)(task.description).toBeUndefined();
            (0, vitest_1.expect)(task.assignee).toBeUndefined();
            (0, vitest_1.expect)(task.parentId).toBeUndefined();
            (0, vitest_1.expect)(task.closedAt).toBeUndefined();
            (0, vitest_1.expect)(task.closeReason).toBeUndefined();
            (0, vitest_1.expect)(task.dueAt).toBeUndefined();
            (0, vitest_1.expect)(task.metadata).toBeUndefined();
        });
    });
});
//# sourceMappingURL=SQLiteStorage.test.js.map