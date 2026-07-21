#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../core/dist/domain/types.js
var require_types = __commonJS({
  "../../core/dist/domain/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../../core/dist/ports/IssueTrackerPort.js
var require_IssueTrackerPort = __commonJS({
  "../../core/dist/ports/IssueTrackerPort.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../../core/dist/ports/AgentRuntimePort.js
var require_AgentRuntimePort = __commonJS({
  "../../core/dist/ports/AgentRuntimePort.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../../core/dist/ports/UiCommandPort.js
var require_UiCommandPort = __commonJS({
  "../../core/dist/ports/UiCommandPort.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../../core/dist/ports/UiEventPort.js
var require_UiEventPort = __commonJS({
  "../../core/dist/ports/UiEventPort.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// ../../core/dist/ports/ManagerToolsPort.js
var require_ManagerToolsPort = __commonJS({
  "../../core/dist/ports/ManagerToolsPort.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.MANAGER_TOOL_SCHEMAS = void 0;
    exports2.MANAGER_TOOL_SCHEMAS = [
      {
        name: "decompose",
        description: "Decompose a request into a swarm molecule of child issues using a beads formula.",
        inputSchema: {
          type: "object",
          properties: {
            formulaName: { type: "string", description: "Name of the beads formula to pour." },
            vars: { type: "object", description: "Variable substitutions for the formula." }
          },
          required: ["formulaName"]
        }
      },
      {
        name: "dispatchWorker",
        description: "Dispatch a one-shot coding agent onto a ready child issue.",
        inputSchema: {
          type: "object",
          properties: {
            issueId: { type: "string" },
            runtimeId: { type: "string", description: "Agent runtime id (e.g. claude-code). Defaults to the manager runtime." },
            prompt: { type: "string", description: "Optional override prompt; defaults to issue context." }
          },
          required: ["issueId"]
        }
      },
      {
        name: "listReady",
        description: "List claimable/ready work, optionally scoped to a molecule.",
        inputSchema: {
          type: "object",
          properties: { moleculeId: { type: "string" } }
        }
      },
      {
        name: "workerStatus",
        description: "Inspect worker progress by worker id or issue id.",
        inputSchema: {
          type: "object",
          properties: {
            workerId: { type: "string" },
            issueId: { type: "string" }
          }
        }
      },
      {
        name: "escalate",
        description: "Escalate to the human operator. Creates a human gate and blocks until it is resolved via the UI.",
        inputSchema: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Why the human is needed." },
            issueId: { type: "string", description: "Optional related issue." }
          },
          required: ["reason"]
        }
      },
      {
        name: "recordProgress",
        description: "Record a progress comment on an issue (audit trail).",
        inputSchema: {
          type: "object",
          properties: { issueId: { type: "string" }, body: { type: "string" } },
          required: ["issueId", "body"]
        }
      },
      {
        name: "completeIssue",
        description: "Mark an issue as complete.",
        inputSchema: {
          type: "object",
          properties: { issueId: { type: "string" }, reason: { type: "string" } },
          required: ["issueId"]
        }
      }
    ];
  }
});

// ../../core/dist/services/Orchestrator.js
var require_Orchestrator = __commonJS({
  "../../core/dist/services/Orchestrator.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Orchestrator = void 0;
    var DEFAULT_MANAGER_RUNTIME = "opencode";
    var Orchestrator = class {
      tracker;
      runtime;
      events;
      config;
      currentMoleculeId;
      workerSubscriptions = /* @__PURE__ */ new Map();
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
          await this.tracker.recordAudit({ actor: "human", event: "gate.resolved", payload: { gateId, note } });
        this.emit({ type: "gate_resolved", gateId });
      }
      // ── UiCommandPort: worker control ──────────────────────────────────────────────
      async cancelWorker(workerId) {
        await this.runtime.cancelWorker(workerId);
      }
      // ── UiCommandPort: queries (delegate to tracker/runtime) ────────────────────
      listIssues(filter) {
        return this.tracker.listIssues(filter);
      }
      getIssue(id) {
        return this.tracker.getIssue(id);
      }
      listMolecules() {
        return this.tracker.listMolecules();
      }
      showMolecule(id) {
        return this.tracker.showMolecule(id);
      }
      listReadyWork() {
        return this.tracker.readyWork();
      }
      listGates() {
        return this.tracker.listGates({ open: true });
      }
      getWorkerStatus(workerId) {
        return Promise.resolve(this.runtime.getWorker(workerId));
      }
      listWorkers() {
        return Promise.resolve(this.runtime.listWorkers());
      }
      listRuntimes() {
        return this.runtime.listRuntimes();
      }
      listComments(issueId) {
        return this.tracker.listComments(issueId);
      }
      listDependencies(issueId) {
        return this.tracker.listDependencies(issueId);
      }
      children(parentId) {
        return this.tracker.children(parentId);
      }
      listFormulas() {
        return this.tracker.listFormulas();
      }
      // ── UiCommandPort: direct issue CRUD ──────────────────────────────────────────
      createIssue(input) {
        return this.tracker.createIssue(input);
      }
      updateIssue(id, patch) {
        return this.tracker.updateIssue(id, patch);
      }
      closeIssue(id, reason) {
        return this.tracker.closeIssue(id, reason);
      }
      reopenIssue(id) {
        return this.tracker.reopenIssue(id);
      }
      claimIssue(id) {
        return this.tracker.claimIssue(id);
      }
      addComment(issueId, body) {
        return this.tracker.addComment(issueId, body, "Human");
      }
      addDependency(childId, parentId, type) {
        return this.tracker.addDependency(childId, parentId, type);
      }
      // ── ManagerToolsPort: tools the manager LLM calls via MCP ──────────────────────
      async decompose(input) {
        const mol = await this.tracker.pourMolecule(input.formulaName, input.vars);
        this.currentMoleculeId = mol.id;
        const children = await this.tracker.children(mol.rootIssueId);
        this.emit({ type: "molecule_poured", moleculeId: mol.id, formulaName: input.formulaName });
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
          systemPrompt: `You are a worker agent executing beads issue ${input.issueId}.

${issue.description}`,
          mode: "tmux",
          cwd: this.config.projectDir
        };
        const worker = await this.runtime.spawnWorker(spawnInput);
        this.emit({ type: "worker_started", worker });
        const unsub = this.runtime.subscribeWorker(worker.id, (ev) => {
          this.forwardWorkerEvent(worker.id, ev);
          if (ev.type === "done" || ev.type === "failed") {
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
        return ready.map((r) => ({ issueId: r.issueId, title: r.title, status: "ready" }));
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
          throw new Error("Cannot escalate without an issue context \u2014 provide issueId or decompose first.");
        const gate = await this.tracker.createGate({
          issueId,
          type: "human",
          reason: input.reason
        });
        this.emit({ type: "gate_opened", gate });
        return { gateId: gate.id };
      }
      async recordProgress(input) {
        await this.tracker.addComment(input.issueId, input.body, "fonagents-manager");
        this.emit({ type: "issue_changed", issueId: input.issueId, change: "commented" });
      }
      async completeIssue(input) {
        await this.tracker.closeIssue(input.issueId, input.reason);
        this.emit({ type: "issue_changed", issueId: input.issueId, change: "closed" });
      }
      // ── Helpers ────────────────────────────────────────────────────────────────────
      forwardWorkerEvent(workerId, ev) {
        if (ev.type === "text")
          this.emit({ type: "worker_output", workerId, delta: ev.delta });
        else if (ev.type === "done")
          this.emit({ type: "worker_status", workerId, status: "completed", exitCode: ev.exitCode });
        else if (ev.type === "failed")
          this.emit({ type: "worker_status", workerId, status: "failed", exitCode: ev.exitCode });
      }
      async currentMoleculeRoot() {
        if (!this.currentMoleculeId)
          return void 0;
        const molecules = await this.tracker.listMolecules();
        const mol = molecules.find((m) => m.id === this.currentMoleculeId);
        return mol?.rootIssueId;
      }
      emit(event) {
        this.events.emit(event);
      }
    };
    exports2.Orchestrator = Orchestrator;
  }
});

// ../../core/dist/index.js
var require_dist = __commonJS({
  "../../core/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_types(), exports2);
    __exportStar(require_IssueTrackerPort(), exports2);
    __exportStar(require_AgentRuntimePort(), exports2);
    __exportStar(require_UiCommandPort(), exports2);
    __exportStar(require_UiEventPort(), exports2);
    __exportStar(require_ManagerToolsPort(), exports2);
    __exportStar(require_Orchestrator(), exports2);
  }
});

// src/mcp-server.ts
var import_core = __toESM(require_dist());
var daemonUrl = (() => {
  const idx = process.argv.indexOf("--daemon-url");
  return idx >= 0 ? process.argv[idx + 1] : "http://localhost:3001";
})();
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
async function handleRequest(req) {
  switch (req.method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "fonagents", version: "0.0.0" }
      };
    case "tools/list":
      return {
        tools: import_core.MANAGER_TOOL_SCHEMAS.map((s) => ({
          name: s.name,
          description: s.description,
          inputSchema: s.inputSchema
        }))
      };
    case "tools/call": {
      const params = req.params ?? {};
      const toolName = params.name;
      const args = params.arguments ?? {};
      const url = `${daemonUrl}/api/mcp/tools/${encodeURIComponent(toolName)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args)
      });
      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error ?? `HTTP ${resp.status}`);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    }
    case "ping":
      return {};
    default:
      throw new Error(`Unknown method: ${req.method}`);
  }
}
var pendingCount = 0;
var buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req;
    try {
      req = JSON.parse(trimmed);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    pendingCount++;
    try {
      const result = await handleRequest(req);
      send({ jsonrpc: "2.0", id: req.id, result });
    } catch (err) {
      send({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32603, message: err.message }
      });
    } finally {
      pendingCount--;
      maybeExit();
    }
  }
});
function maybeExit() {
  if (stdinClosed && pendingCount === 0) {
    process.exit(0);
  }
}
var stdinClosed = false;
process.stdin.on("end", () => {
  stdinClosed = true;
  maybeExit();
});
