"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDaemon = startDaemon;
const core_1 = require("@fonagents/core");
const beads_adapter_1 = require("@fonagents/beads-adapter");
const anagent_adapter_1 = require("@fonagents/anagent-adapter");
const http_sse_adapter_1 = require("@fonagents/http-sse-adapter");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// __dirname is injected by esbuild's banner so it points to the real file
// location, regardless of npm's bin symlink. See daemon/package.json build script.
// Default manager system prompt — teaches the manager about its tools and the
// beads workflow. Can be overridden via MANAGER_SYSTEM_PROMPT env var or
// MANAGER_PROMPT_FILE path.
const DEFAULT_MANAGER_PROMPT = [
    'You are the manager agent for a software project tracked by Beads (bd).',
    'The human operator talks only to you. You are responsible for:',
    '',
    '1. DECOMPOSITION: When the human gives you a task, use the `decompose` tool',
    '   to pour a swarm molecule. This creates child issues you can dispatch workers onto.',
    '2. DISPATCH: Use `dispatchWorker` to send a coding agent onto each ready child issue.',
    '   Workers run autonomously in headless mode and report back through you.',
    '3. MONITORING: Use `workerStatus` to check on dispatched workers. Use `listReady`',
    '   to find the next claimable step.',
    '4. COMPLETION: When a worker finishes, use `completeIssue` to close its issue.',
    '   Use `recordProgress` to document what happened.',
    '5. ESCALATION: When you need a human decision, use `escalate`. This creates a gate',
    '   that blocks until the human resolves it in the UI. Use this for:',
    '   - Ambiguous requirements',
    '   - Architecture decisions',
    '   - When all workers are stuck',
    '',
    'IMPORTANT: Always use the provided tools. Do NOT shell out to bd or try to spawn',
    'agents directly — the system handles that for you and records everything.',
].join('\n');
function startDaemon(opts = {}) {
    const projectDir = opts.projectDir ?? process.env.PROJECT_DIR ?? process.cwd();
    const port = opts.port ?? parseInt(process.env.PORT ?? '3001', 10);
    // ── 1. Create the event bus (UiEventPort) ───────────────────────────────────
    const eventBus = new http_sse_adapter_1.SseEventBus();
    // ── 2. Write the MCP config (so the manager can call core's tools) ──────────
    // The config format depends on the runtime: claude-code uses a JSON file
    // passed via --mcp-config; opencode uses a .opencode/opencode.json file
    // discovered from the cwd.
    const managerRuntime = opts.managerRuntimeId ?? process.env.MANAGER_RUNTIME ?? 'opencode';
    const mcpFormat = managerRuntime === 'claude-code' ? 'claude-code' : 'opencode';
    const pkgRoot = path_1.default.resolve(__dirname, '../..');
    const mcpServerScript = path_1.default.join(pkgRoot, 'adapters/http-sse/dist/mcp-server.js');
    const mcpConfigPath = (0, http_sse_adapter_1.writeMcpConfig)({
        daemonUrl: `http://localhost:${port}`,
        mcpServerScript,
        format: mcpFormat,
    });
    // For opencode, copy the .opencode/ config into the project dir so opencode
    // discovers it when launched with --cwd <projectDir>.
    if (mcpFormat === 'opencode') {
        const projectOpencodeDir = path_1.default.join(projectDir, '.opencode');
        fs_1.default.mkdirSync(projectOpencodeDir, { recursive: true });
        const destConfig = path_1.default.join(projectOpencodeDir, 'opencode.json');
        const srcConfig = path_1.default.join(path_1.default.dirname(mcpConfigPath), 'opencode.json');
        // Merge with existing config if present, otherwise just copy
        if (fs_1.default.existsSync(destConfig)) {
            try {
                const existing = JSON.parse(fs_1.default.readFileSync(destConfig, 'utf8'));
                const mcpSection = JSON.parse(fs_1.default.readFileSync(srcConfig, 'utf8'));
                existing.mcp = { ...(existing.mcp ?? {}), ...mcpSection.mcp };
                fs_1.default.writeFileSync(destConfig, JSON.stringify(existing, null, 2), 'utf8');
            }
            catch {
                fs_1.default.copyFileSync(srcConfig, destConfig);
            }
        }
        else {
            fs_1.default.copyFileSync(srcConfig, destConfig);
        }
    }
    // ── 3. Create the adapters (the hexagon's outside) ──────────────────────────
    const tracker = new beads_adapter_1.BeadsAdapter({
        bdPath: opts.bdPath ?? process.env.BD_PATH,
        projectDir,
        actor: process.env.BEADS_ACTOR,
    });
    const runtime = new anagent_adapter_1.AnagentAdapter({
        anagentPath: opts.anagentPath ?? process.env.ANAGENT_PATH,
        cwd: projectDir,
    });
    // ── 4. Resolve the manager system prompt ─────────────────────────────────────
    const managerSystemPrompt = opts.managerSystemPrompt
        ?? (opts.managerPromptFile
            ? fs_1.default.readFileSync(opts.managerPromptFile, 'utf8')
            : process.env.MANAGER_SYSTEM_PROMPT
                ?? DEFAULT_MANAGER_PROMPT);
    // ── 5. Create the Orchestrator (the hexagon's inside) ────────────────────────
    const orchestratorConfig = {
        projectDir,
        managerRuntimeId: managerRuntime,
        managerSystemPrompt,
        mcpConfigPath,
    };
    const orchestrator = new core_1.Orchestrator(tracker, runtime, eventBus, orchestratorConfig);
    // ── 6. Create the Express app (wire routes to the orchestrator) ──────────────
    const { app } = (0, http_sse_adapter_1.createHttpSseApp)(orchestrator, orchestrator, eventBus, { port, projectDir });
    // ── 7. Serve the web UI if beads-ui's dist exists ────────────────────────────
    const beadsUiDist = path_1.default.join(pkgRoot, 'beads-ui/dist');
    if (fs_1.default.existsSync(beadsUiDist)) {
        app.use(express_1.default.static(beadsUiDist));
        app.get('/*path', (_req, res) => {
            res.sendFile(path_1.default.join(beadsUiDist, 'index.html'));
        });
    }
    // ── 8. Start ──────────────────────────────────────────────────────────────────
    const server = app.listen(port, () => {
        console.log(`fonagents daemon: http://localhost:${port}`);
        console.log(`Project:          ${projectDir}`);
        console.log(`MCP config:       ${mcpConfigPath}`);
        console.log(`Events:           GET /api/events (SSE)`);
        console.log(`Message:          POST /api/message`);
    });
    // ── 9. Graceful shutdown ─────────────────────────────────────────────────────
    const shutdown = async () => {
        console.log('\nShutting down...');
        try {
            await orchestrator.endManager();
        }
        catch { /* ok */ }
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 5000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
//# sourceMappingURL=daemon.js.map