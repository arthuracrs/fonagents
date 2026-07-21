"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.daemonStatePath = daemonStatePath;
exports.startDaemon = startDaemon;
exports.stopDaemon = stopDaemon;
const core_1 = require("@fonagents/core");
const beads_adapter_1 = require("@fonagents/beads-adapter");
const anagent_adapter_1 = require("@fonagents/anagent-adapter");
const http_sse_adapter_1 = require("@fonagents/http-sse-adapter");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let _server = null;
let _projectDir = null;
function daemonStatePath(projectDir) {
    return path_1.default.join(projectDir, '.fonagents', 'daemon.json');
}
function writeStateFile(projectDir, port) {
    const statePath = daemonStatePath(projectDir);
    fs_1.default.mkdirSync(path_1.default.dirname(statePath), { recursive: true });
    fs_1.default.writeFileSync(statePath, JSON.stringify({ port, projectDir, pid: process.pid }, null, 2), 'utf8');
}
function removeStateFile(projectDir) {
    try {
        fs_1.default.unlinkSync(daemonStatePath(projectDir));
    }
    catch { /* ok */ }
}
function startDaemon(opts = {}) {
    const projectDir = opts.projectDir ?? process.env.PROJECT_DIR ?? process.cwd();
    _projectDir = projectDir;
    const port = opts.port ?? parseInt(process.env.PORT ?? '3001', 10);
    const eventBus = new http_sse_adapter_1.SseEventBus();
    const managerRuntime = opts.managerRuntimeId ?? process.env.MANAGER_RUNTIME ?? 'opencode';
    const mcpFormat = managerRuntime === 'claude-code' ? 'claude-code' : 'opencode';
    const pkgRoot = path_1.default.resolve(__dirname, '../..');
    const mcpServerScript = path_1.default.join(pkgRoot, 'adapters/http-sse/dist/mcp-server.js');
    const mcpConfigPath = (0, http_sse_adapter_1.writeMcpConfig)({
        daemonUrl: `http://localhost:${port}`,
        mcpServerScript,
        format: mcpFormat,
    });
    if (mcpFormat === 'opencode') {
        const projectOpencodeDir = path_1.default.join(projectDir, '.opencode');
        fs_1.default.mkdirSync(projectOpencodeDir, { recursive: true });
        const destConfig = path_1.default.join(projectOpencodeDir, 'opencode.json');
        const srcConfig = path_1.default.join(path_1.default.dirname(mcpConfigPath), 'opencode.json');
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
    const tracker = new beads_adapter_1.BeadsAdapter({
        bdPath: opts.bdPath ?? process.env.BD_PATH,
        projectDir,
        actor: process.env.BEADS_ACTOR,
    });
    const runtime = new anagent_adapter_1.AnagentAdapter({
        anagentPath: opts.anagentPath ?? process.env.ANAGENT_PATH,
        cwd: projectDir,
    });
    const orchestratorConfig = {
        projectDir,
        managerRuntimeId: managerRuntime,
    };
    const orchestrator = new core_1.Orchestrator(tracker, runtime, eventBus, orchestratorConfig);
    const { app } = (0, http_sse_adapter_1.createHttpSseApp)(orchestrator, orchestrator, eventBus, { port, projectDir });
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', port, projectDir });
    });
    const beadsUiDist = path_1.default.join(pkgRoot, 'beads-ui/dist');
    if (fs_1.default.existsSync(beadsUiDist)) {
        app.use(express_1.default.static(beadsUiDist));
        app.get('/*path', (req, res) => {
            if (req.path.startsWith('/api/')) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            res.sendFile(path_1.default.join(beadsUiDist, 'index.html'));
        });
    }
    return new Promise((resolve, reject) => {
        try {
            const server = app.listen(port, () => {
                const actualPort = server.address().port;
                _server = server;
                writeStateFile(projectDir, actualPort);
                console.log(`fonagents daemon: http://localhost:${actualPort}`);
                console.log(`Project:          ${projectDir}`);
                console.log(`MCP config:       ${mcpConfigPath}`);
                console.log(`Events:           GET /api/events (SSE)`);
                resolve({ port: actualPort, mcpConfigPath, projectDir, managerRuntimeId: managerRuntime });
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
function stopDaemon() {
    if (_server) {
        const s = _server;
        _server = null;
        s.close(() => { });
    }
    if (_projectDir) {
        removeStateFile(_projectDir);
        _projectDir = null;
    }
}
//# sourceMappingURL=daemon.js.map