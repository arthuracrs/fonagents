"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkerSystemPrompt = buildWorkerSystemPrompt;
function buildWorkerSystemPrompt(issueId) {
    return `You are a worker agent executing TaskForge issue ${issueId}. Use the fonagents_* MCP tools to view issue data, record progress, and complete the issue.`;
}
//# sourceMappingURL=worker-system.js.map