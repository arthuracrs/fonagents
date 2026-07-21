export function buildWorkerSystemPrompt(issueId: string, description: string): string {
  return `You are a worker agent executing beads issue ${issueId}.\n\n${description}`
}
