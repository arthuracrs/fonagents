import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GateService } from '../services/GateService.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { EventBusPort } from '../ports/EventBusPort.js';
import type { Gate } from '../domain/Gate.js';
import type { Task } from '../domain/Task.js';

function createMockStorage(): StoragePort {
  const gates = new Map<string, Gate>();
  const tasks = new Map<string, Task>();
  let gateIdCounter = 0;
  let taskIdCounter = 0;

  return {
    listTasks: vi.fn(async () => []),
    getTask: vi.fn(async (id) => tasks.get(id)),
    createTask: vi.fn(async (input) => {
      const task: Task = {
        ...input,
        id: `task-${++taskIdCounter}`,
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
    deleteTask: vi.fn(async (id) => { tasks.delete(id); }),
    listActors: vi.fn(async () => []),
    getActor: vi.fn(async () => undefined),
    createActor: vi.fn(async (input) => ({ ...input, id: 'actor-1' })),
    listEvents: vi.fn(async () => []),
    createEvent: vi.fn(async (input) => ({
      ...input,
      id: 'event-1',
      timestamp: new Date().toISOString(),
    })),
    listGates: vi.fn(async (taskId?) => {
      const allGates = Array.from(gates.values());
      if (taskId) return allGates.filter(g => g.taskId === taskId);
      return allGates;
    }),
    getGate: vi.fn(async (id) => gates.get(id)),
    createGate: vi.fn(async (input) => {
      const gate: Gate = {
        ...input,
        id: `gate-${++gateIdCounter}`,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      gates.set(gate.id, gate);
      return gate;
    }),
    resolveGate: vi.fn(async (id, resolvedBy) => {
      const existing = gates.get(id);
      if (!existing) throw new Error(`Gate not found: ${id}`);
      const resolved: Gate = {
        ...existing,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy,
      };
      gates.set(id, resolved);
      return resolved;
    }),
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

describe('GateService', () => {
  let storage: StoragePort;
  let eventBus: EventBusPort;
  let service: GateService;

  beforeEach(() => {
    storage = createMockStorage();
    eventBus = createMockEventBus();
    service = new GateService(storage, eventBus);
  });

  describe('list', () => {
    it('should return all gates', async () => {
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
      expect(gates).toHaveLength(2);
    });

    it('should filter gates by taskId', async () => {
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
      expect(gates).toHaveLength(1);
      expect(gates[0].taskId).toBe('task-1');
    });
  });

  describe('get', () => {
    it('should return a gate by id', async () => {
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
      expect(gate?.taskId).toBe('task-1');
    });

    it('should return undefined for non-existent gate', async () => {
      const gate = await service.get('nonexistent');
      expect(gate).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create a gate', async () => {
      await storage.createTask({
        title: 'Task',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
      });
      const gate = await service.create('task-1', 'human', 'Needs review');
      expect(gate.taskId).toBe('task-1');
      expect(gate.type).toBe('human');
      expect(gate.reason).toBe('Needs review');
      expect(gate.status).toBe('open');
    });

    it('should block the task', async () => {
      await storage.createTask({
        title: 'Task',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
      });
      await service.create('task-1', 'human');
      expect(storage.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: 'blocked' })
      );
    });

    it('should emit gate_opened event', async () => {
      await storage.createTask({
        title: 'Task',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
      });
      await service.create('task-1', 'human');
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gate_opened' })
      );
    });
  });

  describe('resolve', () => {
    it('should resolve a gate', async () => {
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
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedBy).toBe('actor-1');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('should emit gate_resolved event', async () => {
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
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'gate_resolved', gateId: gate.id })
      );
    });

    it('should unblock task when all gates resolved', async () => {
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
      expect(storage.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: 'open' })
      );
    });

    it('should not unblock task if other gates remain open', async () => {
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
      vi.mocked(storage.updateTask).mockClear();

      await service.resolve(gate1.id, 'actor-1');

      // Should not have called updateTask to unblock
      expect(storage.updateTask).not.toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: 'open' })
      );
    });
  });
});
