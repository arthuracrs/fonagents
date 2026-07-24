"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const TaskService_js_1 = require("../services/TaskService.js");
function createMockStorage() {
    const tasks = new Map();
    let idCounter = 0;
    return {
        listTasks: vitest_1.vi.fn(async (filter) => {
            let result = Array.from(tasks.values());
            if (filter?.status)
                result = result.filter(t => t.status === filter.status);
            if (filter?.assignee)
                result = result.filter(t => t.assignee === filter.assignee);
            if (filter?.type)
                result = result.filter(t => t.type === filter.type);
            return result;
        }),
        getTask: vitest_1.vi.fn(async (id) => tasks.get(id)),
        createTask: vitest_1.vi.fn(async (input) => {
            const task = {
                ...input,
                id: `task-${++idCounter}`,
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
        deleteTask: vitest_1.vi.fn(async (id) => {
            tasks.delete(id);
        }),
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
(0, vitest_1.describe)('TaskService', () => {
    let storage;
    let eventBus;
    let service;
    (0, vitest_1.beforeEach)(() => {
        storage = createMockStorage();
        eventBus = createMockEventBus();
        service = new TaskService_js_1.TaskService(storage, eventBus);
    });
    (0, vitest_1.describe)('list', () => {
        (0, vitest_1.it)('should return all tasks', async () => {
            await service.create({ title: 'Task 1' });
            await service.create({ title: 'Task 2' });
            const tasks = await service.list();
            (0, vitest_1.expect)(tasks).toHaveLength(2);
        });
        (0, vitest_1.it)('should filter tasks by status', async () => {
            await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.claim(task2.id, 'actor-1');
            const openTasks = await service.list({ status: 'open' });
            (0, vitest_1.expect)(openTasks).toHaveLength(1);
            (0, vitest_1.expect)(openTasks[0].title).toBe('Task 1');
        });
    });
    (0, vitest_1.describe)('get', () => {
        (0, vitest_1.it)('should return a task by id', async () => {
            const created = await service.create({ title: 'Test Task' });
            const task = await service.get(created.id);
            (0, vitest_1.expect)(task.title).toBe('Test Task');
        });
        (0, vitest_1.it)('should throw if task not found', async () => {
            await (0, vitest_1.expect)(service.get('nonexistent')).rejects.toThrow('Task nonexistent not found');
        });
    });
    (0, vitest_1.describe)('create', () => {
        (0, vitest_1.it)('should create a task with defaults', async () => {
            const task = await service.create({ title: 'New Task' });
            (0, vitest_1.expect)(task.title).toBe('New Task');
            (0, vitest_1.expect)(task.status).toBe('open');
            (0, vitest_1.expect)(task.priority).toBe(2);
            (0, vitest_1.expect)(task.type).toBe('task');
            (0, vitest_1.expect)(task.labels).toEqual([]);
            (0, vitest_1.expect)(task.dependencies).toEqual([]);
        });
        (0, vitest_1.it)('should create a task with custom values', async () => {
            const task = await service.create({
                title: 'Custom Task',
                description: 'A custom task',
                priority: 1,
                type: 'feature',
                labels: ['urgent'],
            });
            (0, vitest_1.expect)(task.priority).toBe(1);
            (0, vitest_1.expect)(task.type).toBe('feature');
            (0, vitest_1.expect)(task.labels).toEqual(['urgent']);
        });
        (0, vitest_1.it)('should emit task_created event', async () => {
            await service.create({ title: 'Event Task' });
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'task_created' }));
        });
    });
    (0, vitest_1.describe)('update', () => {
        (0, vitest_1.it)('should update task fields', async () => {
            const task = await service.create({ title: 'Original' });
            const updated = await service.update(task.id, { title: 'Updated' });
            (0, vitest_1.expect)(updated.title).toBe('Updated');
        });
        (0, vitest_1.it)('should validate status transitions', async () => {
            const task = await service.create({ title: 'Task' });
            await service.close(task.id);
            await (0, vitest_1.expect)(service.update(task.id, { status: 'in_progress' })).rejects.toThrow('Invalid status transition: closed → in_progress');
        });
        (0, vitest_1.it)('should emit task_updated event', async () => {
            const task = await service.create({ title: 'Task' });
            await service.update(task.id, { title: 'Updated' });
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'task_updated' }));
        });
    });
    (0, vitest_1.describe)('claim', () => {
        (0, vitest_1.it)('should assign actor and set status to in_progress', async () => {
            const task = await service.create({ title: 'Task' });
            const claimed = await service.claim(task.id, 'actor-1');
            (0, vitest_1.expect)(claimed.assignee).toBe('actor-1');
            (0, vitest_1.expect)(claimed.status).toBe('in_progress');
        });
        (0, vitest_1.it)('should emit task_claimed event', async () => {
            const task = await service.create({ title: 'Task' });
            await service.claim(task.id, 'actor-1');
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'task_claimed', actorId: 'actor-1' }));
        });
        (0, vitest_1.it)('should throw if task is closed', async () => {
            const task = await service.create({ title: 'Task' });
            await service.close(task.id);
            await (0, vitest_1.expect)(service.claim(task.id, 'actor-1')).rejects.toThrow('Invalid status transition: closed → in_progress');
        });
    });
    (0, vitest_1.describe)('close', () => {
        (0, vitest_1.it)('should close a task with reason', async () => {
            const task = await service.create({ title: 'Task' });
            const closed = await service.close(task.id, 'Done');
            (0, vitest_1.expect)(closed.status).toBe('closed');
            (0, vitest_1.expect)(closed.closeReason).toBe('Done');
            (0, vitest_1.expect)(closed.closedAt).toBeDefined();
        });
        (0, vitest_1.it)('should emit task_closed event', async () => {
            const task = await service.create({ title: 'Task' });
            await service.close(task.id, 'Done');
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'task_closed', reason: 'Done' }));
        });
        (0, vitest_1.it)('should throw if already closed', async () => {
            const task = await service.create({ title: 'Task' });
            await service.close(task.id);
            await (0, vitest_1.expect)(service.close(task.id)).rejects.toThrow('Invalid status transition: closed → closed');
        });
    });
    (0, vitest_1.describe)('reopen', () => {
        (0, vitest_1.it)('should reopen a closed task', async () => {
            const task = await service.create({ title: 'Task' });
            await service.close(task.id);
            const reopened = await service.reopen(task.id);
            (0, vitest_1.expect)(reopened.status).toBe('open');
            (0, vitest_1.expect)(reopened.closedAt).toBeUndefined();
            (0, vitest_1.expect)(reopened.closeReason).toBeUndefined();
        });
        (0, vitest_1.it)('should emit task_reopened event', async () => {
            const task = await service.create({ title: 'Task' });
            await service.close(task.id);
            await service.reopen(task.id);
            (0, vitest_1.expect)(eventBus.emit).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: 'task_reopened' }));
        });
        (0, vitest_1.it)('should throw if task is not closed', async () => {
            const task = await service.create({ title: 'Task' });
            await (0, vitest_1.expect)(service.reopen(task.id)).rejects.toThrow('Invalid status transition: open → open');
        });
    });
    (0, vitest_1.describe)('dependencies', () => {
        (0, vitest_1.it)('should add a dependency', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            const updated = await service.addDependency(task2.id, task1.id);
            (0, vitest_1.expect)(updated.dependencies).toContain(task1.id);
        });
        (0, vitest_1.it)('should block task when adding open dependency', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            const updated = await service.addDependency(task2.id, task1.id);
            (0, vitest_1.expect)(updated.status).toBe('blocked');
        });
        (0, vitest_1.it)('should not block if dependency is closed', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            await service.close(task1.id);
            const task2 = await service.create({ title: 'Task 2' });
            const updated = await service.addDependency(task2.id, task1.id);
            (0, vitest_1.expect)(updated.status).toBe('open');
        });
        (0, vitest_1.it)('should not add duplicate dependency', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.addDependency(task2.id, task1.id);
            const result = await service.addDependency(task2.id, task1.id);
            (0, vitest_1.expect)(result.dependencies).toHaveLength(1);
        });
        (0, vitest_1.it)('should remove a dependency', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.addDependency(task2.id, task1.id);
            const updated = await service.removeDependency(task2.id, task1.id);
            (0, vitest_1.expect)(updated.dependencies).not.toContain(task1.id);
        });
        (0, vitest_1.it)('should unblock task when all dependencies removed', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.addDependency(task2.id, task1.id);
            const updated = await service.removeDependency(task2.id, task1.id);
            (0, vitest_1.expect)(updated.status).toBe('open');
        });
        (0, vitest_1.it)('should get dependencies', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.addDependency(task2.id, task1.id);
            const deps = await service.getDependencies(task2.id);
            (0, vitest_1.expect)(deps).toHaveLength(1);
            (0, vitest_1.expect)(deps[0].id).toBe(task1.id);
        });
        (0, vitest_1.it)('should get blocked tasks', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.addDependency(task2.id, task1.id);
            const blocked = await service.getBlocked();
            (0, vitest_1.expect)(blocked).toHaveLength(1);
            (0, vitest_1.expect)(blocked[0].id).toBe(task2.id);
        });
    });
    (0, vitest_1.describe)('unblockDependents', () => {
        (0, vitest_1.it)('should unblock dependents when dependency is closed', async () => {
            const task1 = await service.create({ title: 'Task 1' });
            const task2 = await service.create({ title: 'Task 2' });
            await service.addDependency(task2.id, task1.id);
            // Override listTasks to return blocked tasks for unblockDependents
            const originalListTasks = storage.listTasks;
            storage.listTasks = vitest_1.vi.fn(async (filter) => {
                if (filter?.status === 'blocked') {
                    // Return task2 with its dependencies
                    return [{
                            ...task2,
                            status: 'blocked',
                            dependencies: [task1.id],
                        }];
                }
                return originalListTasks(filter);
            });
            await service.close(task1.id);
            // Should have called updateTask to unblock task2
            (0, vitest_1.expect)(storage.updateTask).toHaveBeenCalledWith(task2.id, vitest_1.expect.objectContaining({ status: 'open' }));
        });
    });
});
//# sourceMappingURL=TaskService.test.js.map