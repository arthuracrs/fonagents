import { EventEmitter } from 'node:events';
import type { EventBusPort, TaskEvent } from '../ports/EventBusPort.js';

export class EventBus implements EventBusPort {
  private readonly emitter = new EventEmitter();

  emit(event: TaskEvent): void {
    this.emitter.emit('task', event);
  }

  subscribe(handler: (event: TaskEvent) => void): () => void {
    this.emitter.on('task', handler);
    return () => {
      this.emitter.off('task', handler);
    };
  }
}
