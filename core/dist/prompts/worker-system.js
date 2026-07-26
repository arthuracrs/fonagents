"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkerSystemPrompt = buildWorkerSystemPrompt;
function buildWorkerSystemPrompt(taskId) {
    return `You are a worker agent executing task ${taskId}. Use the fonagents_* MCP tools to view task data, record progress, and complete the task. If it is the case and makes sense for the task, git commit it, be aware that other workers might be working in the same project at the same time.`;
}
//# sourceMappingURL=worker-system.js.map