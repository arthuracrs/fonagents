import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../services/TaskService.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { EventBusPort } from '../ports/EventBusPort.js';
import type { Task, TaskStatus } from '../domain/Task.js';

function createMockStorage(): StoragePort {
  const tasks = new Map<string, Task>();
  let idCounter = 0;

  return {
    listTasks: vi.fn(async (filter?) => {
      let result = Array.from(tasks.values());
      if (filter?.status) result = result.filter(t => t.status === filter.status);
      if (filter?.assignee) result = result.filter(t => t.assignee === filter.assignee);
      if (filter?.type) result = result.filter(t => t.type === filter.type);
      return result;
    }),
    getTask: vi.fn(async (id) => tasks.get(id)),
    createTask: vi.fn(async (input) => {
      const task: Task = {
        ...input,
        id: `task-${++idCounter}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tasks.set(task.id, task);
      return task;
    }),
    updateTask: vi.fn(async (id, patch) => {
      const existing = tasks.get(id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      tasks.set(id, updated);
      return updated;
    }),
    deleteTask: vi.fn(async (id) => {
      tasks.delete(id);
    }),
    listActors: vi.fn(async () => []),
    getActor: vi.fn(async () => undefined),
    createActor: vi.fn(async (input) => ({ ...input, id: 'actor-1' })),
    listEvents: vi.fn(async () => []),
    createEvent: vi.fn(async (input) => ({
      ...input,
      id: 'event-1',
      timestamp: new Date().toISOString(),
    })),
    listGates: vi.fn(async () => []),
    getGate: vi.fn(async () => undefined),
    createGate: vi.fn(async (input) => ({
      ...input,
      id: 'gate-1',
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    })),
    resolveGate: vi.fn(async (id, resolvedBy) => ({
      id,
      taskId: 'task-1',
      type: 'human' as const,
      status: 'resolved' as const,
      createdAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    })),
    listTemplates: vi.fn(async () => []),
    getTemplate: vi.fn(async () => undefined),
    createTemplate: vi.fn(async (input) => input),
    deleteTemplate: vi.fn(async () => {}),
  };
}

function createMockEventBus(): EventBusPort {
  return {
    emit: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
}

describe('TaskService', () => {
  let storage: StoragePort;
  let eventBus: EventBusPort;
  let service: TaskService;

  beforeEach(() => {
    storage = createMockStorage();
    eventBus = createMockEventBus();
    service = new TaskService(storage, eventBus);
  });

  describe('list', () => {
    it('should return all tasks', async () => {
      await service.create({ title: 'Task 1' });
      await service.create({ title: 'Task 2' });

      const tasks = await service.list();
      expect(tasks).toHaveLength(2);
    });

    it('should filter tasks by status', async () => {
      await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.claim(task2.id, 'actor-1');

      const openTasks = await service.list({ status: 'open' });
      expect(openTasks).toHaveLength(1);
      expect(openTasks[0].title).toBe('Task 1');
    });
  });

  describe('get', () => {
    it('should return a task by id', async () => {
      const created = await service.create({ title: 'Test Task' });
      const task = await service.get(created.id);
      expect(task.title).toBe('Test Task');
    });

    it('should throw if task not found', async () => {
      await expect(service.get('nonexistent')).rejects.toThrow('Task nonexistent not found');
    });
  });

  describe('create', () => {
    it('should create a task with defaults', async () => {
      const task = await service.create({ title: 'New Task' });
      expect(task.title).toBe('New Task');
      expect(task.status).toBe('open');
      expect(task.priority).toBe(2);
      expect(task.type).toBe('task');
      expect(task.labels).toEqual([]);
      expect(task.dependencies).toEqual([]);
    });

    it('should create a task with custom values', async () => {
      const task = await service.create({
        title: 'Custom Task',
        description: 'A custom task',
        priority: 1,
        type: 'feature',
        labels: ['urgent'],
      });
      expect(task.priority).toBe(1);
      expect(task.type).toBe('feature');
      expect(task.labels).toEqual(['urgent']);
    });

    it('should emit task_created event', async () => {
      await service.create({ title: 'Event Task' });
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_created' })
      );
    });
  });

  describe('update', () => {
    it('should update task fields', async () => {
      const task = await service.create({ title: 'Original' });
      const updated = await service.update(task.id, { title: 'Updated' });
      expect(updated.title).toBe('Updated');
    });

    it('should validate status transitions', async () => {
      const task = await service.create({ title: 'Task' });
      await service.close(task.id);
      await expect(service.update(task.id, { status: 'in_progress' })).rejects.toThrow(
        'Invalid status transition: closed → in_progress'
      );
    });

    it('should emit task_updated event', async () => {
      const task = await service.create({ title: 'Task' });
      await service.update(task.id, { title: 'Updated' });
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_updated' })
      );
    });
  });

  describe('claim', () => {
    it('should assign actor and set status to in_progress', async () => {
      const task = await service.create({ title: 'Task' });
      const claimed = await service.claim(task.id, 'actor-1');
      expect(claimed.assignee).toBe('actor-1');
      expect(claimed.status).toBe('in_progress');
    });

    it('should emit task_claimed event', async () => {
      const task = await service.create({ title: 'Task' });
      await service.claim(task.id, 'actor-1');
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_claimed', actorId: 'actor-1' })
      );
    });

    it('should throw if task is closed', async () => {
      const task = await service.create({ title: 'Task' });
      await service.close(task.id);
      await expect(service.claim(task.id, 'actor-1')).rejects.toThrow(
        'Invalid status transition: closed → in_progress'
      );
    });
  });

  describe('close', () => {
    it('should close a task with reason', async () => {
      const task = await service.create({ title: 'Task' });
      const closed = await service.close(task.id, 'Done');
      expect(closed.status).toBe('closed');
      expect(closed.closeReason).toBe('Done');
      expect(closed.closedAt).toBeDefined();
    });

    it('should emit task_closed event', async () => {
      const task = await service.create({ title: 'Task' });
      await service.close(task.id, 'Done');
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_closed', reason: 'Done' })
      );
    });

    it('should throw if already closed', async () => {
      const task = await service.create({ title: 'Task' });
      await service.close(task.id);
      await expect(service.close(task.id)).rejects.toThrow(
        'Invalid status transition: closed → closed'
      );
    });
  });

  describe('reopen', () => {
    it('should reopen a closed task', async () => {
      const task = await service.create({ title: 'Task' });
      await service.close(task.id);
      const reopened = await service.reopen(task.id);
      expect(reopened.status).toBe('open');
      expect(reopened.closedAt).toBeUndefined();
      expect(reopened.closeReason).toBeUndefined();
    });

    it('should emit task_reopened event', async () => {
      const task = await service.create({ title: 'Task' });
      await service.close(task.id);
      await service.reopen(task.id);
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_reopened' })
      );
    });

    it('should throw if task is not closed', async () => {
      const task = await service.create({ title: 'Task' });
      await expect(service.reopen(task.id)).rejects.toThrow(
        'Invalid status transition: open → open'
      );
    });
  });

  describe('dependencies', () => {
    it('should add a dependency', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      const updated = await service.addDependency(task2.id, task1.id);
      expect(updated.dependencies).toContain(task1.id);
    });

    it('should block task when adding open dependency', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      const updated = await service.addDependency(task2.id, task1.id);
      expect(updated.status).toBe('blocked');
    });

    it('should not block if dependency is closed', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      await service.close(task1.id);
      const task2 = await service.create({ title: 'Task 2' });
      const updated = await service.addDependency(task2.id, task1.id);
      expect(updated.status).toBe('open');
    });

    it('should not add duplicate dependency', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.addDependency(task2.id, task1.id);
      const result = await service.addDependency(task2.id, task1.id);
      expect(result.dependencies).toHaveLength(1);
    });

    it('should remove a dependency', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.addDependency(task2.id, task1.id);
      const updated = await service.removeDependency(task2.id, task1.id);
      expect(updated.dependencies).not.toContain(task1.id);
    });

    it('should unblock task when all dependencies removed', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.addDependency(task2.id, task1.id);
      const updated = await service.removeDependency(task2.id, task1.id);
      expect(updated.status).toBe('open');
    });

    it('should get dependencies', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.addDependency(task2.id, task1.id);
      const deps = await service.getDependencies(task2.id);
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe(task1.id);
    });

    it('should get blocked tasks', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.addDependency(task2.id, task1.id);
      const blocked = await service.getBlocked();
      expect(blocked).toHaveLength(1);
      expect(blocked[0].id).toBe(task2.id);
    });
  });

  describe('unblockDependents', () => {
    it('should unblock dependents when dependency is closed', async () => {
      const task1 = await service.create({ title: 'Task 1' });
      const task2 = await service.create({ title: 'Task 2' });
      await service.addDependency(task2.id, task1.id);

      // Override listTasks to return blocked tasks for unblockDependents
      const originalListTasks = storage.listTasks;
      storage.listTasks = vi.fn(async (filter?) => {
        if (filter?.status === 'blocked') {
          // Return task2 with its dependencies
          return [{
            ...task2,
            status: 'blocked' as const,
            dependencies: [task1.id],
          }];
        }
        return originalListTasks(filter);
      });

      await service.close(task1.id);

      // Should have called updateTask to unblock task2
      expect(storage.updateTask).toHaveBeenCalledWith(
        task2.id,
        expect.objectContaining({ status: 'open' })
      );
    });
  });
});
