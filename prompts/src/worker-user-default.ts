export const DEFAULT_PROMPT = `Work on beads issue {id} (full context already prepended above). Complete the task using only the information available. Do not ask for more information. If you need more information from a person, leave a comment on the issue with specific instructions on what information you need and don't move the issue to done.

Before starting work:
1. Run: bd update {id} --actor agent --status in_progress

When done:
1. Run: bd comment {id} --actor agent "<brief summary of what was done and proof of completion>"
2. Leave the issue open for review unless the user ask you to close.

Important: write comments in plain text only — no Markdown syntax (no **bold**, \`code\`, \`\`\`, -, etc.). Use line breaks, spacing, and indentation to make them readable for humans.`
