"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const prompts_1 = require("@fonagents/prompts");
const DEFAULT_MANAGER_RUNTIME = 'opencode';
class Orchestrator {
    tracker;
    runtime;
    events;
    config;
    currentMoleculeId;
    workerSubscriptions = new Map();
    constructor(tracker, runtime, events, config) {
        this.tracker = tracker;
        this.runtime = runtime;
        this.events = events;
        this.config = config;
    }
    // ── UiCommandPort: gates ───────────────────────────────────────────────────────
    async resolveGate(gateId, note) {
        await this.tracker.resolveGate(gateId);
        if (note)
            await this.tracker.recordAudit({ actor: 'human', event: 'gate.resolved', payload: { gateId, note } });
        this.emit({ type: 'gate_resolved', gateId });
    }
    // ── UiCommandPort: worker control ──────────────────────────────────────────────
    async cancelWorker(workerId) {
        await this.runtime.cancelWorker(workerId);
    }
    // ── UiCommandPort: queries (delegate to tracker/runtime) ────────────────────
    listIssues(filter) { return this.tracker.listIssues(filter); }
    getIssue(id) { return this.tracker.getIssue(id); }
    listMolecules() { return this.tracker.listMolecules(); }
    showMolecule(id) { return this.tracker.showMolecule(id); }
    listReadyWork() { return this.tracker.readyWork(); }
    listGates() { return this.tracker.listGates({ open: true }); }
    getWorkerStatus(workerId) {
        return Promise.resolve(this.runtime.getWorker(workerId));
    }
    listWorkers() {
        return Promise.resolve(this.runtime.listWorkers());
    }
    listRuntimes() { return this.runtime.listRuntimes(); }
    listComments(issueId) { return this.tracker.listComments(issueId); }
    listDependencies(issueId) { return this.tracker.listDependencies(issueId); }
    children(parentId) { return this.tracker.children(parentId); }
    listFormulas() { return this.tracker.listFormulas(); }
    // ── UiCommandPort: direct issue CRUD ──────────────────────────────────────────
    createIssue(input) { return this.tracker.createIssue(input); }
    updateIssue(id, patch) { return this.tracker.updateIssue(id, patch); }
    closeIssue(id, reason) { return this.tracker.closeIssue(id, reason); }
    reopenIssue(id) { return this.tracker.reopenIssue(id); }
    claimIssue(id) { return this.tracker.claimIssue(id); }
    addComment(issueId, body) { return this.tracker.addComment(issueId, body, 'Human'); }
    addDependency(childId, parentId, type) {
        return this.tracker.addDependency(childId, parentId, type);
    }
    // ── ManagerToolsPort: tools the manager LLM calls via MCP ──────────────────────
    async decompose(input) {
        const mol = await this.tracker.pourMolecule(input.formulaName, input.vars);
        this.currentMoleculeId = mol.id;
        const children = await this.tracker.children(mol.rootIssueId);
        this.emit({ type: 'molecule_poured', moleculeId: mol.id, formulaName: input.formulaName });
        return { moleculeId: mol.id, childIssueIds: children.map((c) => c.id) };
    }
    async dispatchWorker(input) {
        const issue = await this.tracker.getIssue(input.issueId);
        if (!issue)
            throw new Error(`Cannot dispatch: issue ${input.issueId} not found`);
        await this.tracker.claimIssue(input.issueId);
        const spawnInput = {
            issueId: input.issueId,
            runtimeId: input.runtimeId ?? this.config.managerRuntimeId ?? DEFAULT_MANAGER_RUNTIME,
            prompt: input.prompt ?? `Resolve ${input.issueId}: ${issue.title}`,
            systemPrompt: (0, prompts_1.buildWorkerSystemPrompt)(input.issueId),
            mode: 'tmux',
            cwd: this.config.projectDir,
        };
        const worker = await this.runtime.spawnWorker(spawnInput);
        this.emit({ type: 'worker_started', worker });
        const unsub = this.runtime.subscribeWorker(worker.id, (ev) => {
            this.forwardWorkerEvent(worker.id, ev);
            if (ev.type === 'done' || ev.type === 'failed') {
                const cleanup = this.workerSubscriptions.get(worker.id);
                if (cleanup) {
                    cleanup.unsubscribe();
                    this.workerSubscriptions.delete(worker.id);
                }
            }
        });
        this.workerSubscriptions.set(worker.id, unsub);
        return { workerId: worker.id };
    }
    async listReady(input) {
        const ready = await this.tracker.readyWork({ molId: input.moleculeId });
        return ready.map((r) => ({ issueId: r.issueId, title: r.title, status: 'ready' }));
    }
    async workerStatus(input) {
        if (input.workerId) {
            const w = this.runtime.getWorker(input.workerId);
            return w ? [{ id: w.id, status: w.status, issueId: w.issueId }] : [];
        }
        if (input.issueId) {
            return this.runtime.getWorkersForIssue(input.issueId).map((w) => ({ id: w.id, status: w.status, issueId: w.issueId }));
        }
        return [];
    }
    async escalate(input) {
        const issueId = input.issueId ?? await this.currentMoleculeRoot();
        if (!issueId)
            throw new Error('Cannot escalate without an issue context — provide issueId or decompose first.');
        const gate = await this.tracker.createGate({
            issueId,
            type: 'human',
            reason: input.reason,
        });
        this.emit({ type: 'gate_opened', gate });
        return { gateId: gate.id };
    }
    async recordProgress(input) {
        await this.tracker.addComment(input.issueId, input.body, 'fonagents-manager');
        this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'commented' });
    }
    async completeIssue(input) {
        await this.tracker.closeIssue(input.issueId, input.reason);
        this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'closed' });
    }
    // ── Helpers ────────────────────────────────────────────────────────────────────
    forwardWorkerEvent(workerId, ev) {
        if (ev.type === 'text')
            this.emit({ type: 'worker_output', workerId, delta: ev.delta });
        else if (ev.type === 'done')
            this.emit({ type: 'worker_status', workerId, status: 'completed', exitCode: ev.exitCode });
        else if (ev.type === 'failed')
            this.emit({ type: 'worker_status', workerId, status: 'failed', exitCode: ev.exitCode });
    }
    async currentMoleculeRoot() {
        if (!this.currentMoleculeId)
            return undefined;
        const molecules = await this.tracker.listMolecules();
        const mol = molecules.find((m) => m.id === this.currentMoleculeId);
        return mol?.rootIssueId;
    }
    emit(event) { this.events.emit(event); }
}
exports.Orchestrator = Orchestrator;
//# sourceMappingURL=Orchestrator.js.map