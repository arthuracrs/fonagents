import type { TaskType } from './Task';

export interface TaskTemplate {
  title: string;
  description?: string;
  type: TaskType;
  priority: 0 | 1 | 2 | 3 | 4;
  labels: string[];
  dependencies: string[];
}

export interface Template {
  name: string;
  description?: string;
  tasks: TaskTemplate[];
  variables: string[];
}
