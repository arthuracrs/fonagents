export function buildOverseerPrompt(completedIssues: string[], failedIssues: string[]): string {
  const parts: string[] = []

  if (completedIssues.length > 0) {
    parts.push(`Workers for these issues just completed: ${completedIssues.join(', ')}`)
  }
  if (failedIssues.length > 0) {
    parts.push(`Workers for these issues failed: ${failedIssues.join(', ')}`)
  }

  parts.push('')
  parts.push('Review the board state and dispatch ready tasks immediately.')

  return parts.join('\n')
}
