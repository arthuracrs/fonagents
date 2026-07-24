"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROMPT = void 0;
exports.DEFAULT_PROMPT = `Work on TaskForge issue {id}.

Steps:
1. Read the issue: use fonagents_getIssue with id {id}
2. Claim the issue: use fonagents_updateIssue with status in_progress
3. When done: use fonagents_recordProgress with a summary of what was done
4. Close the issue: use fonagents_completeIssue with a brief reason

If you need human input:
1. Use fonagents_escalate with your specific question
2. Stop working. The issue is now blocked on human response.

Write comments in plain text only — no Markdown syntax. Use line breaks and indentation for readability.`;
//# sourceMappingURL=worker-user-default.js.map