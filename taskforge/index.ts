import { SQLiteStorage } from '@taskforge/sqlite';
import { HttpServer } from '@taskforge/http';
import {
  TaskService,
  ActorService,
  EventService,
  GateService,
  TemplateService,
  EventBus,
} from '@taskforge/core';
export type {
  Task,
  TaskStatus,
  TaskType,
  Actor,
  ActorType,
  Event,
  EventType,
  Gate,
  GateType,
  GateStatus,
  Template,
  TaskTemplate,
} from '@taskforge/core';
export type { StoragePort, TaskFilter, EventBusPort, TaskEvent } from '@taskforge/core';

export class TaskForge {
  readonly tasks: TaskService;
  readonly actors: ActorService;
  readonly events: EventService;
  readonly gates: GateService;
  readonly templates: TemplateService;
  readonly server: HttpServer;

  private readonly storage: SQLiteStorage;

  constructor(config: { dbPath?: string } = {}) {
    this.storage = new SQLiteStorage(config.dbPath);
    const eventBus = new EventBus();

    this.tasks = new TaskService(this.storage, eventBus);
    this.actors = new ActorService(this.storage);
    this.events = new EventService(this.storage, eventBus);
    this.gates = new GateService(this.storage, eventBus);
    this.templates = new TemplateService(this.storage, this.tasks);

    this.server = new HttpServer({
      tasks: this.tasks,
      actors: this.actors,
      events: this.events,
      gates: this.gates,
      templates: this.templates,
    });
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, resolve);
    });
  }

  async stop(): Promise<void> {
    this.storage.close();
  }
}
