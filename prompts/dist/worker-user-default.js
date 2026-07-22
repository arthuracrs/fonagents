"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROMPT = void 0;
exports.DEFAULT_PROMPT = `Work on beads issue {id}. Fetch its data with bd show before starting.

Steps:
1. Read the issue: bd show {id} --long
2. Start work: bd update {id} --actor agent --status in_progress
3. When done: bd comment {id} --actor agent "<summary of what was done and proof>"
4. Close the issue: bd close {id} --reason "<brief reason>"

If you need human input:
1. bd gate create {id} --type human --reason "<specific question>"
2. bd comment {id} --actor agent "<context about what you need>"
3. Stop working. The issue is now blocked on human response.

Write comments in plain text only — no Markdown syntax. Use line breaks and indentation for readability.`;
//# sourceMappingURL=worker-user-default.js.map