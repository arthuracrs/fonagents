export function buildWorkerSystemPrompt(issueId: string): string {
  return `You are a worker agent executing TaskForge issue ${issueId}. Use the fonagents_* MCP tools to view issue data, record progress, and complete the issue.`
}
