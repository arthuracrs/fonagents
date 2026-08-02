export const DEFAULT_PROMPT = `Work on task {id}.

Steps:
1. Read the task: use fonagents_listTasks to find the task with id {id} and read its description
2. Do the work: implement the task in the project
3. When done: use fonagents_recordProgress with a summary of what was done
4. Close the task: use fonagents_completeTask with taskId {id} and a brief reason

If you need human input:
1. Use fonagents_escalate with your specific question
2. Stop working. The task is now blocked on human response.

Write clearly. You can use Markdown syntax — headings, lists, bold, code blocks, etc. — for readable comments and descriptions.`
