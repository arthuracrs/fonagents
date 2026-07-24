import { TaskForge } from '../../../taskforge/dist/index.js';
function mapStatus(s) {
    if (s === 'closed')
        return 'closed';
    if (s === 'in_progress')
        return 'in_progress';
    if (s === 'blocked')
        return 'blocked';
    if (s === 'deferred')
        return 'deferred';
    return 'open';
}
function mapType(t) {
    if (t === 'bug')
        return 'bug';
    if (t === 'feature')
        return 'feature';
    if (t === 'epic')
        return 'epic';
    return 'task';
}
function toIssueType(t) {
    if (t === 'bug')
        return 'bug';
    if (t === 'feature')
        return 'feature';
    if (t === 'epic')
        return 'epic';
    return 'task';
}
function toIssue(task) {
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
function mapGateType(t) {
    if (t === 'human')
        return 'human';
    return 'human';
}
function toGate(g) {
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
export class TaskForgeAdapter {
    forge;
    constructor(config = {}) {
        this.forge = new TaskForge({ dbPath: config.dbPath });
    }
    async listIssues(filter) {
        const tfFilter = {};
        if (filter?.status)
            tfFilter.status = filter.status;
        if (filter?.type)
            tfFilter.type = filter.type;
        if (filter?.assignee)
            tfFilter.assignee = filter.assignee;
        if (filter?.labels)
            tfFilter.labels = filter.labels;
        if (filter?.parent)
            tfFilter.parentId = filter.parent;
        if (filter?.priority !== undefined)
            tfFilter.priority = filter.priority;
        const tasks = await this.forge.tasks.list(tfFilter);
        return tasks.map(toIssue);
    }
    async getIssue(id) {
        try {
            const task = await this.forge.tasks.get(id);
            return toIssue(task);
        }
        catch {
            return undefined;
        }
    }
    async createIssue(input) {
        const task = await this.forge.tasks.create({
            title: input.title,
            description: input.description,
            type: mapType(input.type ?? 'task'),
            priority: (input.priority ?? 2),
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
    async updateIssue(id, patch) {
        const tfPatch = {};
        if (patch.title !== undefined)
            tfPatch.title = patch.title;
        if (patch.status !== undefined)
            tfPatch.status = patch.status;
        if (patch.priority !== undefined)
            tfPatch.priority = patch.priority;
        if (patch.assignee !== undefined)
            tfPatch.assignee = patch.assignee;
        const task = await this.forge.tasks.update(id, tfPatch);
        return toIssue(task);
    }
    async closeIssue(id, reason) {
        const task = await this.forge.tasks.close(id, reason);
        return toIssue(task);
    }
    async reopenIssue(id) {
        const task = await this.forge.tasks.reopen(id);
        return toIssue(task);
    }
    async claimIssue(id, actor) {
        const task = await this.forge.tasks.claim(id, actor ?? 'manager');
        return toIssue(task);
    }
    async addComment(id, body, actor) {
        const ev = await this.forge.events.create(id, actor ?? 'unknown', 'commented', { body });
        return {
            id: ev.id,
            issueId: id,
            body,
            author: actor,
            createdAt: ev.timestamp,
        };
    }
    async listComments(id) {
        const events = await this.forge.events.list(id);
        return events
            .filter((e) => e.type === 'commented')
            .map((e) => ({
            id: e.id,
            issueId: id,
            body: e.payload?.body ?? '',
            author: e.actorId,
            createdAt: e.timestamp,
        }));
    }
    async listDependencies(id) {
        const tasks = await this.forge.tasks.getDependencies(id);
        return tasks.map((t) => ({
            fromId: id,
            toId: t.id,
            type: 'blocks',
        }));
    }
    async addDependency(childId, parentId, type) {
        await this.forge.tasks.addDependency(childId, parentId);
    }
    async children(parentId) {
        const tasks = await this.forge.tasks.list({ parentId });
        return tasks.map(toIssue);
    }
    async readyWork(opts) {
        const filter = { status: 'open' };
        if (opts?.assignee)
            filter.assignee = opts.assignee;
        let tasks = await this.forge.tasks.list(filter);
        tasks = tasks.filter((t) => {
            const deps = t.dependencies ?? [];
            return deps.length === 0;
        });
        return tasks.map((t) => ({
            issueId: t.id,
            title: t.title,
            claimable: true,
            blockers: t.dependencies ?? [],
        }));
    }
    async listFormulas() {
        const templates = await this.forge.templates.list();
        return templates.map((t) => ({
            name: t.name,
            description: t.description,
        }));
    }
    async showFormula(name) {
        return this.forge.templates.get(name);
    }
    async pourMolecule(formulaName, vars, opts) {
        const tasks = await this.forge.templates.pour(formulaName, vars);
        const root = tasks[0];
        return {
            id: `mol-${root.id}`,
            formulaName,
            rootIssueId: root.id,
            molType: 'swarm',
            status: 'active',
            variables: vars,
        };
    }
    async listMolecules() {
        return [];
    }
    async showMolecule(id) {
        return null;
    }
    async listGates(opts) {
        let gates = await this.forge.gates.list();
        if (opts?.open === true) {
            gates = gates.filter((g) => g.status === 'open');
        }
        return gates.map(toGate);
    }
    async createGate(input) {
        const g = await this.forge.gates.create(input.issueId, 'human', input.reason, input.awaitId);
        return toGate(g);
    }
    async resolveGate(gateId) {
        const g = await this.forge.gates.resolve(gateId, 'manager');
        return toGate(g);
    }
    async recordAudit(input) {
        await this.forge.events.create('audit', input.actor, input.event, input.payload);
    }
    async startServer(port) {
        await this.forge.start(port);
    }
    async stopServer() {
        await this.forge.stop();
    }
}
