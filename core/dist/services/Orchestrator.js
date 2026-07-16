"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
// The Orchestrator is the only thing that knows about ALL the ports. It:
//   - implements UiCommandPort      (UIs drive it)
//   - implements ManagerToolsPort    (the manager LLM drives it via MCP)
//   - owns the manager conversation loop
//   - emits UiEvents as side effects of every meaningful state change
//
// It has zero knowledge of bd, anagent, Express, or any UI transport. Swap any
// adapter and this file is untouched.
const DEFAULT_MANAGER_FORMULA = 'manager-swarm';
const DEFAULT_MANAGER_RUNTIME = 'opencode';
class Orchestrator {
    tracker;
    runtime;
    events;
    config;
    managerSessionId;
    currentMoleculeId;
    messages = [];
    workerSubscriptions = new Map();
    constructor(tracker, runtime, events, config) {
        this.tracker = tracker;
        this.runtime = runtime;
        this.events = events;
        this.config = config;
    }
    // ── UiCommandPort: conversation ───────────────────────────────────────────────
    async sendUserMessage(content) {
        const userMsg = this.makeMessage('user', content);
        const managerMsg = this.makeMessage('manager', '');
        this.messages.push(userMsg, managerMsg);
        this.emit({ type: 'user_message', message: userMsg });
        this.emit({ type: 'manager_thinking', active: true });
        // Fire-and-forget: the manager turn streams via events. We resolve once the
        // message is accepted so the UI can render the user bubble immediately.
        void this.runManagerTurn(content, managerMsg).catch((err) => {
            this.emit({ type: 'error', message: `Manager turn failed: ${err.message}` });
            this.emit({ type: 'manager_thinking', active: false });
        });
        return { userMessageId: userMsg.id, managerMessageId: managerMsg.id };
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
    listMessages() { return Promise.resolve([...this.messages]); }
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
    addComment(issueId, body) { return this.tracker.addComment(issueId, body); }
    addDependency(childId, parentId, type) {
        return this.tracker.addDependency(childId, parentId, type);
    }
    // ── UiCommandPort: manager lifecycle ──────────────────────────────────────────
    async startManager() {
        if (this.managerSessionId)
            return { sessionId: this.managerSessionId };
        const { sessionId } = await this.runtime.startManager({
            runtimeId: this.config.managerRuntimeId ?? DEFAULT_MANAGER_RUNTIME,
            systemPrompt: this.config.managerSystemPrompt,
            bootstrapMessage: this.bootstrapMessage(),
            mcpConfigPath: this.config.mcpConfigPath,
            cwd: this.config.projectDir,
        });
        this.managerSessionId = sessionId;
        this.emit({ type: 'manager_started', sessionId });
        return { sessionId };
    }
    async endManager() {
        if (!this.managerSessionId)
            return;
        await this.runtime.endManager(this.managerSessionId);
        this.emit({ type: 'manager_ended', sessionId: this.managerSessionId });
        this.managerSessionId = undefined;
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
            systemPrompt: `You are a worker agent executing beads issue ${input.issueId}.\n\n${issue.description}`,
            mode: 'headless',
            cwd: this.config.projectDir,
        };
        const worker = await this.runtime.spawnWorker(spawnInput);
        this.emit({ type: 'worker_started', worker });
        // Forward worker output to the UI until it finishes, then unsubscribe.
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
        // Prefer the explicitly given issue, else the current molecule's root.
        // If neither exists, the adapter must accept a gate without an issue
        // (bd gate create can target a synthetic/ephemeral issue).
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
        await this.tracker.addComment(input.issueId, input.body);
        this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'commented' });
    }
    async completeIssue(input) {
        await this.tracker.closeIssue(input.issueId, input.reason);
        this.emit({ type: 'issue_changed', issueId: input.issueId, change: 'closed' });
    }
    // ── The manager conversation loop ──────────────────────────────────────────────
    // Sends the user's message to the manager session. The manager streams its
    // reply (text deltas + tool calls). Tool calls arrive via MCP and route back
    // into the ManagerToolsPort methods above. When the turn ends, we finalize the
    // manager message bubble.
    async runManagerTurn(userContent, managerMsg) {
        if (!this.managerSessionId)
            await this.startManager();
        let buffer = '';
        const events = await this.runtime.sendManagerTurn({
            sessionId: this.managerSessionId,
            message: userContent,
            onEvent: (ev) => {
                const delta = managerStreamDelta(ev);
                if (delta) {
                    buffer += delta;
                    managerMsg.content = buffer;
                    this.emit({ type: 'manager_stream', delta });
                }
            },
        });
        managerMsg.content = buffer || summarizeTurn(events);
        this.emit({ type: 'manager_message', message: managerMsg });
        this.emit({ type: 'manager_thinking', active: false });
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
    bootstrapMessage() {
        return [
            'You are the manager agent. The human operator talks only to you.',
            'You decompose work into a swarm molecule, dispatch worker agents onto the child issues, monitor them, and escalate to the human (via the escalate tool) when you need a decision.',
            `Use the ${this.config.managerFormula ?? DEFAULT_MANAGER_FORMULA} formula to decompose.`,
            'Call tools rather than shelling out: the system records everything and surfaces it to the human in real time.',
        ].join('\n');
    }
    makeMessage(role, content) {
        return {
            id: genId(),
            role,
            content,
            createdAt: new Date().toISOString(),
        };
    }
    emit(event) { this.events.emit(event); }
}
exports.Orchestrator = Orchestrator;
function managerStreamDelta(ev) {
    if (ev.type === 'text')
        return ev.delta;
    return '';
}
function summarizeTurn(events) {
    const text = events.filter((e) => e.type === 'text').map((e) => e.delta).join('');
    return text || '(turn complete)';
}
function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
//# sourceMappingURL=Orchestrator.js.map