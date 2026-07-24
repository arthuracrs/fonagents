import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActorService } from '../services/ActorService.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { Actor } from '../domain/Actor.js';

function createMockStorage(): StoragePort {
  const actors = new Map<string, Actor>();
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
    listActors: vi.fn(async () => Array.from(actors.values())),
    getActor: vi.fn(async (id) => actors.get(id)),
    createActor: vi.fn(async (input) => {
      const actor: Actor = { ...input, id: `actor-${++idCounter}` };
      actors.set(actor.id, actor);
      return actor;
    }),
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

describe('ActorService', () => {
  let storage: StoragePort;
  let service: ActorService;

  beforeEach(() => {
    storage = createMockStorage();
    service = new ActorService(storage);
  });

  describe('list', () => {
    it('should return all actors', async () => {
      await service.create({ name: 'Alice', type: 'human' });
      await service.create({ name: 'Bob', type: 'agent' });

      const actors = await service.list();
      expect(actors).toHaveLength(2);
    });

    it('should return empty array when no actors', async () => {
      const actors = await service.list();
      expect(actors).toEqual([]);
    });
  });

  describe('get', () => {
    it('should return an actor by id', async () => {
      const created = await service.create({ name: 'Alice', type: 'human' });
      const actor = await service.get(created.id);
      expect(actor?.name).toBe('Alice');
    });

    it('should return undefined for non-existent actor', async () => {
      const actor = await service.get('nonexistent');
      expect(actor).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create an actor', async () => {
      const actor = await service.create({ name: 'Alice', type: 'human' });
      expect(actor.name).toBe('Alice');
      expect(actor.type).toBe('human');
      expect(actor.id).toBeDefined();
    });

    it('should create an actor with email', async () => {
      const actor = await service.create({
        name: 'Bob',
        type: 'agent',
        email: 'bob@example.com',
      });
      expect(actor.email).toBe('bob@example.com');
    });
  });
});
