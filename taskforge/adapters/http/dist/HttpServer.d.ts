import type { TaskService } from '@taskforge/core';
import type { ActorService } from '@taskforge/core';
import type { EventService } from '@taskforge/core';
import type { GateService } from '@taskforge/core';
import type { TemplateService } from '@taskforge/core';
export interface HttpServerServices {
    tasks: TaskService;
    actors: ActorService;
    events: EventService;
    gates: GateService;
    templates: TemplateService;
}
export declare class HttpServer {
    private readonly services;
    private readonly app;
    private readonly server;
    private readonly wss;
    private readonly clients;
    constructor(services: HttpServerServices);
    private corsMiddleware;
    private setupRoutes;
    private setupWebSocket;
    private listTasks;
    private createTask;
    private getTask;
    private updateTask;
    private deleteTask;
    private claimTask;
    private closeTask;
    private reopenTask;
    private addComment;
    private listActors;
    private createActor;
    private listEvents;
    private listGates;
    private createGate;
    private resolveGate;
    private listTemplates;
    private getTemplate;
    private createTemplate;
    private pourTemplate;
    private deleteTemplate;
    private errorHandler;
    listen(port: number, callback?: () => void): void;
}
//# sourceMappingURL=HttpServer.d.ts.map