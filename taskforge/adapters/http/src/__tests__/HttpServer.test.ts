import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { HttpServer } from '../HttpServer.js';
import type { HttpServerServices } from '../HttpServer.js';
import type { TaskService, ActorService, EventService, GateService, TemplateService } from '@taskforge/core';

function createMockServices(): HttpServerServices {
  return {
    tasks: {
      list: vi.fn(async () => [
        { id: 'task-1', title: 'Task 1', status: 'open', priority: 2, type: 'task', labels: [], dependencies: [] },
      ]),
      get: vi.fn(async (id) => ({
        id,
        title: 'Task 1',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      create: vi.fn(async (input) => ({
        ...input,
        id: 'task-1',
        status: 'open',
        priority: input.priority ?? 2,
        type: input.type ?? 'task',
        labels: input.labels ?? [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      update: vi.fn(async (id, patch) => ({
        id,
        ...patch,
        title: patch.title ?? 'Task 1',
        status: patch.status ?? 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      claim: vi.fn(async (id, actorId) => ({
        id,
        title: 'Task 1',
        status: 'in_progress',
        assignee: actorId,
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      close: vi.fn(async (id, reason) => ({
        id,
        title: 'Task 1',
        status: 'closed',
        closeReason: reason,
        closedAt: new Date().toISOString(),
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      reopen: vi.fn(async (id) => ({
        id,
        title: 'Task 1',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      addDependency: vi.fn(async (taskId, dependsOn) => ({
        id: taskId,
        title: 'Task 1',
        status: 'blocked',
        dependencies: [dependsOn],
        priority: 2,
        type: 'task',
        labels: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      removeDependency: vi.fn(async (taskId) => ({
        id: taskId,
        title: 'Task 1',
        status: 'open',
        dependencies: [],
        priority: 2,
        type: 'task',
        labels: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      getDependencies: vi.fn(async () => []),
      getBlocked: vi.fn(async () => []),
    } as unknown as TaskService,
    actors: {
      list: vi.fn(async () => [
        { id: 'actor-1', name: 'Alice', type: 'human' },
      ]),
      get: vi.fn(async (id) => ({ id, name: 'Alice', type: 'human' })),
      create: vi.fn(async (input) => ({ ...input, id: 'actor-1' })),
    } as unknown as ActorService,
    events: {
      list: vi.fn(async () => [
        { id: 'event-1', taskId: 'task-1', actorId: 'actor-1', type: 'created', payload: {}, timestamp: new Date().toISOString() },
      ]),
      create: vi.fn(async (taskId, actorId, type, payload) => ({
        id: 'event-1',
        taskId,
        actorId,
        type,
        payload,
        timestamp: new Date().toISOString(),
      })),
      subscribe: vi.fn(() => () => {}),
    } as unknown as EventService,
    gates: {
      list: vi.fn(async () => [
        { id: 'gate-1', taskId: 'task-1', type: 'human', status: 'open', createdAt: new Date().toISOString() },
      ]),
      get: vi.fn(async (id) => ({
        id,
        taskId: 'task-1',
        type: 'human',
        status: 'open',
        createdAt: new Date().toISOString(),
      })),
      create: vi.fn(async (taskId, type, reason, awaitId) => ({
        id: 'gate-1',
        taskId,
        type,
        reason,
        awaitId,
        status: 'open',
        createdAt: new Date().toISOString(),
      })),
      resolve: vi.fn(async (id, resolvedBy) => ({
        id,
        taskId: 'task-1',
        type: 'human',
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy,
        createdAt: new Date().toISOString(),
      })),
    } as unknown as GateService,
    templates: {
      list: vi.fn(async () => [
        { name: 'template-1', tasks: [], variables: [] },
      ]),
      get: vi.fn(async (name) => ({
        name,
        tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
        variables: [],
      })),
      create: vi.fn(async (input) => input),
      pour: vi.fn(async (name, vars) => [
        {
          id: 'task-1',
          title: 'Poured Task',
          status: 'open',
          priority: 2,
          type: 'task',
          labels: [],
          dependencies: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
      delete: vi.fn(async () => {}),
    } as unknown as TemplateService,
  };
}

describe('HttpServer', () => {
  let server: HttpServer;
  let services: HttpServerServices;

  beforeEach(() => {
    services = createMockServices();
    server = new HttpServer(services);
  });

  describe('Tasks', () => {
    it('should list tasks', async () => {
      const response = await request((server as any).app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Task 1');
    });

    it('should create a task', async () => {
      const response = await request((server as any).app)
        .post('/api/tasks')
        .send({ title: 'New Task' })
        .expect(201);

      expect(response.body.title).toBe('New Task');
    });

    it('should get a task', async () => {
      const response = await request((server as any).app)
        .get('/api/tasks/task-1')
        .expect(200);

      expect(response.body.id).toBe('task-1');
    });

    it('should update a task', async () => {
      const response = await request((server as any).app)
        .patch('/api/tasks/task-1')
        .send({ title: 'Updated' })
        .expect(200);

      expect(response.body.title).toBe('Updated');
    });

    it('should delete a task', async () => {
      await request((server as any).app)
        .delete('/api/tasks/task-1')
        .expect(204);
    });

    it('should claim a task', async () => {
      const response = await request((server as any).app)
        .post('/api/tasks/task-1/claim')
        .send({ actorId: 'actor-1' })
        .expect(200);

      expect(response.body.assignee).toBe('actor-1');
      expect(response.body.status).toBe('in_progress');
    });

    it('should return 400 if actorId missing on claim', async () => {
      await request((server as any).app)
        .post('/api/tasks/task-1/claim')
        .send({})
        .expect(400);
    });

    it('should close a task', async () => {
      const response = await request((server as any).app)
        .post('/api/tasks/task-1/close')
        .send({ reason: 'Done' })
        .expect(200);

      expect(response.body.status).toBe('closed');
    });

    it('should reopen a task', async () => {
      const response = await request((server as any).app)
        .post('/api/tasks/task-1/reopen')
        .expect(200);

      expect(response.body.status).toBe('open');
    });

    it('should add a comment', async () => {
      const response = await request((server as any).app)
        .post('/api/tasks/task-1/comment')
        .send({ actorId: 'actor-1', body: 'Comment text' })
        .expect(201);

      expect(response.body.type).toBe('commented');
    });

    it('should return 400 if comment fields missing', async () => {
      await request((server as any).app)
        .post('/api/tasks/task-1/comment')
        .send({})
        .expect(400);
    });
  });

  describe('Actors', () => {
    it('should list actors', async () => {
      const response = await request((server as any).app)
        .get('/api/actors')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Alice');
    });

    it('should create an actor', async () => {
      const response = await request((server as any).app)
        .post('/api/actors')
        .send({ name: 'Bob', type: 'agent' })
        .expect(201);

      expect(response.body.name).toBe('Bob');
    });
  });

  describe('Events', () => {
    it('should list events', async () => {
      const response = await request((server as any).app)
        .get('/api/events')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('created');
    });

    it('should filter events by taskId', async () => {
      await request((server as any).app)
        .get('/api/events?taskId=task-1')
        .expect(200);

      expect(services.events.list).toHaveBeenCalledWith('task-1');
    });
  });

  describe('Gates', () => {
    it('should list gates', async () => {
      const response = await request((server as any).app)
        .get('/api/gates')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('human');
    });

    it('should create a gate', async () => {
      const response = await request((server as any).app)
        .post('/api/gates')
        .send({ taskId: 'task-1', type: 'human', reason: 'Review' })
        .expect(201);

      expect(response.body.taskId).toBe('task-1');
    });

    it('should return 400 if gate fields missing', async () => {
      await request((server as any).app)
        .post('/api/gates')
        .send({})
        .expect(400);
    });

    it('should resolve a gate', async () => {
      const response = await request((server as any).app)
        .post('/api/gates/gate-1/resolve')
        .send({ resolvedBy: 'actor-1' })
        .expect(200);

      expect(response.body.status).toBe('resolved');
    });

    it('should return 400 if resolvedBy missing', async () => {
      await request((server as any).app)
        .post('/api/gates/gate-1/resolve')
        .send({})
        .expect(400);
    });
  });

  describe('Templates', () => {
    it('should list templates', async () => {
      const response = await request((server as any).app)
        .get('/api/templates')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('template-1');
    });

    it('should get a template', async () => {
      const response = await request((server as any).app)
        .get('/api/templates/template-1')
        .expect(200);

      expect(response.body.name).toBe('template-1');
    });

    it('should create a template', async () => {
      const response = await request((server as any).app)
        .post('/api/templates')
        .send({
          name: 'new-template',
          tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
          variables: [],
        })
        .expect(201);

      expect(response.body.name).toBe('new-template');
    });

    it('should pour a template', async () => {
      const response = await request((server as any).app)
        .post('/api/templates/template-1/pour')
        .send({ vars: { name: 'test' } })
        .expect(201);

      expect(response.body).toHaveLength(1);
    });

    it('should return 400 if vars missing on pour', async () => {
      await request((server as any).app)
        .post('/api/templates/template-1/pour')
        .send({})
        .expect(400);
    });

    it('should delete a template', async () => {
      await request((server as any).app)
        .delete('/api/templates/template-1')
        .expect(204);
    });
  });

  describe('CORS', () => {
    it('should set CORS headers', async () => {
      const response = await request((server as any).app)
        .get('/api/tasks')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should handle OPTIONS preflight', async () => {
      await request((server as any).app)
        .options('/api/tasks')
        .expect(204);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on service error', async () => {
      services.tasks.get = vi.fn(async () => {
        throw new Error('Service error');
      });

      const response = await request((server as any).app)
        .get('/api/tasks/task-1')
        .expect(500);

      expect(response.body.error).toBe('Service error');
    });
  });
});
