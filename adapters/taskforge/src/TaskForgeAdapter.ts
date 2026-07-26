import path from 'path';
import { TaskForge, type Task, type TaskStatus, type TaskType, type EventType } from '../../../taskforge/dist/index.js';
import type {
  IssueTrackerPort,
  Issue,
  IssueId,
  IssueFilter,
  IssueCreateInput,
  IssueUpdatePatch,
  Comment,
  Dependency,
  Gate,
  GateId,
  GateType,
  ReadyWork,
} from '@fonagents/core';

function mapStatus(s: string): Issue['status'] {
  if (s === 'closed') return 'closed';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'blocked') return 'blocked';
  if (s === 'deferred') return 'deferred';
  return 'open';
}

function mapType(t: string): TaskType {
  if (t === 'bug') return 'bug';
  if (t === 'feature') return 'feature';
  if (t === 'epic') return 'epic';
  return 'task';
}

function toIssueType(t: string): Issue['type'] {
  if (t === 'bug') return 'bug';
  if (t === 'feature') return 'feature';
  if (t === 'epic') return 'epic';
  return 'task';
}

function toIssue(task: any): Issue {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? '',
    status: mapStatus(task.status),
    type: toIssueType(task.type),
    priority: task.priority ?? 2,
    assignee: task.assignee,
    labels: task.labels ?? [],
    parentId: task.parentId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function mapGateType(t: string): GateType {
  if (t === 'human') return 'human';
  return 'human';
}

function toGate(g: any): Gate {
  return {
    id: g.id,
    issueId: g.taskId,
    type: mapGateType(g.type),
    status: g.status === 'resolved' ? 'closed' : 'open',
    awaitId: g.awaitId,
    reason: g.reason,
    createdAt: g.createdAt,
    resolvedAt: g.resolvedAt,
  };
}

export interface TaskForgeAdapterConfig {
  dbPath?: string;
}

export class TaskForgeAdapter implements IssueTrackerPort {
  private forge: TaskForge;

  constructor(config: TaskForgeAdapterConfig = {}) {
    this.forge = new TaskForge({ dbPath: config.dbPath });
  }

  async listIssues(filter?: IssueFilter): Promise<Issue[]> {
    const tfFilter: any = {};
    if (filter?.status) tfFilter.status = filter.status;
    if (filter?.type) tfFilter.type = filter.type;
    if (filter?.assignee) tfFilter.assignee = filter.assignee;
    if (filter?.labels) tfFilter.labels = filter.labels;
    if (filter?.parent) tfFilter.parentId = filter.parent;
    if (filter?.priority !== undefined) tfFilter.priority = filter.priority;

    const tasks = await this.forge.tasks.list(tfFilter);
    return tasks.map(toIssue);
  }

  async getIssue(id: IssueId): Promise<Issue | undefined> {
    try {
      const task = await this.forge.tasks.get(id);
      return toIssue(task);
    } catch {
      return undefined;
    }
  }

  async createIssue(input: IssueCreateInput): Promise<Issue> {
    const task = await this.forge.tasks.create({
      title: input.title,
      description: input.description,
      type: mapType(input.type ?? 'task'),
      priority: (input.priority ?? 2) as Task['priority'],
      assignee: input.assignee,
      labels: input.labels ?? [],
      parentId: input.parent,
    });
    if (input.deps) {
      for (const dep of input.deps) {
        await this.forge.tasks.addDependency(task.id, dep);
      }
    }
    return toIssue(task);
  }

  async updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue> {
    const tfPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) tfPatch.title = patch.title;
    if (patch.status !== undefined) tfPatch.status = patch.status as TaskStatus;
    if (patch.priority !== undefined) tfPatch.priority = patch.priority as Task['priority'];
    if (patch.assignee !== undefined) tfPatch.assignee = patch.assignee;
    const task = await this.forge.tasks.update(id, tfPatch as any);
    return toIssue(task);
  }

  async closeIssue(id: IssueId, reason?: string): Promise<Issue> {
    const task = await this.forge.tasks.close(id, reason);
    return toIssue(task);
  }

  async reopenIssue(id: IssueId): Promise<Issue> {
    const task = await this.forge.tasks.reopen(id);
    return toIssue(task);
  }

  async claimIssue(id: IssueId, actor?: string): Promise<Issue> {
    const task = await this.forge.tasks.claim(id, actor ?? 'manager');
    return toIssue(task);
  }

  async addComment(id: IssueId, body: string, actor?: string): Promise<Comment> {
    const ev = await this.forge.events.create(id, actor ?? 'unknown', 'commented', { body });
    return {
      id: ev.id,
      issueId: id,
      body,
      author: actor,
      createdAt: ev.timestamp,
    };
  }

  async listComments(id: IssueId): Promise<Comment[]> {
    const events = await this.forge.events.list(id);
    return events
      .filter((e: any) => e.type === 'commented')
      .map((e: any) => ({
        id: e.id,
        issueId: id,
        body: e.payload?.body ?? '',
        author: e.actorId,
        createdAt: e.timestamp,
      }));
  }

  async listDependencies(id: IssueId): Promise<Dependency[]> {
    const tasks = await this.forge.tasks.getDependencies(id);
    return tasks.map((t: any) => ({
      fromId: id,
      toId: t.id,
      type: 'blocks',
    }));
  }

  async addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void> {
    await this.forge.tasks.addDependency(childId, parentId);
  }

  async children(parentId: IssueId): Promise<Issue[]> {
    const tasks = await this.forge.tasks.list({ parentId });
    return tasks.map(toIssue);
  }

  async readyWork(opts?: {
    gated?: boolean;
    assignee?: string;
    claim?: boolean;
  }): Promise<ReadyWork[]> {
    const filter: any = { status: 'open' };
    if (opts?.assignee) filter.assignee = opts.assignee;
    let tasks = await this.forge.tasks.list(filter);
    tasks = tasks.filter((t: any) => {
      const deps = t.dependencies ?? [];
      return deps.length === 0;
    });
    return tasks.map((t: any) => ({
      issueId: t.id,
      title: t.title,
      claimable: true,
      blockers: t.dependencies ?? [],
    }));
  }

  async resetStaleTasks(): Promise<Issue[]> {
    const tasks = await this.forge.tasks.list({ status: 'in_progress' });
    const reset: Issue[] = [];
    for (const task of tasks) {
      const updated = await this.forge.tasks.update(task.id, { status: 'open' });
      reset.push(toIssue(updated));
    }
    return reset;
  }

  async listGates(opts?: { open?: boolean }): Promise<Gate[]> {
    let gates = await this.forge.gates.list();
    if (opts?.open === true) {
      gates = gates.filter((g: any) => g.status === 'open');
    }
    return gates.map(toGate);
  }

  async createGate(input: {
    issueId: IssueId;
    type: GateType;
    reason?: string;
    awaitId?: string;
  }): Promise<Gate> {
    const g = await this.forge.gates.create(
      input.issueId,
      'human',
      input.reason,
      input.awaitId,
    );
    return toGate(g);
  }

  async resolveGate(gateId: GateId): Promise<Gate> {
    const g = await this.forge.gates.resolve(gateId, 'manager');
    return toGate(g);
  }

  async recordAudit(input: {
    actor: string;
    event: string;
    payload?: unknown;
  }): Promise<void> {
    await this.forge.events.create(
      'audit',
      input.actor,
      input.event as EventType,
      input.payload as Record<string, unknown>,
    );
  }

  async startServer(port: number): Promise<void> {
    await this.forge.start(port);
  }

  async stopServer(): Promise<void> {
    await this.forge.stop();
  }
}
