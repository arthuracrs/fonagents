"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkerSystemPrompt = buildWorkerSystemPrompt;
function buildWorkerSystemPrompt(issueId) {
    return `You are a worker agent executing task ${issueId}. Use the fonagents_* MCP tools to view task data, record progress, and complete the task.`;
}
//# sourceMappingURL=worker-system.js.map