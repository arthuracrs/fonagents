"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseEventBus = void 0;
// Implements UiEventPort by broadcasting events to all connected SSE clients.
// Each client is an Express Response with SSE headers already set.
// The terminal adapter (future) would write to stdout; the discord adapter
// would post messages — same UiEventPort interface, different transport.
class SseEventBus {
    clients = new Set();
    addClient(res) {
        this.clients.add(res);
    }
    removeClient(res) {
        this.clients.delete(res);
    }
    emit(event) {
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