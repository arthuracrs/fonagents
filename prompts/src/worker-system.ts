export function buildWorkerSystemPrompt(issueId: string): string {
  return `You are a worker agent executing beads issue ${issueId}. Use \`bd show ${issueId} --long\` to view the full issue data including description, status, type, priority, labels, dependencies, and comments.`
}
