import type { Task } from '../domain/Task';
import type { Event } from '../domain/Event';
import type { Gate } from '../domain/Gate';
export type TaskEvent = {
    type: 'task_created';
    task: Task;
} | {
    type: 'task_updated';
    task: Task;
    changes: Partial<Task>;
} | {
    type: 'task_closed';
    task: Task;
    reason?: string;
} | {
    type: 'task_reopened';
    task: Task;
} | {
    type: 'task_claimed';
    task: Task;
    actorId: string;
} | {
    type: 'comment_added';
    taskId: string;
    comment: Event;
} | {
    type: 'gate_opened';
    gate: Gate;
} | {
    type: 'gate_resolved';
    gateId: string;
};
export interface EventBusPort {
    emit(event: TaskEvent): void;
    subscribe(handler: (event: TaskEvent) => void): () => void;
}
//# sourceMappingURL=EventBusPort.d.ts.map