"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnagentAdapter = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const protocol_js_1 = require("./protocol.js");
// Implements AgentRuntimePort by shelling out to `anagent run --stream`.
// Workers are one-shot anagent invocations. The manager is a series of
// anagent invocations linked by --resume (each turn is a separate process;
// claude code's session JSONL provides continuity).
class AnagentAdapter {
    workers = new Map();
    listeners = new Map();
    managerSessions = new Map();
    bin;
    binArgs;
    cwd;
    constructor(config) {
        const resolved = resolveAnagent(config.anagentPath);
        this.bin = resolved.bin;
        this.binArgs = resolved.prefixArgs;
        this.cwd = config.cwd;
    }
    // ── Runtimes ────────────────────────────────────────────────────────────────
    async listRuntimes() {
        return new Promise((resolve, reject) => {
            const args = [...this.binArgs, 'runtimes', '--json'];
            const proc = (0, child_process_1.spawn)(this.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
                if (code === 0 && stdout.trim()) {
                    try {
                        const parsed = JSON.parse(stdout);
                        resolve(parsed.map((r) => ({
                            id: r.id,
                            name: r.name,
                            description: r.description,
                            defaultMode: r.defaultMode,
                        })));
                    }
                    catch (e) {
                        reject(new Error(`Failed to parse anagent runtimes: ${e.message}`));
                    }
                }
                else {
                    reject(new Error(`anagent runtimes exited ${code}: ${stderr.slice(0, 200)}`));
                }
            });
            proc.on('error', reject);
        });
    }
    // ── Workers ──────────────────────────────────────────────────────────────────
    async spawnWorker(input) {
        const id = genId();
        const mode = input.mode ?? 'headless';
        const handle = {
            id,
            issueId: input.issueId,
            runtimeId: input.runtimeId,
            mode,
            status: 'running',
            startedAt: new Date().toISOString(),
        };
        this.workers.set(id, handle);
        const args = [
            ...this.binArgs,
            'run', input.prompt,
            '--stream',
            '--runtime', input.runtimeId,
            '--mode', mode,
            '--system-prompt', input.systemPrompt,
            '--cwd', input.cwd ?? this.cwd,
        ];
        const proc = (0, child_process_1.spawn)(this.bin, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: input.cwd ?? this.cwd,
        });
        handle.process = proc;
        this.pipeEvents(id, proc);
        // Track whether the NDJSON stream emitted a terminal (done/failed) event.
        // If the process is killed without emitting one, we synthesize it in the
        // close handler so the UI learns the worker stopped.
        let streamEmittedTerminal = false;
        const tracker = this.subscribeWorker(id, (event) => {
            if (event.type === 'done' || event.type === 'failed')
                streamEmittedTerminal = true;
        });
        proc.on('close', (code) => {
            handle.exitCode = code ?? undefined;
            handle.status = code === 0 ? 'completed' : (code === null ? 'cancelled' : 'failed');
            handle.finishedAt = new Date().toISOString();
            delete handle.process;
            if (!streamEmittedTerminal) {
                const synthetic = code === 0
                    ? { type: 'done', exitCode: 0, durationMs: 0 }
                    : { type: 'failed', error: `Worker exited with code ${code ?? -1}`, exitCode: code ?? -1, durationMs: 0 };
                this.notify(id, synthetic);
            }
            tracker.unsubscribe();
        });
        proc.on('error', (err) => {
            handle.status = 'failed';
            handle.finishedAt = new Date().toISOString();
            this.notify(id, { type: 'failed', error: err.message, exitCode: -1, durationMs: 0 });
        });
        return handle;
    }
    cancelWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker)
            return Promise.resolve(false);
        if (worker.process) {
            worker.process.kill('SIGTERM');
            delete worker.process;
        }
        if (worker.status === 'running') {
            worker.status = 'cancelled';
            worker.finishedAt = new Date().toISOString();
        }
        return Promise.resolve(true);
    }
    subscribeWorker(workerId, cb) {
        if (!this.listeners.has(workerId))
            this.listeners.set(workerId, new Set());
        this.listeners.get(workerId).add(cb);
        return { unsubscribe: () => this.listeners.get(workerId)?.delete(cb) };
    }
    getWorker(workerId) {
        const w = this.workers.get(workerId);
        return w ? { ...w } : undefined;
    }
    getWorkersForIssue(issueId) {
        return Array.from(this.workers.values())
            .filter((w) => w.issueId === issueId)
            .map((w) => ({ ...w }));
    }
    // ── Manager (persistent session via --resume) ────────────────────────────────
    async startManager(input) {
        const args = [
            ...this.binArgs,
            'run', input.bootstrapMessage,
            '--stream',
            '--runtime', input.runtimeId,
            '--mode', 'headless',
            '--system-prompt', input.systemPrompt,
            '--cwd', input.cwd ?? this.cwd,
        ];
        if (input.mcpConfigPath)
            args.push('--mcp-config', input.mcpConfigPath);
        const events = await this.runStreamingSession(args, input.onEvent);
        const sessionEvent = events.find((e) => e.type === 'session');
        if (!sessionEvent || sessionEvent.type !== 'session') {
            throw new Error('Manager bootstrap did not emit a session event — cannot resume.');
        }
        const sessionId = sessionEvent.sessionId;
        this.managerSessions.set(sessionId, {
            sessionId,
            startedAt: new Date().toISOString(),
            status: 'active',
            runtimeId: input.runtimeId,
            mcpConfigPath: input.mcpConfigPath,
        });
        return { sessionId, events };
    }
    async sendManagerTurn(input) {
        const session = this.managerSessions.get(input.sessionId);
        if (!session)
            throw new Error(`No manager session found for id ${input.sessionId}`);
        // Reuse the same runtime + MCP config as the bootstrap turn.
        // Without --runtime, anagent defaults to 'opencode' — this was the bug
        // that caused manager turns to run opencode instead of claude-code.
        const args = [
            ...this.binArgs,
            'run', input.message,
            '--stream',
            '--resume', input.sessionId,
            '--cwd', this.cwd,
        ];
        if (session.runtimeId)
            args.push('--runtime', session.runtimeId);
        if (session.mcpConfigPath)
            args.push('--mcp-config', session.mcpConfigPath);
        const events = await this.runStreamingSession(args, input.onEvent);
        return events;
    }
    async endManager(sessionId) {
        const session = this.managerSessions.get(sessionId);
        if (session) {
            session.status = 'ended';
            this.managerSessions.delete(sessionId);
        }
    }
    getManagerSession(sessionId) {
        return this.managerSessions.get(sessionId);
    }
    // ── Internals ────────────────────────────────────────────────────────────────
    pipeEvents(workerId, proc) {
        let buf = '';
        proc.stdout?.on('data', (data) => {
            buf += data.toString();
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
                const raw = (0, protocol_js_1.parseNdjsonLine)(line);
                if (!raw)
                    continue;
                const translated = (0, protocol_js_1.translateEvent)(raw);
                if (translated)
                    this.notify(workerId, translated);
            }
        });
        proc.stderr?.on('data', (data) => {
            const chunk = data.toString().trim();
            if (chunk)
                this.notify(workerId, { type: 'text', delta: chunk });
        });
    }
    notify(workerId, event) {
        const subs = this.listeners.get(workerId);
        if (!subs)
            return;
        for (const cb of subs)
            cb(event);
    }
    runStreamingSession(args, onEvent) {
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(this.bin, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                cwd: this.cwd,
            });
            const events = [];
            let buf = '';
            let stderr = '';
            proc.stdout?.on('data', (data) => {
                buf += data.toString();
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    const raw = (0, protocol_js_1.parseNdjsonLine)(line);
                    if (!raw)
                        continue;
                    const translated = (0, protocol_js_1.translateEvent)(raw);
                    if (translated) {
                        events.push(translated);
                        onEvent?.(translated);
                    }
                }
            });
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('close', (code) => {
                // Flush remaining buffer
                if (buf.trim()) {
                    const raw = (0, protocol_js_1.parseNdjsonLine)(buf);
                    if (raw) {
                        const translated = (0, protocol_js_1.translateEvent)(raw);
                        if (translated) {
                            events.push(translated);
                            onEvent?.(translated);
                        }
                    }
                }
                if (code !== 0 && !events.some((e) => e.type === 'done' || e.type === 'failed')) {
                    const failEvent = {
                        type: 'failed',
                        error: stderr.trim().slice(0, 500) || `Exit code ${code}`,
                        exitCode: code ?? -1,
                        durationMs: 0,
                    };
                    events.push(failEvent);
                    onEvent?.(failEvent);
                }
                resolve(events);
            });
            proc.on('error', (err) => {
                reject(new Error(`Failed to spawn anagent: ${err.message}`));
            });
        });
    }
}
exports.AnagentAdapter = AnagentAdapter;
// ── Anagent binary resolution ─────────────────────────────────────────────────
function resolveAnagent(override) {
    if (override)
        return { bin: override, prefixArgs: [] };
    // 1. Check ANAGENT_PATH env
    if (process.env.ANAGENT_PATH)
        return { bin: process.env.ANAGENT_PATH, prefixArgs: [] };
    // 2. Check if anagent is on PATH
    const PATH = process.env.PATH || '';
    for (const dir of PATH.split(':')) {
        const candidate = path_1.default.join(dir, 'anagent');
        if (fs_1.default.existsSync(candidate))
            return { bin: candidate, prefixArgs: [] };
    }
    // 3. npx fallback
    return { bin: 'npx', prefixArgs: ['--yes', 'github:arthuracrs/anagent'] };
}
function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
//# sourceMappingURL=AnagentAdapter.js.map