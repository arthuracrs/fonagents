"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const VALID_TRANSITIONS = {
    open: ['in_progress', 'blocked', 'deferred', 'closed'],
    in_progress: ['open', 'blocked', 'deferred', 'closed'],
    blocked: ['open', 'in_progress', 'deferred', 'closed'],
    deferred: ['open', 'in_progress', 'blocked', 'closed'],
    closed: ['open'],
};
class TaskService {
    storage;
    events;
    constructor(storage, events) {
        this.storage = storage;
        this.events = events;
    }
    async list(filter) {
        return this.storage.listTasks(filter);
    }
    async get(id) {
        const task = await this.storage.getTask(id);
        if (!task)
            throw new Error(`Task ${id} not found`);
        return task;
    }
    async create(input) {
        const task = await this.storage.createTask({
            title: input.title,
            description: input.description,
            status: 'open',
            priority: input.priority ?? 2,
            type: input.type ?? 'task',
            assignee: input.assignee,
            labels: input.labels ?? [],
            parentId: input.parentId,
            dependencies: [],
            dueAt: input.dueAt,
            metadata: input.metadata,
        });
        this.events.emit({ type: 'task_created', task });
        return task;
    }
    async update(id, patch) {
        const existing = await this.get(id);
        if (patch.status) {
            this.assertTransition(existing.status, patch.status);
        }
        const task = await this.storage.updateTask(id, patch);
        this.events.emit({ type: 'task_updated', task, changes: patch });
        return task;
    }
    async claim(id, actorId) {
        const existing = await this.get(id);
        this.assertTransition(existing.status, 'in_progress');
        const task = await this.storage.updateTask(id, {
            assignee: actorId,
            status: 'in_progress',
        });
        this.events.emit({ type: 'task_claimed', task, actorId });
        return task;
    }
    async close(id, reason) {
        const existing = await this.get(id);
        this.assertTransition(existing.status, 'closed');
        const task = await this.storage.updateTask(id, {
            status: 'closed',
            closedAt: new Date().toISOString(),
            closeReason: reason,
        });
        this.events.emit({ type: 'task_closed', task, reason });
        await this.unblockDependents(id);
        return task;
    }
    async reopen(id) {
        const existing = await this.get(id);
        this.assertTransition(existing.status, 'open');
        const task = await this.storage.updateTask(id, {
            status: 'open',
            closedAt: undefined,
            closeReason: undefined,
        });
        this.events.emit({ type: 'task_reopened', task });
        return task;
    }
    async addDependency(taskId, dependsOn) {
        const task = await this.get(taskId);
        await this.get(dependsOn);
        if (task.dependencies.includes(dependsOn)) {
            return task;
        }
        const dependency = await this.storage.getTask(dependsOn);
        const shouldBlock = dependency && dependency.status !== 'closed';
        const patch = {
            dependencies: [...task.dependencies, dependsOn],
        };
        if (shouldBlock && task.status !== 'blocked') {
            this.assertTransition(task.status, 'blocked');
            patch.status = 'blocked';
        }
        return this.storage.updateTask(taskId, patch);
    }
    async removeDependency(taskId, dependsOn) {
        const task = await this.get(taskId);
        const deps = task.dependencies.filter((d) => d !== dependsOn);
        const patch = { dependencies: deps };
        if (task.status === 'blocked' && deps.length === 0) {
            patch.status = 'open';
        }
        return this.storage.updateTask(taskId, patch);
    }
    async getDependencies(id) {
        const task = await this.get(id);
        const results = await Promise.all(task.dependencies.map((depId) => this.storage.getTask(depId)));
        return results.filter((t) => t !== undefined);
    }
    async getBlocked() {
        return this.storage.listTasks({ status: 'blocked' });
    }
    assertTransition(from, to) {
        if (!VALID_TRANSITIONS[from].includes(to)) {
            throw new Error(`Invalid status transition: ${from} → ${to}`);
        }
    }
    async unblockDependents(closedTaskId) {
        const blocked = await this.storage.listTasks({ status: 'blocked' });
        for (const task of blocked) {
            if (!task.dependencies.includes(closedTaskId))
                continue;
            const remaining = await Promise.all(task.dependencies.map((depId) => this.storage.getTask(depId)));
            const allClosed = remaining.every((t) => !t || t.status === 'closed');
            if (allClosed) {
                const updated = await this.storage.updateTask(task.id, { status: 'open' });
                this.events.emit({ type: 'task_reopened', task: updated });
            }
        }
    }
}
exports.TaskService = TaskService;
//# sourceMappingURL=TaskService.js.map