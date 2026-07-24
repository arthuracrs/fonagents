import type { EventBusPort, TaskEvent } from '../ports/EventBusPort.js';
export declare class EventBus implements EventBusPort {
    private readonly emitter;
    emit(event: TaskEvent): void;
    subscribe(handler: (event: TaskEvent) => void): () => void;
}
//# sourceMappingURL=EventBus.d.ts.map