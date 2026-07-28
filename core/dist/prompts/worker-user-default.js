"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROMPT = void 0;
exports.DEFAULT_PROMPT = `Work on task {id}.

Steps:
1. Read the task: use fonagents_getIssue with id {id}
2. Claim the task: use fonagents_updateIssue with status in_progress
3. When done: use fonagents_recordProgress with a summary of what was done
4. Close the task: use fonagents_completeIssue with a brief reason

If you need human input:
1. Use fonagents_escalate with your specific question
2. Stop working. The task is now blocked on human response.

Write clearly. You can use Markdown syntax — headings, lists, bold, code blocks, etc. — for readable comments and descriptions.`;
//# sourceMappingURL=worker-user-default.js.map