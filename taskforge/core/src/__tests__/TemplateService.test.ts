import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateService } from '../services/TemplateService.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { TaskService } from '../services/TaskService.js';
import type { Template } from '../domain/Template.js';
import type { Task } from '../domain/Task.js';

function createMockStorage(): StoragePort {
  const templates = new Map<string, Template>();

  return {
    listTasks: vi.fn(async () => []),
    getTask: vi.fn(async () => undefined),
    createTask: vi.fn(async (input) => ({
      ...input,
      id: 'task-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    updateTask: vi.fn(async (id) => ({
      id,
      title: 'Task',
      status: 'open' as const,
      priority: 2 as const,
      type: 'task' as const,
      labels: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    deleteTask: vi.fn(async () => {}),
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
    listTemplates: vi.fn(async () => Array.from(templates.values())),
    getTemplate: vi.fn(async (name) => templates.get(name)),
    createTemplate: vi.fn(async (input) => {
      templates.set(input.name, input);
      return input;
    }),
    deleteTemplate: vi.fn(async (name) => { templates.delete(name); }),
  };
}

function createMockTaskService(): TaskService {
  const tasks: Task[] = [];
  let idCounter = 0;

  return {
    list: vi.fn(async () => tasks),
    get: vi.fn(async (id) => {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task ${id} not found`);
      return task;
    }),
    create: vi.fn(async (input) => {
      const task: Task = {
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
    update: vi.fn(async (id, patch) => {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task ${id} not found`);
      Object.assign(task, patch);
      return task;
    }),
    claim: vi.fn(async (id, actorId) => {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task ${id} not found`);
      task.assignee = actorId;
      task.status = 'in_progress';
      return task;
    }),
    close: vi.fn(async (id, reason?) => {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task ${id} not found`);
      task.status = 'closed';
      task.closedAt = new Date().toISOString();
      task.closeReason = reason;
      return task;
    }),
    reopen: vi.fn(async (id) => {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task ${id} not found`);
      task.status = 'open';
      task.closedAt = undefined;
      task.closeReason = undefined;
      return task;
    }),
    addDependency: vi.fn(async (taskId, dependsOn) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);
      if (!task.dependencies.includes(dependsOn)) {
        task.dependencies.push(dependsOn);
      }
      return task;
    }),
    removeDependency: vi.fn(async (taskId, dependsOn) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);
      task.dependencies = task.dependencies.filter(d => d !== dependsOn);
      return task;
    }),
    getDependencies: vi.fn(async (id) => {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task ${id} not found`);
      return tasks.filter(t => task.dependencies.includes(t.id));
    }),
    getBlocked: vi.fn(async () => tasks.filter(t => t.status === 'blocked')),
  } as unknown as TaskService;
}

describe('TemplateService', () => {
  let storage: StoragePort;
  let taskService: TaskService;
  let service: TemplateService;

  beforeEach(() => {
    storage = createMockStorage();
    taskService = createMockTaskService();
    service = new TemplateService(storage, taskService);
  });

  describe('list', () => {
    it('should return all templates', async () => {
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
      expect(templates).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('should return a template by name', async () => {
      await service.create({
        name: 'my-template',
        tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
        variables: [],
      });

      const template = await service.get('my-template');
      expect(template.name).toBe('my-template');
    });

    it('should throw if template not found', async () => {
      await expect(service.get('nonexistent')).rejects.toThrow(
        'Template "nonexistent" not found'
      );
    });
  });

  describe('create', () => {
    it('should create a template', async () => {
      const template = await service.create({
        name: 'my-template',
        description: 'A template',
        tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
        variables: ['name'],
      });
      expect(template.name).toBe('my-template');
      expect(template.description).toBe('A template');
    });
  });

  describe('delete', () => {
    it('should delete a template', async () => {
      await service.create({
        name: 'my-template',
        tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
        variables: [],
      });

      await service.delete('my-template');
      expect(storage.deleteTemplate).toHaveBeenCalledWith('my-template');
    });

    it('should throw if template not found', async () => {
      await expect(service.delete('nonexistent')).rejects.toThrow(
        'Template "nonexistent" not found'
      );
    });
  });

  describe('pour', () => {
    it('should create tasks from template', async () => {
      await service.create({
        name: 'feature',
        tasks: [
          { title: 'Implement {{feature}}', type: 'feature', priority: 1, labels: [], dependencies: [] },
          { title: 'Test {{feature}}', type: 'task', priority: 2, labels: [], dependencies: [] },
        ],
        variables: ['feature'],
      });

      const tasks = await service.pour('feature', { feature: 'auth' });
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Implement auth');
      expect(tasks[1].title).toBe('Test auth');
    });

    it('should substitute variables in description', async () => {
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
      expect(tasks[0].description).toBe('Add auth functionality');
    });

    it('should throw if missing variables', async () => {
      await service.create({
        name: 'feature',
        tasks: [{ title: 'Implement {{feature}}', type: 'task', priority: 2, labels: [], dependencies: [] }],
        variables: ['feature'],
      });

      await expect(service.pour('feature', {})).rejects.toThrow(
        'Missing required variables: feature'
      );
    });

    it('should add dependencies between created tasks', async () => {
      await service.create({
        name: 'feature',
        tasks: [
          { title: 'Task 1', type: 'task', priority: 2, labels: [], dependencies: [] },
          { title: 'Task 2', type: 'task', priority: 2, labels: [], dependencies: ['0'] },
        ],
        variables: [],
      });

      await service.pour('feature', {});
      expect(taskService.addDependency).toHaveBeenCalled();
    });

    it('should throw for invalid dependency reference', async () => {
      await service.create({
        name: 'feature',
        tasks: [
          { title: 'Task 1', type: 'task', priority: 2, labels: [], dependencies: ['5'] },
        ],
        variables: [],
      });

      await expect(service.pour('feature', {})).rejects.toThrow(
        'Invalid dependency reference "5" in template task 0'
      );
    });
  });
});
