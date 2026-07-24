import type { Event, EventType } from '../domain/Event';
import type { StoragePort } from '../ports/StoragePort';
import type { EventBusPort, TaskEvent } from '../ports/EventBusPort';
export declare class EventService {
    private readonly storage;
    private readonly events;
    constructor(storage: StoragePort, events: EventBusPort);
    list(taskId?: string): Promise<Event[]>;
    create(taskId: string, actorId: string, type: EventType, payload: Record<string, unknown>): Promise<Event>;
    subscribe(handler: (event: TaskEvent) => void): () => void;
}
//# sourceMappingURL=EventService.d.ts.map