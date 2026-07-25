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
        description: "Break a request into a set of related tasks using a TaskForge template.",
        inputSchema: {
          type: "object",
          properties: {
            formulaName: { type: "string", description: "Name of the TaskForge template." },
            vars: { type: "object", description: "Variable substitutions for the template." }
          },
          required: ["formulaName"]
        }
      },
      {
        name: "dispatchWorker",
        description: "Dispatch a coding agent onto a ready task. Respects a max-concurrent-workers limit (default 5, configurable via FONAGENTS_MAX_WORKERS).",
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
        name: "listIssues",
        description: "List all tasks on the board, with optional filtering by status, type, assignee, etc.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status (e.g. todo, in_progress, done)." },
            type: { type: "string", description: "Filter by issue type (e.g. task, bug)." },
            assignee: { type: "string", description: "Filter by assignee." },
            moleculeId: { type: "string", description: "Filter by task group id." }
          }
        }
      },
      {
        name: "listReady",
        description: "List ready tasks, optionally scoped to a task group.",
        inputSchema: {
          type: "object",
          properties: { moleculeId: { type: "string", description: "Optional task group id to scope to." } }
        }
      },
      {
        name: "workerStatus",
        description: "Inspect worker progress by worker id or task id.",
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
        description: "Escalate to the human. Creates a human gate and blocks until resolved via the UI.",
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
        description: "Record a progress comment on a task (audit trail).",
        inputSchema: {
          type: "object",
          properties: { issueId: { type: "string" }, body: { type: "string" } },
          required: ["issueId", "body"]
        }
      },
      {
        name: "completeIssue",
        description: "Mark a task as complete.",
        inputSchema: {
          type: "object",
          properties: { issueId: { type: "string" }, reason: { type: "string" } },
          required: ["issueId"]
        }
      },
      {
        name: "resetStaleTasks",
        description: "Reset in_progress tasks with no active workers back to open. Use when listReady returns empty but tasks are stuck in_progress with zero running workers.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "overseerStatus",
        description: "Get the overseer status \u2014 auto-dispatch supervisor that automatically dispatches workers after each worker completes.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];
  }
});

// ../../core/dist/prompts/worker-user-default.js
var require_worker_user_default = __commonJS({
  "../../core/dist/prompts/worker-user-default.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULT_PROMPT = void 0;
    exports2.DEFAULT_PROMPT = `Work on task {id}.

Steps:
1. Read the task: use fonagents_getIssue with id {id}
2. Claim the task: use fonagents_updateIssue with status in_progress
3. When done: use fonagents_recordProgress with a summary of what was done
4. Close the task: use fonagents_completeIssue with a brief reason

If you need human input:
1. Use fonagents_escalate with your specific question
2. Stop working. The task is now blocked on human response.

Write comments in plain text only \u2014 no Markdown syntax. Use line breaks and indentation for readability.`;
  }
});

// ../../core/dist/prompts/worker-system.js
var require_worker_system = __commonJS({
  "../../core/dist/prompts/worker-system.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildWorkerSystemPrompt = buildWorkerSystemPrompt;
    function buildWorkerSystemPrompt(issueId) {
      return `You are a worker agent executing task ${issueId}. Use the fonagents_* MCP tools to view task data, record progress, and complete the task.`;
    }
  }
});

// ../../core/dist/prompts/manager-system.js
var require_manager_system = __commonJS({
  "../../core/dist/prompts/manager-system.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.MANAGER_PROMPT = void 0;
    exports2.MANAGER_PROMPT = `You are the fonagents Manager. You coordinate AI-assisted development by breaking down work, dispatching agents, and tracking progress through TaskForge.

You express all concepts in terms of tasks, not beads or molecules.

Available MCP tools (fonagents):

tool  | decompose
---   | ---
input | formulaName (string, required), vars (object, optional)
desc  | Break a request into a set of related tasks using a TaskForge template.

tool  | dispatchWorker
---   | ---
input | issueId (string, required), runtimeId (string, optional), prompt (string, optional)
desc  | Dispatch a coding agent onto a ready task.

tool  | listIssues
---   | ---
input | status (string, optional), title (string, optional)
desc  | List all tasks on the board, with optional filtering.

tool  | listReady
---   | ---
input | taskGroupId (string, optional)
desc  | List ready tasks, optionally scoped to a task group.

tool  | workerStatus
---   | ---
input | workerId (string, optional), issueId (string, optional)
desc  | Inspect worker progress by worker id or task id.

tool  | escalate
---   | ---
input | reason (string, required), issueId (string, optional)
desc  | Escalate to the human. Creates a human gate and blocks until resolved via the UI.

tool  | recordProgress
---   | ---
input | issueId (string, required), body (string, required)
desc  | Record a progress comment on a task (audit trail).

tool  | completeIssue
---   | ---
input | issueId (string, required), reason (string, optional)
desc  | Mark a task as complete.

tool  | overseerStatus
---   | ---
input | (none)
desc  | Get the overseer status \u2014 auto-dispatch supervisor state.

tool  | resetStaleTasks
---   | ---
input | (none)
desc  | Reset in_progress tasks with no active workers back to open. Recovers from stale state after crashes or reboots.

Workflow:
1. On startup, use \`listIssues\` to survey the full task board.
2. When the user gives a high-level request, use \`decompose\` to break it into tasks.
3. Use \`listReady\` to see available work.
4. Dispatch \`dispatchWorker\` to assign tasks to coding agents.
5. Monitor progress with \`workerStatus\`.
6. Record updates with \`recordProgress\`.
7. Mark completed tasks with \`completeIssue\`.
8. Use \`escalate\` when you need human input or approval.
9. Use \`overseerStatus\` to check if the auto-dispatch overseer is running.

System health check (run this regularly):
1. Use \`listIssues\` to see all tasks and their statuses across the board.
2. If ALL tasks are in_progress but \`workerStatus\` shows zero active workers, call \`resetStaleTasks\` to recover.
3. For each in_progress task, call \`workerStatus\` with its issueId to check if a worker is running.
4. If a task is in_progress but no worker is running for it:
   a. If ready (unblocked), dispatch a worker.
   b. If blocked or stuck, call \`recordProgress\` then \`escalate\`.
5. If a task is in_progress with a running worker, check if it's still making progress.
6. Report any anomalies you find.

Rules:
- NEVER execute tasks yourself. You are a manager, not a worker. Always use \`dispatchWorker\`.
- Do not write code, run commands, or edit files directly.
- If there is ready work, dispatch workers immediately.
- You are responsible for system health: ensure every in_progress task has a running worker.

The web dashboard at http://localhost:PORT provides visualization and monitoring.`;
  }
});

// ../../core/dist/prompts/manager-initial.js
var require_manager_initial = __commonJS({
  "../../core/dist/prompts/manager-initial.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.INITIAL_PROMPT = void 0;
    exports2.INITIAL_PROMPT = "Review the current task board using listIssues to see all tasks, check for all tasks, closed, blocked or in-progress tasks that might need attention. Check if there is any workers active and the tasks they are working on. Then ask the user what they want to work on.";
  }
});

// ../../core/dist/prompts/overseer-system.js
var require_overseer_system = __commonJS({
  "../../core/dist/prompts/overseer-system.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.OVERSEER_SYSTEM_PROMPT = void 0;
    exports2.OVERSEER_SYSTEM_PROMPT = `You are a fonagents Overseer. You automatically review the board after workers complete and dispatch new work.

You express all concepts in terms of tasks, not beads or molecules.

Available MCP tools (fonagents):

tool  | decompose
---   | ---
input | formulaName (string, required), vars (object, optional)
desc  | Break a request into a set of related tasks using a TaskForge template.

tool  | dispatchWorker
---   | ---
input | issueId (string, required), runtimeId (string, optional), prompt (string, optional)
desc  | Dispatch a coding agent onto a ready task.

tool  | listReady
---   | ---
input | taskGroupId (string, optional)
desc  | List ready tasks, optionally scoped to a task group.

tool  | workerStatus
---   | ---
input | workerId (string, optional), issueId (string, optional)
desc  | Inspect worker progress by worker id or task id.

tool  | escalate
---   | ---
input | reason (string, required), issueId (string, optional)
desc  | Escalate to the human. Creates a human gate and blocks until resolved via the UI.

tool  | recordProgress
---   | ---
input | issueId (string, required), body (string, required)
desc  | Record a progress comment on a task (audit trail).

tool  | completeIssue
---   | ---
input | issueId (string, required), reason (string, optional)
desc  | Mark a task as complete.

Workflow:
1. Use \`listReady\` to find open tasks ready for work.
2. For each in_progress task, call \`workerStatus\` to check if a worker is running.
3. If a task is in_progress but no worker is running for it:
   a. If ready (unblocked), dispatch a worker.
   b. If blocked or stuck, record progress then escalate.
4. If in_progress with a running worker, check progress.
5. Complete done tasks: use \`completeIssue\`.
6. Check ready work: use \`listReady\`.
7. Dispatch workers on ready tasks: use \`dispatchWorker\`.
8. If no ready work and no active workers, exit.

Rules:
- NEVER execute tasks yourself. Always use \`dispatchWorker\`.
- If nothing to do, exit immediately. Do not ask questions.
- Ensure every in_progress task has a running worker.`;
  }
});

// ../../core/dist/prompts/overseer-user.js
var require_overseer_user = __commonJS({
  "../../core/dist/prompts/overseer-user.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildOverseerPrompt = buildOverseerPrompt;
    function buildOverseerPrompt(completedIssues, failedIssues) {
      const parts = [];
      if (completedIssues.length > 0) {
        parts.push(`Workers for these issues just completed: ${completedIssues.join(", ")}`);
      }
      if (failedIssues.length > 0) {
        parts.push(`Workers for these issues failed: ${failedIssues.join(", ")}`);
      }
      parts.push("");
      parts.push("Review the board state and dispatch ready tasks.");
      return parts.join("\n");
    }
  }
});

// ../../core/dist/prompts/index.js
var require_prompts = __commonJS({
  "../../core/dist/prompts/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildOverseerPrompt = exports2.OVERSEER_SYSTEM_PROMPT = exports2.INITIAL_PROMPT = exports2.MANAGER_PROMPT = exports2.buildWorkerSystemPrompt = exports2.DEFAULT_PROMPT = void 0;
    var worker_user_default_js_1 = require_worker_user_default();
    Object.defineProperty(exports2, "DEFAULT_PROMPT", { enumerable: true, get: function() {
      return worker_user_default_js_1.DEFAULT_PROMPT;
    } });
    var worker_system_js_1 = require_worker_system();
    Object.defineProperty(exports2, "buildWorkerSystemPrompt", { enumerable: true, get: function() {
      return worker_system_js_1.buildWorkerSystemPrompt;
    } });
    var manager_system_js_1 = require_manager_system();
    Object.defineProperty(exports2, "MANAGER_PROMPT", { enumerable: true, get: function() {
      return manager_system_js_1.MANAGER_PROMPT;
    } });
    var manager_initial_js_1 = require_manager_initial();
    Object.defineProperty(exports2, "INITIAL_PROMPT", { enumerable: true, get: function() {
      return manager_initial_js_1.INITIAL_PROMPT;
    } });
    var overseer_system_js_1 = require_overseer_system();
    Object.defineProperty(exports2, "OVERSEER_SYSTEM_PROMPT", { enumerable: true, get: function() {
      return overseer_system_js_1.OVERSEER_SYSTEM_PROMPT;
    } });
    var overseer_user_js_1 = require_overseer_user();
    Object.defineProperty(exports2, "buildOverseerPrompt", { enumerable: true, get: function() {
      return overseer_user_js_1.buildOverseerPrompt;
    } });
  }
});

// ../../core/dist/services/Orchestrator.js
var require_Orchestrator = __commonJS({
  "../../core/dist/services/Orchestrator.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Orchestrator = void 0;
    var index_js_1 = require_prompts();
    var DEFAULT_WORKER_RUNTIME = "opencode";
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
        const max = this.config.maxWorkers ?? 5;
        const active = this.workerSubscriptions.size;
        if (active >= max) {
          throw new Error(`Cannot dispatch: ${active} workers already running (max ${max}). Wait for one to finish or increase the limit.`);
        }
        const issue = await this.tracker.getIssue(input.issueId);
        if (!issue)
          throw new Error(`Cannot dispatch: issue ${input.issueId} not found`);
        await this.tracker.claimIssue(input.issueId, "manager");
        const spawnInput = {
          issueId: input.issueId,
          runtimeId: input.runtimeId ?? DEFAULT_WORKER_RUNTIME,
          prompt: input.prompt ?? index_js_1.DEFAULT_PROMPT.replaceAll("{id}", input.issueId),
          systemPrompt: (0, index_js_1.buildWorkerSystemPrompt)(input.issueId),
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
      async resetStaleTasks() {
        const inProgress = await this.tracker.listIssues({ status: "in_progress" });
        const resetIds = [];
        for (const issue of inProgress) {
          const workers = this.runtime.getWorkersForIssue(issue.id);
          if (workers.length === 0) {
            await this.tracker.updateIssue(issue.id, { status: "open" });
            resetIds.push(issue.id);
            this.emit({ type: "issue_changed", issueId: issue.id, change: "reset" });
          }
        }
        return { resetIssueIds: resetIds };
      }
      async overseerStatus() {
        return {
          enabled: this.config.overseer?.enabled ?? true,
          mode: this.config.overseer?.mode ?? "queue",
          activeOverseers: 0,
          queueLength: 0
        };
      }
      // Update overseer config at runtime (called by daemon after UI toggle).
      setOverseerConfig(config) {
        this.config.overseer = config;
      }
      // ── Helpers ────────────────────────────────────────────────────────────────────
      forwardWorkerEvent(workerId, ev) {
        if (ev.type === "text")
          this.emit({ type: "worker_output", workerId, delta: ev.delta });
        else if (ev.type === "done") {
          const worker = this.runtime.getWorker(workerId);
          this.emit({ type: "worker_status", workerId, issueId: worker?.issueId ?? "", status: "completed", exitCode: ev.exitCode });
        } else if (ev.type === "failed") {
          const worker = this.runtime.getWorker(workerId);
          this.emit({ type: "worker_status", workerId, issueId: worker?.issueId ?? "", status: "failed", exitCode: ev.exitCode });
        }
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
    __exportStar(require_prompts(), exports2);
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
