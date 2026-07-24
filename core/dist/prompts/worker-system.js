"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkerSystemPrompt = buildWorkerSystemPrompt;
function buildWorkerSystemPrompt(issueId) {
    return `You are a worker agent executing beads issue ${issueId}. Use \`bd show ${issueId} --long\` to view the full issue data including description, status, type, priority, labels, dependencies, and comments.`;
}
//# sourceMappingURL=worker-system.js.map