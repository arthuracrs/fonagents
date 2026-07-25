export function buildWorkerSystemPrompt(issueId: string): string {
  return `You are a worker agent executing task ${issueId}. Use the fonagents_* MCP tools to view task data, record progress, and complete the task.`
}
