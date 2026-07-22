"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseEventBus = void 0;
const events_1 = require("events");
class SseEventBus {
    events = new events_1.EventEmitter();
    clients = new Set();
    addClient(res) {
        this.clients.add(res);
    }
    removeClient(res) {
        this.clients.delete(res);
    }
    emit(event) {
        // Emit to local listeners (like Overseer)
        this.events.emit('ui-event', event);
        // Broadcast to SSE clients
        const data = `data: ${JSON.stringify(event)}\n\n`;
        for (const client of this.clients) {
            try {
                client.write(data);
                const flushable = client;
                flushable.flush?.();
            }
            catch {
                this.clients.delete(client);
            }
        }
    }
    get clientCount() {
        return this.clients.size;
    }
}
exports.SseEventBus = SseEventBus;
//# sourceMappingURL=SseEventBus.js.map