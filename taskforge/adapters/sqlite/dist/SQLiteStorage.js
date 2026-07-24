"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteStorage = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_crypto_1 = require("node:crypto");
class SQLiteStorage {
    db;
    stmts;
    constructor(dbPath = ':memory:') {
        this.db = new better_sqlite3_1.default(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.migrate();
        this.prepareStatements();
    }
    migrate() {
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
    prepareStatements() {
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
    rowToTask(row) {
        const labels = this.stmts.getLabels.all(row.id).map(r => r.label);
        const dependencies = this.stmts.getDeps.all(row.id).map(r => r.depends_on);
        return {
            id: row.id,
            title: row.title,
            description: row.description ?? undefined,
            status: row.status,
            priority: row.priority,
            type: row.type,
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
    rowToActor(row) {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            email: row.email ?? undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
    }
    rowToEvent(row) {
        return {
            id: row.id,
            taskId: row.task_id,
            actorId: row.actor_id,
            type: row.type,
            payload: row.payload ? JSON.parse(row.payload) : {},
            timestamp: row.timestamp,
        };
    }
    rowToGate(row) {
        return {
            id: row.id,
            taskId: row.task_id,
            type: row.type,
            status: row.status,
            reason: row.reason ?? undefined,
            awaitId: row.await_id ?? undefined,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at ?? undefined,
            resolvedBy: row.resolved_by ?? undefined,
        };
    }
    rowToTemplate(row) {
        return {
            name: row.name,
            description: row.description ?? undefined,
            tasks: JSON.parse(row.tasks),
            variables: JSON.parse(row.variables),
        };
    }
    // ---- Tasks ----
    async listTasks(filter) {
        let rows;
        if (filter?.status) {
            rows = this.stmts.listTasksByStatus.all(filter.status);
        }
        else if (filter?.assignee) {
            rows = this.stmts.listTasksByAssignee.all(filter.assignee);
        }
        else if (filter?.type) {
            rows = this.stmts.listTasksByType.all(filter.type);
        }
        else if (filter?.parentId !== undefined) {
            rows = this.stmts.listTasksByParent.all(filter.parentId ?? null);
        }
        else {
            rows = this.stmts.listTasks.all();
        }
        let tasks = rows.map(r => this.rowToTask(r));
        if (filter?.labels?.length) {
            tasks = tasks.filter(t => filter.labels.every(l => t.labels.includes(l)));
        }
        if (filter?.priority !== undefined) {
            tasks = tasks.filter(t => t.priority === filter.priority);
        }
        return tasks;
    }
    async getTask(id) {
        const row = this.stmts.getTask.get(id);
        return row ? this.rowToTask(row) : undefined;
    }
    async createTask(input) {
        const now = new Date().toISOString();
        const task = {
            ...input,
            id: (0, node_crypto_1.randomUUID)(),
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
    async updateTask(id, patch) {
        const existing = await this.getTask(id);
        if (!existing)
            throw new Error(`Task not found: ${id}`);
        const now = new Date().toISOString();
        const merged = { ...existing, ...patch, updatedAt: now };
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
    async deleteTask(id) {
        const deleteTx = this.db.transaction(() => {
            this.stmts.deleteLabels.run(id);
            this.stmts.deleteDeps.run(id);
            this.stmts.deleteTask.run(id);
        });
        deleteTx();
    }
    // ---- Actors ----
    async listActors() {
        const rows = this.stmts.listActors.all();
        return rows.map(r => this.rowToActor(r));
    }
    async getActor(id) {
        const row = this.stmts.getActor.get(id);
        return row ? this.rowToActor(row) : undefined;
    }
    async createActor(input) {
        const actor = { ...input, id: (0, node_crypto_1.randomUUID)() };
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
    async listEvents(taskId) {
        const rows = taskId
            ? this.stmts.listEventsByTask.all(taskId)
            : this.stmts.listEvents.all();
        return rows.map(r => this.rowToEvent(r));
    }
    async createEvent(input) {
        const event = {
            ...input,
            id: (0, node_crypto_1.randomUUID)(),
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
    async listGates(taskId) {
        const rows = taskId
            ? this.stmts.listGatesByTask.all(taskId)
            : this.stmts.listGates.all();
        return rows.map(r => this.rowToGate(r));
    }
    async getGate(id) {
        const row = this.stmts.getGate.get(id);
        return row ? this.rowToGate(row) : undefined;
    }
    async createGate(input) {
        const gate = {
            ...input,
            id: (0, node_crypto_1.randomUUID)(),
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
    async resolveGate(id, resolvedBy) {
        const existing = await this.getGate(id);
        if (!existing)
            throw new Error(`Gate not found: ${id}`);
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
    async listTemplates() {
        const rows = this.stmts.listTemplates.all();
        return rows.map(r => this.rowToTemplate(r));
    }
    async getTemplate(name) {
        const row = this.stmts.getTemplate.get(name);
        return row ? this.rowToTemplate(row) : undefined;
    }
    async createTemplate(input) {
        const template = { ...input };
        this.stmts.insertTemplate.run({
            name: template.name,
            description: template.description ?? null,
            tasks: JSON.stringify(template.tasks),
            variables: JSON.stringify(template.variables),
        });
        return template;
    }
    async deleteTemplate(name) {
        this.stmts.deleteTemplate.run(name);
    }
    close() {
        this.db.close();
    }
}
exports.SQLiteStorage = SQLiteStorage;
//# sourceMappingURL=SQLiteStorage.js.map