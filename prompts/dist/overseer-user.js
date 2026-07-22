"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOverseerPrompt = buildOverseerPrompt;
function buildOverseerPrompt(completedIssues, failedIssues) {
    const parts = [];
    if (completedIssues.length > 0) {
        parts.push(`Workers for these issues just completed: ${completedIssues.join(', ')}`);
    }
    if (failedIssues.length > 0) {
        parts.push(`Workers for these issues failed: ${failedIssues.join(', ')}`);
    }
    parts.push('');
    parts.push('Review the board state and dispatch ready work.');
    return parts.join('\n');
}
//# sourceMappingURL=overseer-user.js.map