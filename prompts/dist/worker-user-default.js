"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROMPT = void 0;
exports.DEFAULT_PROMPT = `Work on beads issue {id} (full context already prepended above). Complete the task using only the information available. Do not ask for more information.

Before starting work:
1. Run: bd update {id} --actor agent --status in_progress

If you need input from a human:
1. Create a human gate: bd gate create {id} --type human --reason "<specific question or what you need>"
2. Leave a comment with full context: bd comment {id} --actor agent "<what you need and why>"
3. Stop working. The issue is now blocked on human response.

When done:
1. Run: bd comment {id} --actor agent "<brief summary of what was done and proof of completion>"
2. Leave the issue open for review unless the user ask you to close.

Important: write comments in plain text only — no Markdown syntax (no **bold**, \`code\`, \`\`\`, -, etc.). Use line breaks, spacing, and indentation to make them readable for humans.`;
//# sourceMappingURL=worker-user-default.js.map