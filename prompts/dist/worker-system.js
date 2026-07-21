"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkerSystemPrompt = buildWorkerSystemPrompt;
function buildWorkerSystemPrompt(issueId, description) {
    return `You are a worker agent executing beads issue ${issueId}.\n\n${description}`;
}
//# sourceMappingURL=worker-system.js.map