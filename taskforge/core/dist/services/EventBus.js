"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const node_events_1 = require("node:events");
class EventBus {
    emitter = new node_events_1.EventEmitter();
    emit(event) {
        this.emitter.emit('task', event);
    }
    subscribe(handler) {
        this.emitter.on('task', handler);
        return () => {
            this.emitter.off('task', handler);
        };
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=EventBus.js.map