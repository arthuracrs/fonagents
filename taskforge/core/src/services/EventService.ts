import type { Event, EventType } from '../domain/Event';
import type { StoragePort } from '../ports/StoragePort';
import type { EventBusPort, TaskEvent } from '../ports/EventBusPort';

export class EventService {
  constructor(
    private readonly storage: StoragePort,
    private readonly events: EventBusPort,
  ) {}

  list(taskId?: string): Promise<Event[]> {
    return this.storage.listEvents(taskId);
  }

  async create(
    taskId: string,
    actorId: string,
    type: EventType,
    payload: Record<string, unknown>,
  ): Promise<Event> {
    const event = await this.storage.createEvent({ taskId, actorId, type, payload });
    this.events.emit({ type: 'comment_added', taskId, comment: event });
    return event;
  }

  subscribe(handler: (event: TaskEvent) => void): () => void {
    return this.events.subscribe(handler);
  }
}
