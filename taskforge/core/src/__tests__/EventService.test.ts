import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventService } from '../services/EventService.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { EventBusPort } from '../ports/EventBusPort.js';
import type { Event } from '../domain/Event.js';

function createMockStorage(): StoragePort {
  const events: Event[] = [];
  let idCounter = 0;

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
    listEvents: vi.fn(async (taskId?) => {
      if (taskId) return events.filter(e => e.taskId === taskId);
      return events;
    }),
    createEvent: vi.fn(async (input) => {
      const event: Event = {
        ...input,
        id: `event-${++idCounter}`,
        timestamp: new Date().toISOString(),
      };
      events.push(event);
      return event;
    }),
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
  const handlers: ((event: any) => void)[] = [];
  return {
    emit: vi.fn((event) => handlers.forEach(h => h(event))),
    subscribe: vi.fn((handler) => {
      handlers.push(handler);
      return () => {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      };
    }),
  };
}

describe('EventService', () => {
  let storage: StoragePort;
  let eventBus: EventBusPort;
  let service: EventService;

  beforeEach(() => {
    storage = createMockStorage();
    eventBus = createMockEventBus();
    service = new EventService(storage, eventBus);
  });

  describe('list', () => {
    it('should return all events', async () => {
      await service.create('task-1', 'actor-1', 'created', { title: 'Task' });
      await service.create('task-2', 'actor-2', 'updated', { status: 'open' });

      const events = await service.list();
      expect(events).toHaveLength(2);
    });

    it('should filter events by taskId', async () => {
      await service.create('task-1', 'actor-1', 'created', { title: 'Task 1' });
      await service.create('task-2', 'actor-2', 'created', { title: 'Task 2' });

      const events = await service.list('task-1');
      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('task-1');
    });
  });

  describe('create', () => {
    it('should create an event', async () => {
      const event = await service.create('task-1', 'actor-1', 'created', { title: 'Task' });
      expect(event.taskId).toBe('task-1');
      expect(event.actorId).toBe('actor-1');
      expect(event.type).toBe('created');
      expect(event.payload).toEqual({ title: 'Task' });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it('should emit comment_added event', async () => {
      await service.create('task-1', 'actor-1', 'commented', { body: 'Hello' });
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment_added',
          taskId: 'task-1',
        })
      );
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events', async () => {
      const handler = vi.fn();
      service.subscribe(handler);

      await service.create('task-1', 'actor-1', 'created', {});
      expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = service.subscribe(handler);
      unsubscribe();

      await service.create('task-1', 'actor-1', 'created', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
