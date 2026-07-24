"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const TemplateService_js_1 = require("../services/TemplateService.js");
function createMockStorage() {
    const templates = new Map();
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
        listTemplates: vitest_1.vi.fn(async () => Array.from(templates.values())),
        getTemplate: vitest_1.vi.fn(async (name) => templates.get(name)),
        createTemplate: vitest_1.vi.fn(async (input) => {
            templates.set(input.name, input);
            return input;
        }),
        deleteTemplate: vitest_1.vi.fn(async (name) => { templates.delete(name); }),
    };
}
function createMockTaskService() {
    const tasks = [];
    let idCounter = 0;
    return {
        list: vitest_1.vi.fn(async () => tasks),
        get: vitest_1.vi.fn(async (id) => {
            const task = tasks.find(t => t.id === id);
            if (!task)
                throw new Error(`Task ${id} not found`);
            return task;
        }),
        create: vitest_1.vi.fn(async (input) => {
            const task = {
                ...input,
                id: `task-${++idCounter}`,
                status: 'open',
                priority: input.priority ?? 2,
                type: input.type ?? 'task',
                labels: input.labels ?? [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            tasks.push(task);
            return task;
        }),
        update: vitest_1.vi.fn(async (id, patch) => {
            const task = tasks.find(t => t.id === id);
            if (!task)
                throw new Error(`Task ${id} not found`);
            Object.assign(task, patch);
            return task;
        }),
        claim: vitest_1.vi.fn(async (id, actorId) => {
            const task = tasks.find(t => t.id === id);
            if (!task)
                throw new Error(`Task ${id} not found`);
            task.assignee = actorId;
            task.status = 'in_progress';
            return task;
        }),
        close: vitest_1.vi.fn(async (id, reason) => {
            const task = tasks.find(t => t.id === id);
            if (!task)
                throw new Error(`Task ${id} not found`);
            task.status = 'closed';
            task.closedAt = new Date().toISOString();
            task.closeReason = reason;
            return task;
        }),
        reopen: vitest_1.vi.fn(async (id) => {
            const task = tasks.find(t => t.id === id);
            if (!task)
                throw new Error(`Task ${id} not found`);
            task.status = 'open';
            task.closedAt = undefined;
            task.closeReason = undefined;
            return task;
        }),
        addDependency: vitest_1.vi.fn(async (taskId, dependsOn) => {
            const task = tasks.find(t => t.id === taskId);
            if (!task)
                throw new Error(`Task ${taskId} not found`);
            if (!task.dependencies.includes(dependsOn)) {
                task.dependencies.push(dependsOn);
            }
            return task;
        }),
        removeDependency: vitest_1.vi.fn(async (taskId, dependsOn) => {
            const task = tasks.find(t => t.id === taskId);
            if (!task)
                throw new Error(`Task ${taskId} not found`);
            task.dependencies = task.dependencies.filter(d => d !== dependsOn);
            return task;
        }),
        getDependencies: vitest_1.vi.fn(async (id) => {
            const task = tasks.find(t => t.id === id);
            if (!task)
                throw new Error(`Task ${id} not found`);
            return tasks.filter(t => task.dependencies.includes(t.id));
        }),
        getBlocked: vitest_1.vi.fn(async () => tasks.filter(t => t.status === 'blocked')),
    };
}
(0, vitest_1.describe)('TemplateService', () => {
    let storage;
    let taskService;
    let service;
    (0, vitest_1.beforeEach)(() => {
        storage = createMockStorage();
        taskService = createMockTaskService();
        service = new TemplateService_js_1.TemplateService(storage, taskService);
    });
    (0, vitest_1.describe)('list', () => {
        (0, vitest_1.it)('should return all templates', async () => {
            await service.create({
                name: 'template1',
                tasks: [{ title: 'Task 1', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: [],
            });
            await service.create({
                name: 'template2',
                tasks: [{ title: 'Task 2', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: [],
            });
            const templates = await service.list();
            (0, vitest_1.expect)(templates).toHaveLength(2);
        });
    });
    (0, vitest_1.describe)('get', () => {
        (0, vitest_1.it)('should return a template by name', async () => {
            await service.create({
                name: 'my-template',
                tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: [],
            });
            const template = await service.get('my-template');
            (0, vitest_1.expect)(template.name).toBe('my-template');
        });
        (0, vitest_1.it)('should throw if template not found', async () => {
            await (0, vitest_1.expect)(service.get('nonexistent')).rejects.toThrow('Template "nonexistent" not found');
        });
    });
    (0, vitest_1.describe)('create', () => {
        (0, vitest_1.it)('should create a template', async () => {
            const template = await service.create({
                name: 'my-template',
                description: 'A template',
                tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: ['name'],
            });
            (0, vitest_1.expect)(template.name).toBe('my-template');
            (0, vitest_1.expect)(template.description).toBe('A template');
        });
    });
    (0, vitest_1.describe)('delete', () => {
        (0, vitest_1.it)('should delete a template', async () => {
            await service.create({
                name: 'my-template',
                tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: [],
            });
            await service.delete('my-template');
            (0, vitest_1.expect)(storage.deleteTemplate).toHaveBeenCalledWith('my-template');
        });
        (0, vitest_1.it)('should throw if template not found', async () => {
            await (0, vitest_1.expect)(service.delete('nonexistent')).rejects.toThrow('Template "nonexistent" not found');
        });
    });
    (0, vitest_1.describe)('pour', () => {
        (0, vitest_1.it)('should create tasks from template', async () => {
            await service.create({
                name: 'feature',
                tasks: [
                    { title: 'Implement {{feature}}', type: 'feature', priority: 1, labels: [], dependencies: [] },
                    { title: 'Test {{feature}}', type: 'task', priority: 2, labels: [], dependencies: [] },
                ],
                variables: ['feature'],
            });
            const tasks = await service.pour('feature', { feature: 'auth' });
            (0, vitest_1.expect)(tasks).toHaveLength(2);
            (0, vitest_1.expect)(tasks[0].title).toBe('Implement auth');
            (0, vitest_1.expect)(tasks[1].title).toBe('Test auth');
        });
        (0, vitest_1.it)('should substitute variables in description', async () => {
            await service.create({
                name: 'feature',
                tasks: [
                    {
                        title: 'Implement {{feature}}',
                        description: 'Add {{feature}} functionality',
                        type: 'feature',
                        priority: 1,
                        labels: [],
                        dependencies: [],
                    },
                ],
                variables: ['feature'],
            });
            const tasks = await service.pour('feature', { feature: 'auth' });
            (0, vitest_1.expect)(tasks[0].description).toBe('Add auth functionality');
        });
        (0, vitest_1.it)('should throw if missing variables', async () => {
            await service.create({
                name: 'feature',
                tasks: [{ title: 'Implement {{feature}}', type: 'task', priority: 2, labels: [], dependencies: [] }],
                variables: ['feature'],
            });
            await (0, vitest_1.expect)(service.pour('feature', {})).rejects.toThrow('Missing required variables: feature');
        });
        (0, vitest_1.it)('should add dependencies between created tasks', async () => {
            await service.create({
                name: 'feature',
                tasks: [
                    { title: 'Task 1', type: 'task', priority: 2, labels: [], dependencies: [] },
                    { title: 'Task 2', type: 'task', priority: 2, labels: [], dependencies: ['0'] },
                ],
                variables: [],
            });
            await service.pour('feature', {});
            (0, vitest_1.expect)(taskService.addDependency).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should throw for invalid dependency reference', async () => {
            await service.create({
                name: 'feature',
                tasks: [
                    { title: 'Task 1', type: 'task', priority: 2, labels: [], dependencies: ['5'] },
                ],
                variables: [],
            });
            await (0, vitest_1.expect)(service.pour('feature', {})).rejects.toThrow('Invalid dependency reference "5" in template task 0');
        });
    });
});
//# sourceMappingURL=TemplateService.test.js.map