import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  Task,
  TaskStatus,
  TaskType,
  Actor,
  ActorType,
  Event,
  EventType,
  Gate,
  GateType,
  GateStatus,
  Template,
  TaskTemplate,
} from '@taskforge/core';
import type { StoragePort, TaskFilter } from '@taskforge/core';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  type: string;
  assignee: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  close_reason: string | null;
  due_at: string | null;
  metadata: string | null;
}

interface ActorRow {
  id: string;
  name: string;
  type: string;
  email: string | null;
  metadata: string | null;
}

interface EventRow {
  id: string;
  task_id: string;
  actor_id: string;
  type: string;
  payload: string | null;
  timestamp: string;
}

interface GateRow {
  id: string;
  task_id: string;
  type: string;
  status: string;
  reason: string | null;
  await_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface TemplateRow {
  name: string;
  description: string | null;
  tasks: string;
  variables: string;
}

export class SQLiteStorage implements StoragePort {
  private db: Database.Database;

  private stmts!: {
    // Tasks
    insertTask: Database.Statement;
    updateTask: Database.Statement;
    deleteTask: Database.Statement;
    getTask: Database.Statement;
    listTasks: Database.Statement;
    listTasksByStatus: Database.Statement;
    listTasksByAssignee: Database.Statement;
    listTasksByType: Database.Statement;
    listTasksByParent: Database.Statement;
    // Labels
    insertLabel: Database.Statement;
    deleteLabels: Database.Statement;
    getLabels: Database.Statement;
    // Dependencies
    insertDep: Database.Statement;
    deleteDeps: Database.Statement;
    getDeps: Database.Statement;
    // Actors
    insertActor: Database.Statement;
    getActor: Database.Statement;
    listActors: Database.Statement;
    // Events
    insertEvent: Database.Statement;
    listEvents: Database.Statement;
    listEventsByTask: Database.Statement;
    // Gates
    insertGate: Database.Statement;
    getGate: Database.Statement;
    listGates: Database.Statement;
    listGatesByTask: Database.Statement;
    resolveGate: Database.Statement;
    // Templates
    insertTemplate: Database.Statement;
    getTemplate: Database.Statement;
    listTemplates: Database.Statement;
    deleteTemplate: Database.Statement;
  };

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    this.prepareStatements();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 2,
        type TEXT NOT NULL,
        assignee TEXT,
        parent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT,
        close_reason TEXT,
        due_at TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS task_labels (
        task_id TEXT NOT NULL,
        label TEXT NOT NULL,
        PRIMARY KEY (task_id, label)
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL,
        depends_on TEXT NOT NULL,
        PRIMARY KEY (task_id, depends_on)
      );

      CREATE TABLE IF NOT EXISTS actors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        email TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gates (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        await_id TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      );

      CREATE TABLE IF NOT EXISTS templates (
        name TEXT PRIMARY KEY,
        description TEXT,
        tasks TEXT NOT NULL,
        variables TEXT NOT NULL
      );
    `);
  }

  private prepareStatements(): void {
    this.stmts = {
      // Tasks
      insertTask: this.db.prepare(`
        INSERT INTO tasks (id, title, description, status, priority, type, assignee, parent_id, created_at, updated_at, closed_at, close_reason, due_at, metadata)
        VALUES (@id, @title, @description, @status, @priority, @type, @assignee, @parentId, @createdAt, @updatedAt, @closedAt, @closeReason, @dueAt, @metadata)
      `),
      updateTask: this.db.prepare(`
        UPDATE tasks SET
          title = COALESCE(@title, title),
          description = COALESCE(@description, description),
          status = COALESCE(@status, status),
          priority = COALESCE(@priority, priority),
          type = COALESCE(@type, type),
          assignee = @assignee,
          parent_id = @parentId,
          updated_at = @updatedAt,
          closed_at = @closedAt,
          close_reason = @closeReason,
          due_at = @dueAt,
          metadata = @metadata
        WHERE id = @id
      `),
      deleteTask: this.db.prepare('DELETE FROM tasks WHERE id = ?'),
      getTask: this.db.prepare('SELECT * FROM tasks WHERE id = ?'),
      listTasks: this.db.prepare('SELECT * FROM tasks'),
      listTasksByStatus: this.db.prepare('SELECT * FROM tasks WHERE status = ?'),
      listTasksByAssignee: this.db.prepare('SELECT * FROM tasks WHERE assignee = ?'),
      listTasksByType: this.db.prepare('SELECT * FROM tasks WHERE type = ?'),
      listTasksByParent: this.db.prepare('SELECT * FROM tasks WHERE parent_id = ?'),
      // Labels
      insertLabel: this.db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label) VALUES (?, ?)'),
      deleteLabels: this.db.prepare('DELETE FROM task_labels WHERE task_id = ?'),
      getLabels: this.db.prepare('SELECT label FROM task_labels WHERE task_id = ?'),
      // Dependencies
      insertDep: this.db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)'),
      deleteDeps: this.db.prepare('DELETE FROM task_dependencies WHERE task_id = ?'),
      getDeps: this.db.prepare('SELECT depends_on FROM task_dependencies WHERE task_id = ?'),
      // Actors
      insertActor: this.db.prepare(`
        INSERT INTO actors (id, name, type, email, metadata)
        VALUES (@id, @name, @type, @email, @metadata)
      `),
      getActor: this.db.prepare('SELECT * FROM actors WHERE id = ?'),
      listActors: this.db.prepare('SELECT * FROM actors'),
      // Events
      insertEvent: this.db.prepare(`
        INSERT INTO events (id, task_id, actor_id, type, payload, timestamp)
        VALUES (@id, @taskId, @actorId, @type, @payload, @timestamp)
      `),
      listEvents: this.db.prepare('SELECT * FROM events ORDER BY timestamp DESC'),
      listEventsByTask: this.db.prepare('SELECT * FROM events WHERE task_id = ? ORDER BY timestamp DESC'),
      // Gates
      insertGate: this.db.prepare(`
        INSERT INTO gates (id, task_id, type, status, reason, await_id, created_at, resolved_at, resolved_by)
        VALUES (@id, @taskId, @type, @status, @reason, @awaitId, @createdAt, @resolvedAt, @resolvedBy)
      `),
      getGate: this.db.prepare('SELECT * FROM gates WHERE id = ?'),
      listGates: this.db.prepare('SELECT * FROM gates'),
      listGatesByTask: this.db.prepare('SELECT * FROM gates WHERE task_id = ?'),
      resolveGate: this.db.prepare(`
        UPDATE gates SET status = 'resolved', resolved_at = @resolvedAt, resolved_by = @resolvedBy
        WHERE id = @id
      `),
      // Templates
      insertTemplate: this.db.prepare(`
        INSERT OR REPLACE INTO templates (name, description, tasks, variables)
        VALUES (@name, @description, @tasks, @variables)
      `),
      getTemplate: this.db.prepare('SELECT * FROM templates WHERE name = ?'),
      listTemplates: this.db.prepare('SELECT * FROM templates'),
      deleteTemplate: this.db.prepare('DELETE FROM templates WHERE name = ?'),
    };
  }

  // ---- Mappers ----

  private rowToTask(row: TaskRow): Task {
    const labels = (this.stmts.getLabels.all(row.id) as { label: string }[]).map(r => r.label);
    const dependencies = (this.stmts.getDeps.all(row.id) as { depends_on: string }[]).map(r => r.depends_on);
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status as TaskStatus,
      priority: row.priority as Task['priority'],
      type: row.type as TaskType,
      assignee: row.assignee ?? undefined,
      labels,
      parentId: row.parent_id ?? undefined,
      dependencies,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at ?? undefined,
      closeReason: row.close_reason ?? undefined,
      dueAt: row.due_at ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private rowToActor(row: ActorRow): Actor {
    return {
      id: row.id,
      name: row.name,
      type: row.type as ActorType,
      email: row.email ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private rowToEvent(row: EventRow): Event {
    return {
      id: row.id,
      taskId: row.task_id,
      actorId: row.actor_id,
      type: row.type as EventType,
      payload: row.payload ? JSON.parse(row.payload) : {},
      timestamp: row.timestamp,
    };
  }

  private rowToGate(row: GateRow): Gate {
    return {
      id: row.id,
      taskId: row.task_id,
      type: row.type as GateType,
      status: row.status as GateStatus,
      reason: row.reason ?? undefined,
      awaitId: row.await_id ?? undefined,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at ?? undefined,
      resolvedBy: row.resolved_by ?? undefined,
    };
  }

  private rowToTemplate(row: TemplateRow): Template {
    return {
      name: row.name,
      description: row.description ?? undefined,
      tasks: JSON.parse(row.tasks) as TaskTemplate[],
      variables: JSON.parse(row.variables) as string[],
    };
  }

  // ---- Tasks ----

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    let rows: TaskRow[];
    if (filter?.status) {
      rows = this.stmts.listTasksByStatus.all(filter.status) as TaskRow[];
    } else if (filter?.assignee) {
      rows = this.stmts.listTasksByAssignee.all(filter.assignee) as TaskRow[];
    } else if (filter?.type) {
      rows = this.stmts.listTasksByType.all(filter.type) as TaskRow[];
    } else if (filter?.parentId !== undefined) {
      rows = this.stmts.listTasksByParent.all(filter.parentId ?? null) as TaskRow[];
    } else {
      rows = this.stmts.listTasks.all() as TaskRow[];
    }

    let tasks = rows.map(r => this.rowToTask(r));

    if (filter?.labels?.length) {
      tasks = tasks.filter(t => filter.labels!.every(l => t.labels.includes(l)));
    }
    if (filter?.priority !== undefined) {
      tasks = tasks.filter(t => t.priority === filter.priority);
    }

    return tasks;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const row = this.stmts.getTask.get(id) as TaskRow | undefined;
    return row ? this.rowToTask(row) : undefined;
  }

  async createTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const insertTx = this.db.transaction(() => {
      this.stmts.insertTask.run({
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        priority: task.priority,
        type: task.type,
        assignee: task.assignee ?? null,
        parentId: task.parentId ?? null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        closedAt: task.closedAt ?? null,
        closeReason: task.closeReason ?? null,
        dueAt: task.dueAt ?? null,
        metadata: task.metadata ? JSON.stringify(task.metadata) : null,
      });

      for (const label of task.labels) {
        this.stmts.insertLabel.run(task.id, label);
      }
      for (const dep of task.dependencies) {
        this.stmts.insertDep.run(task.id, dep);
      }
    });
    insertTx();

    return task;
  }

  async updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
    const existing = await this.getTask(id);
    if (!existing) throw new Error(`Task not found: ${id}`);

    const now = new Date().toISOString();
    const merged: Task = { ...existing, ...patch, updatedAt: now };

    const updateTx = this.db.transaction(() => {
      this.stmts.updateTask.run({
        id,
        title: merged.title,
        description: merged.description ?? null,
        status: merged.status,
        priority: merged.priority,
        type: merged.type,
        assignee: merged.assignee ?? null,
        parentId: merged.parentId ?? null,
        updatedAt: merged.updatedAt,
        closedAt: merged.closedAt ?? null,
        closeReason: merged.closeReason ?? null,
        dueAt: merged.dueAt ?? null,
        metadata: merged.metadata ? JSON.stringify(merged.metadata) : null,
      });

      if (patch.labels) {
        this.stmts.deleteLabels.run(id);
        for (const label of merged.labels) {
          this.stmts.insertLabel.run(id, label);
        }
      }
      if (patch.dependencies) {
        this.stmts.deleteDeps.run(id);
        for (const dep of merged.dependencies) {
          this.stmts.insertDep.run(id, dep);
        }
      }
    });
    updateTx();

    return merged;
  }

  async deleteTask(id: string): Promise<void> {
    const deleteTx = this.db.transaction(() => {
      this.stmts.deleteLabels.run(id);
      this.stmts.deleteDeps.run(id);
      this.stmts.deleteTask.run(id);
    });
    deleteTx();
  }

  // ---- Actors ----

  async listActors(): Promise<Actor[]> {
    const rows = this.stmts.listActors.all() as ActorRow[];
    return rows.map(r => this.rowToActor(r));
  }

  async getActor(id: string): Promise<Actor | undefined> {
    const row = this.stmts.getActor.get(id) as ActorRow | undefined;
    return row ? this.rowToActor(row) : undefined;
  }

  async createActor(input: Omit<Actor, 'id'>): Promise<Actor> {
    const actor: Actor = { ...input, id: randomUUID() };
    this.stmts.insertActor.run({
      id: actor.id,
      name: actor.name,
      type: actor.type,
      email: actor.email ?? null,
      metadata: actor.metadata ? JSON.stringify(actor.metadata) : null,
    });
    return actor;
  }

  // ---- Events ----

  async listEvents(taskId?: string): Promise<Event[]> {
    const rows = taskId
      ? (this.stmts.listEventsByTask.all(taskId) as EventRow[])
      : (this.stmts.listEvents.all() as EventRow[]);
    return rows.map(r => this.rowToEvent(r));
  }

  async createEvent(input: Omit<Event, 'id' | 'timestamp'>): Promise<Event> {
    const event: Event = {
      ...input,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.stmts.insertEvent.run({
      id: event.id,
      taskId: event.taskId,
      actorId: event.actorId,
      type: event.type,
      payload: JSON.stringify(event.payload),
      timestamp: event.timestamp,
    });
    return event;
  }

  // ---- Gates ----

  async listGates(taskId?: string): Promise<Gate[]> {
    const rows = taskId
      ? (this.stmts.listGatesByTask.all(taskId) as GateRow[])
      : (this.stmts.listGates.all() as GateRow[]);
    return rows.map(r => this.rowToGate(r));
  }

  async getGate(id: string): Promise<Gate | undefined> {
    const row = this.stmts.getGate.get(id) as GateRow | undefined;
    return row ? this.rowToGate(row) : undefined;
  }

  async createGate(input: Omit<Gate, 'id' | 'status' | 'createdAt' | 'resolvedAt' | 'resolvedBy'>): Promise<Gate> {
    const gate: Gate = {
      ...input,
      id: randomUUID(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.stmts.insertGate.run({
      id: gate.id,
      taskId: gate.taskId,
      type: gate.type,
      status: gate.status,
      reason: gate.reason ?? null,
      awaitId: gate.awaitId ?? null,
      createdAt: gate.createdAt,
      resolvedAt: null,
      resolvedBy: null,
    });
    return gate;
  }

  async resolveGate(id: string, resolvedBy: string): Promise<Gate> {
    const existing = await this.getGate(id);
    if (!existing) throw new Error(`Gate not found: ${id}`);

    const now = new Date().toISOString();
    this.stmts.resolveGate.run({
      id,
      resolvedAt: now,
      resolvedBy,
    });

    return {
      ...existing,
      status: 'resolved',
      resolvedAt: now,
      resolvedBy,
    };
  }

  // ---- Templates ----

  async listTemplates(): Promise<Template[]> {
    const rows = this.stmts.listTemplates.all() as TemplateRow[];
    return rows.map(r => this.rowToTemplate(r));
  }

  async getTemplate(name: string): Promise<Template | undefined> {
    const row = this.stmts.getTemplate.get(name) as TemplateRow | undefined;
    return row ? this.rowToTemplate(row) : undefined;
  }

  async createTemplate(input: Omit<Template, 'name'> & { name: string }): Promise<Template> {
    const template: Template = { ...input };
    this.stmts.insertTemplate.run({
      name: template.name,
      description: template.description ?? null,
      tasks: JSON.stringify(template.tasks),
      variables: JSON.stringify(template.variables),
    });
    return template;
  }

  async deleteTemplate(name: string): Promise<void> {
    this.stmts.deleteTemplate.run(name);
  }

  close(): void {
    this.db.close();
  }
}
