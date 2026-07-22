"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Overseer = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto_1 = __importDefault(require("crypto"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
class Overseer {
    eventBus;
    config;
    projectDir;
    queue = [];
    active = new Map();
    debounceTimer = null;
    isProcessing = false;
    constructor(eventBus, config, projectDir) {
        this.eventBus = eventBus;
        this.config = config;
        this.projectDir = projectDir;
    }
    start() {
        if (!this.config.enabled) {
            console.log('Overseer: disabled');
            return;
        }
        console.log(`Overseer: started (mode=${this.config.mode}, maxConcurrent=${this.config.maxConcurrent})`);
        this.eventBus.addListener('ui-event', (event) => {
            if (event.type === 'worker_status') {
                this.handleWorkerEvent(event);
            }
        });
    }
    stop() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        for (const handle of this.active.values()) {
            (0, child_process_1.execFile)('tmux', ['kill-session', '-t', handle.sessionName], () => { });
        }
        this.active.clear();
    }
    handleWorkerEvent(event) {
        const { workerId, status } = event;
        if (status !== 'completed' && status !== 'failed')
            return;
        const queued = {
            type: status === 'completed' ? 'done' : 'failed',
            issueId: event.issueId || '',
            workerId,
        };
        if (this.config.mode === 'queue') {
            this.enqueue(queued);
        }
        else {
            this.batch(queued);
        }
    }
    // ── Queue mode ───────────────────────────────────────────────────────────────
    enqueue(event) {
        this.queue.push(event);
        this.processQueue();
    }
    async processQueue() {
        if (this.isProcessing)
            return;
        if (this.queue.length === 0)
            return;
        if (this.active.size >= this.config.maxConcurrent)
            return;
        this.isProcessing = true;
        const event = this.queue.shift();
        await this.runOverseer([event]);
    }
    // ── Batch mode ───────────────────────────────────────────────────────────────
    batch(event) {
        this.queue.push(event);
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.processBatch();
        }, this.config.debounceMs);
    }
    async processBatch() {
        if (this.queue.length === 0)
            return;
        if (this.active.size >= this.config.maxConcurrent)
            return;
        const events = [...this.queue];
        this.queue = [];
        await this.runOverseer(events);
    }
    // ── Overseer spawning ────────────────────────────────────────────────────────
    async runOverseer(events) {
        const completedIssues = events.filter(e => e.type === 'done').map(e => e.issueId).filter(Boolean);
        const failedIssues = events.filter(e => e.type === 'failed').map(e => e.issueId).filter(Boolean);
        const promptParts = [];
        if (completedIssues.length > 0) {
            promptParts.push(`Workers for these issues just completed: ${completedIssues.join(', ')}`);
        }
        if (failedIssues.length > 0) {
            promptParts.push(`Workers for these issues failed: ${failedIssues.join(', ')}`);
        }
        promptParts.push('', 'Review the board state and dispatch ready work.');
        const prompt = promptParts.join('\n');
        const id = crypto_1.default.randomBytes(6).toString('hex');
        const sessionName = `overseer-${id}`;
        try {
            await execFileAsync('tmux', [
                'new-session', '-d', '-s', sessionName,
                '-x', '220', '-y', '50',
                '-c', this.projectDir,
                'opencode', '--agent', 'fonagents-overseer', '--prompt', prompt,
            ]);
            await execFileAsync('tmux', [
                'set-option', '-t', sessionName, 'remain-on-exit', 'on',
            ]).catch(() => { });
            const handle = {
                id,
                sessionName,
                status: 'running',
                startedAt: Date.now(),
            };
            this.active.set(id, handle);
            console.log(`Overseer: spawned ${sessionName} for ${events.length} event(s)`);
            this.pollOverseer(handle).catch((err) => {
                console.error(`Overseer: ${sessionName} polling error:`, err);
                this.active.delete(id);
                this.onOverseerDone();
            });
        }
        catch (err) {
            console.error(`Overseer: failed to spawn ${sessionName}:`, err);
        }
    }
    async pollOverseer(handle) {
        const deadline = Date.now() + this.config.timeoutSec * 1000;
        while (Date.now() < deadline) {
            await sleep(5000);
            try {
                const { stdout } = await execFileAsync('tmux', [
                    'display-message', '-p', '-t', handle.sessionName,
                    '#{pane_dead}:#{pane_dead_status}',
                ]);
                const [dead, statusStr] = stdout.trim().split(':');
                if (dead === '1') {
                    handle.status = 'completed';
                    handle.finishedAt = Date.now();
                    this.active.delete(handle.id);
                    console.log(`Overseer: ${handle.sessionName} exited (code: ${statusStr})`);
                    this.onOverseerDone();
                    return;
                }
            }
            catch {
                handle.status = 'completed';
                handle.finishedAt = Date.now();
                this.active.delete(handle.id);
                console.log(`Overseer: ${handle.sessionName} session gone`);
                this.onOverseerDone();
                return;
            }
        }
        handle.status = 'timed_out';
        handle.finishedAt = Date.now();
        console.log(`Overseer: ${handle.sessionName} timed out after ${this.config.timeoutSec}s`);
        await execFileAsync('tmux', ['kill-session', '-t', handle.sessionName]).catch(() => { });
        this.active.delete(handle.id);
        this.onOverseerDone();
    }
    onOverseerDone() {
        if (this.config.mode === 'queue') {
            this.isProcessing = false;
            this.processQueue();
        }
        if (this.config.mode === 'batch' && this.queue.length > 0) {
            this.processBatch();
        }
    }
}
exports.Overseer = Overseer;
//# sourceMappingURL=overseer.js.map