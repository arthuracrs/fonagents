import type { Task } from '../domain/Task.js';
import type { StoragePort, TaskFilter } from '../ports/StoragePort.js';
import type { EventBusPort } from '../ports/EventBusPort.js';
export declare class TaskService {
    private readonly storage;
    private readonly events;
    constructor(storage: StoragePort, events: EventBusPort);
    list(filter?: TaskFilter): Promise<Task[]>;
    get(id: string): Promise<Task>;
    create(input: {
        title: string;
        description?: string;
        priority?: Task['priority'];
        type?: Task['type'];
        assignee?: string;
        labels?: string[];
        parentId?: string;
        dueAt?: string;
        metadata?: Record<string, unknown>;
    }): Promise<Task>;
    update(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt' | 'dependencies'>>): Promise<Task>;
    claim(id: string, actorId: string): Promise<Task>;
    close(id: string, reason?: string): Promise<Task>;
    reopen(id: string): Promise<Task>;
    addDependency(taskId: string, dependsOn: string): Promise<Task>;
    removeDependency(taskId: string, dependsOn: string): Promise<Task>;
    getDependencies(id: string): Promise<Task[]>;
    getBlocked(): Promise<Task[]>;
    private assertTransition;
    private unblockDependents;
}
//# sourceMappingURL=TaskService.d.ts.map