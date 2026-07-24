import { HttpServer } from '@taskforge/http';
import { TaskService, ActorService, EventService, GateService, TemplateService } from '@taskforge/core';
export type { Task, TaskStatus, TaskType, Actor, ActorType, Event, EventType, Gate, GateType, GateStatus, Template, TaskTemplate, } from '@taskforge/core';
export type { StoragePort, TaskFilter, EventBusPort, TaskEvent } from '@taskforge/core';
export declare class TaskForge {
    readonly tasks: TaskService;
    readonly actors: ActorService;
    readonly events: EventService;
    readonly gates: GateService;
    readonly templates: TemplateService;
    readonly server: HttpServer;
    private readonly storage;
    constructor(config?: {
        dbPath?: string;
    });
    start(port: number): Promise<void>;
    stop(): Promise<void>;
}
