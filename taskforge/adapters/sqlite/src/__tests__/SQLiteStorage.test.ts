import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStorage } from '../SQLiteStorage.js';

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage;

  beforeEach(() => {
    storage = new SQLiteStorage(':memory:');
  });

  afterEach(() => {
    storage.close();
  });

  describe('Tasks', () => {
    describe('createTask', () => {
      it('should create a task', async () => {
        const task = await storage.createTask({
          title: 'Test Task',
          description: 'A test task',
          status: 'open',
          priority: 2,
          type: 'task',
          labels: ['test'],
          dependencies: [],
        });

        expect(task.id).toBeDefined();
        expect(task.title).toBe('Test Task');
        expect(task.description).toBe('A test task');
        expect(task.status).toBe('open');
        expect(task.priority).toBe(2);
        expect(task.type).toBe('task');
        expect(task.labels).toEqual(['test']);
        expect(task.dependencies).toEqual([]);
        expect(task.createdAt).toBeDefined();
        expect(task.updatedAt).toBeDefined();
      });

      it('should create a task with minimal fields', async () => {
        const task = await storage.createTask({
          title: 'Minimal Task',
          status: 'open',
          priority: 2,
          type: 'task',
          labels: [],
          dependencies: [],
        });

        expect(task.title).toBe('Minimal Task');
        expect(task.description).toBeUndefined();
      });

      it('should create a task with metadata', async () => {
        const task = await storage.createTask({
          title: 'Task with Metadata',
          status: 'open',
          priority: 2,
          type: 'task',
          labels: [],
          dependencies: [],
          metadata: { custom: 'value' },
        });

        expect(task.metadata).toEqual({ custom: 'value' });
      });
    });

    describe('getTask', () => {
      it('should get a task by id', async () => {
        const created = await storage.createTask({
          title: 'Test Task',
          status: 'open',
          priority: 2,
          type: 'task',
          labels: [],
          dependencies: [],
        });

        const task = await storage.getTask(created.id);
        expect(task).toBeDefined();
        expect(task?.title).toBe('Test Task');
      });

      it('should return undefined for non-existent task', async () => {
        const task = await storage.getTask('nonexistent');
        expect(task).toBeUndefined();
      });
    });

    describe('listTasks', () => {
      it('should list all tasks', async () => {
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
        expect(tasks).toHaveLength(2);
      });

      it('should filter by status', async () => {
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
        expect(openTasks).toHaveLength(1);
        expect(openTasks[0].title).toBe('Open Task');
      });

      it('should filter by assignee', async () => {
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
        expect(assignedTasks).toHaveLength(1);
        expect(assignedTasks[0].title).toBe('Assigned Task');
      });

      it('should filter by type', async () => {
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
        expect(bugs).toHaveLength(1);
        expect(bugs[0].title).toBe('Bug Task');
      });

      it('should filter by labels', async () => {
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
        expect(urgentTasks).toHaveLength(1);
        expect(urgentTasks[0].title).toBe('Urgent Task');
      });

      it('should filter by priority', async () => {
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
        expect(highPriority).toHaveLength(1);
        expect(highPriority[0].title).toBe('High Priority');
      });
    });

    describe('updateTask', () => {
      it('should update a task', async () => {
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

        expect(updated.title).toBe('Updated Title');
        expect(updated.status).toBe('in_progress');
      });

      it('should update labels', async () => {
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

        expect(updated.labels).toEqual(['new', 'tags']);
      });

      it('should update dependencies', async () => {
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

        expect(updated.dependencies).toEqual(['dep-1', 'dep-2']);
      });

      it('should throw if task not found', async () => {
        await expect(
          storage.updateTask('nonexistent', { title: 'Updated' })
        ).rejects.toThrow('Task not found: nonexistent');
      });
    });

    describe('deleteTask', () => {
      it('should delete a task', async () => {
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
        expect(found).toBeUndefined();
      });

      it('should delete task labels and dependencies', async () => {
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
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Actors', () => {
    describe('createActor', () => {
      it('should create an actor', async () => {
        const actor = await storage.createActor({
          name: 'Alice',
          type: 'human',
          email: 'alice@example.com',
        });

        expect(actor.id).toBeDefined();
        expect(actor.name).toBe('Alice');
        expect(actor.type).toBe('human');
        expect(actor.email).toBe('alice@example.com');
      });
    });

    describe('getActor', () => {
      it('should get an actor by id', async () => {
        const created = await storage.createActor({
          name: 'Alice',
          type: 'human',
        });

        const actor = await storage.getActor(created.id);
        expect(actor).toBeDefined();
        expect(actor?.name).toBe('Alice');
      });

      it('should return undefined for non-existent actor', async () => {
        const actor = await storage.getActor('nonexistent');
        expect(actor).toBeUndefined();
      });
    });

    describe('listActors', () => {
      it('should list all actors', async () => {
        await storage.createActor({ name: 'Alice', type: 'human' });
        await storage.createActor({ name: 'Bob', type: 'agent' });

        const actors = await storage.listActors();
        expect(actors).toHaveLength(2);
      });
    });
  });

  describe('Events', () => {
    describe('createEvent', () => {
      it('should create an event', async () => {
        const event = await storage.createEvent({
          taskId: 'task-1',
          actorId: 'actor-1',
          type: 'created',
          payload: { title: 'Task' },
        });

        expect(event.id).toBeDefined();
        expect(event.taskId).toBe('task-1');
        expect(event.actorId).toBe('actor-1');
        expect(event.type).toBe('created');
        expect(event.payload).toEqual({ title: 'Task' });
        expect(event.timestamp).toBeDefined();
      });
    });

    describe('listEvents', () => {
      it('should list all events', async () => {
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
        expect(events).toHaveLength(2);
      });

      it('should filter events by taskId', async () => {
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
        expect(events).toHaveLength(1);
        expect(events[0].taskId).toBe('task-1');
      });
    });
  });

  describe('Gates', () => {
    describe('createGate', () => {
      it('should create a gate', async () => {
        const gate = await storage.createGate({
          taskId: 'task-1',
          type: 'human',
          reason: 'Needs review',
        });

        expect(gate.id).toBeDefined();
        expect(gate.taskId).toBe('task-1');
        expect(gate.type).toBe('human');
        expect(gate.reason).toBe('Needs review');
        expect(gate.status).toBe('open');
        expect(gate.createdAt).toBeDefined();
      });
    });

    describe('getGate', () => {
      it('should get a gate by id', async () => {
        const created = await storage.createGate({
          taskId: 'task-1',
          type: 'human',
        });

        const gate = await storage.getGate(created.id);
        expect(gate).toBeDefined();
        expect(gate?.taskId).toBe('task-1');
      });

      it('should return undefined for non-existent gate', async () => {
        const gate = await storage.getGate('nonexistent');
        expect(gate).toBeUndefined();
      });
    });

    describe('listGates', () => {
      it('should list all gates', async () => {
        await storage.createGate({ taskId: 'task-1', type: 'human' });
        await storage.createGate({ taskId: 'task-2', type: 'external' });

        const gates = await storage.listGates();
        expect(gates).toHaveLength(2);
      });

      it('should filter gates by taskId', async () => {
        await storage.createGate({ taskId: 'task-1', type: 'human' });
        await storage.createGate({ taskId: 'task-2', type: 'external' });

        const gates = await storage.listGates('task-1');
        expect(gates).toHaveLength(1);
        expect(gates[0].taskId).toBe('task-1');
      });
    });

    describe('resolveGate', () => {
      it('should resolve a gate', async () => {
        const gate = await storage.createGate({
          taskId: 'task-1',
          type: 'human',
        });

        const resolved = await storage.resolveGate(gate.id, 'actor-1');
        expect(resolved.status).toBe('resolved');
        expect(resolved.resolvedBy).toBe('actor-1');
        expect(resolved.resolvedAt).toBeDefined();
      });

      it('should throw if gate not found', async () => {
        await expect(
          storage.resolveGate('nonexistent', 'actor-1')
        ).rejects.toThrow('Gate not found: nonexistent');
      });
    });
  });

  describe('Templates', () => {
    describe('createTemplate', () => {
      it('should create a template', async () => {
        const template = await storage.createTemplate({
          name: 'my-template',
          description: 'A template',
          tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
          variables: ['name'],
        });

        expect(template.name).toBe('my-template');
        expect(template.description).toBe('A template');
        expect(template.tasks).toHaveLength(1);
        expect(template.variables).toEqual(['name']);
      });
    });

    describe('getTemplate', () => {
      it('should get a template by name', async () => {
        await storage.createTemplate({
          name: 'my-template',
          tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
          variables: [],
        });

        const template = await storage.getTemplate('my-template');
        expect(template).toBeDefined();
        expect(template?.name).toBe('my-template');
      });

      it('should return undefined for non-existent template', async () => {
        const template = await storage.getTemplate('nonexistent');
        expect(template).toBeUndefined();
      });
    });

    describe('listTemplates', () => {
      it('should list all templates', async () => {
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
        expect(templates).toHaveLength(2);
      });
    });

    describe('deleteTemplate', () => {
      it('should delete a template', async () => {
        await storage.createTemplate({
          name: 'my-template',
          tasks: [{ title: 'Task', type: 'task', priority: 2, labels: [], dependencies: [] }],
          variables: [],
        });

        await storage.deleteTemplate('my-template');
        const found = await storage.getTemplate('my-template');
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        storage.createTask({
          title: `Task ${i}`,
          status: 'open',
          priority: 2,
          type: 'task',
          labels: [],
          dependencies: [],
        })
      );

      const tasks = await Promise.all(promises);
      expect(tasks).toHaveLength(10);

      const allTasks = await storage.listTasks();
      expect(allTasks).toHaveLength(10);
    });

    it('should handle special characters in strings', async () => {
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
      expect(found?.title).toBe('Task with "quotes" and \'apostrophes\'');
      expect(found?.description).toBe('Description with\nnewlines and\ttabs');
    });

    it('should handle empty arrays', async () => {
      const task = await storage.createTask({
        title: 'Empty Arrays',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
      });

      expect(task.labels).toEqual([]);
      expect(task.dependencies).toEqual([]);
    });

    it('should handle null vs undefined correctly', async () => {
      const task = await storage.createTask({
        title: 'Null Test',
        status: 'open',
        priority: 2,
        type: 'task',
        labels: [],
        dependencies: [],
      });

      expect(task.description).toBeUndefined();
      expect(task.assignee).toBeUndefined();
      expect(task.parentId).toBeUndefined();
      expect(task.closedAt).toBeUndefined();
      expect(task.closeReason).toBeUndefined();
      expect(task.dueAt).toBeUndefined();
      expect(task.metadata).toBeUndefined();
    });
  });
});
