import type { Task, TaskStatus, TaskType } from '../domain/Task';
import type { Actor } from '../domain/Actor';
import type { Event } from '../domain/Event';
import type { Gate } from '../domain/Gate';
import type { Template } from '../domain/Template';
export interface TaskFilter {
    status?: TaskStatus;
    assignee?: string;
    labels?: string[];
    type?: TaskType;
    parentId?: string;
    priority?: Task['priority'];
}
export interface StoragePort {
    listTasks(filter?: TaskFilter): Promise<Task[]>;
    getTask(id: string): Promise<Task | undefined>;
    createTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
    updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task>;
    deleteTask(id: string): Promise<void>;
    listActors(): Promise<Actor[]>;
    getActor(id: string): Promise<Actor | undefined>;
    createActor(input: Omit<Actor, 'id'>): Promise<Actor>;
    listEvents(taskId?: string): Promise<Event[]>;
    createEvent(input: Omit<Event, 'id' | 'timestamp'>): Promise<Event>;
    listGates(taskId?: string): Promise<Gate[]>;
    getGate(id: string): Promise<Gate | undefined>;
    createGate(input: Omit<Gate, 'id' | 'status' | 'createdAt' | 'resolvedAt' | 'resolvedBy'>): Promise<Gate>;
    resolveGate(id: string, resolvedBy: string): Promise<Gate>;
    listTemplates(): Promise<Template[]>;
    getTemplate(name: string): Promise<Template | undefined>;
    createTemplate(input: Omit<Template, 'name'> & {
        name: string;
    }): Promise<Template>;
    deleteTemplate(name: string): Promise<void>;
}
//# sourceMappingURL=StoragePort.d.ts.map