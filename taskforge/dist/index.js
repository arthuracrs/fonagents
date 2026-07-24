"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskForge = void 0;
const sqlite_1 = require("@taskforge/sqlite");
const http_1 = require("@taskforge/http");
const core_1 = require("@taskforge/core");
class TaskForge {
    tasks;
    actors;
    events;
    gates;
    templates;
    server;
    storage;
    constructor(config = {}) {
        this.storage = new sqlite_1.SQLiteStorage(config.dbPath);
        const eventBus = new core_1.EventBus();
        this.tasks = new core_1.TaskService(this.storage, eventBus);
        this.actors = new core_1.ActorService(this.storage);
        this.events = new core_1.EventService(this.storage, eventBus);
        this.gates = new core_1.GateService(this.storage, eventBus);
        this.templates = new core_1.TemplateService(this.storage, this.tasks);
        this.server = new http_1.HttpServer({
            tasks: this.tasks,
            actors: this.actors,
            events: this.events,
            gates: this.gates,
            templates: this.templates,
        });
    }
    async start(port) {
        return new Promise((resolve) => {
            this.server.listen(port, resolve);
        });
    }
    async stop() {
        this.storage.close();
    }
}
exports.TaskForge = TaskForge;
//# sourceMappingURL=index.js.map