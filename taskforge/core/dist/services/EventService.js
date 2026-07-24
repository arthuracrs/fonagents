"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventService = void 0;
class EventService {
    storage;
    events;
    constructor(storage, events) {
        this.storage = storage;
        this.events = events;
    }
    list(taskId) {
        return this.storage.listEvents(taskId);
    }
    async create(taskId, actorId, type, payload) {
        const event = await this.storage.createEvent({ taskId, actorId, type, payload });
        this.events.emit({ type: 'comment_added', taskId, comment: event });
        return event;
    }
    subscribe(handler) {
        return this.events.subscribe(handler);
    }
}
exports.EventService = EventService;
//# sourceMappingURL=EventService.js.map