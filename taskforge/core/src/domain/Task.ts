export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'deferred' | 'closed';
export type TaskType = 'bug' | 'feature' | 'task' | 'epic';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 0 | 1 | 2 | 3 | 4;
  type: TaskType;
  assignee?: string;
  labels: string[];
  parentId?: string;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closeReason?: string;
  dueAt?: string;
  metadata?: Record<string, unknown>;
}
