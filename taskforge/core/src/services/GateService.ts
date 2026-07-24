import type { Gate, GateType } from '../domain/Gate';
import type { StoragePort } from '../ports/StoragePort';
import type { EventBusPort } from '../ports/EventBusPort';

export class GateService {
  constructor(
    private readonly storage: StoragePort,
    private readonly events: EventBusPort,
  ) {}

  list(taskId?: string): Promise<Gate[]> {
    return this.storage.listGates(taskId);
  }

  get(id: string): Promise<Gate | undefined> {
    return this.storage.getGate(id);
  }

  async create(
    taskId: string,
    type: GateType,
    reason?: string,
    awaitId?: string,
  ): Promise<Gate> {
    const gate = await this.storage.createGate({ taskId, type, reason, awaitId });
    await this.storage.updateTask(taskId, { status: 'blocked' });
    this.events.emit({ type: 'gate_opened', gate });
    return gate;
  }

  async resolve(id: string, resolvedBy: string): Promise<Gate> {
    const gate = await this.storage.resolveGate(id, resolvedBy);
    this.events.emit({ type: 'gate_resolved', gateId: id });

    const remaining = await this.storage.listGates(gate.taskId);
    const hasOpenGates = remaining.some(
      (g) => g.id !== id && g.status === 'open',
    );
    if (!hasOpenGates) {
      const task = await this.storage.getTask(gate.taskId);
      if (task && task.status === 'blocked') {
        await this.storage.updateTask(gate.taskId, { status: 'open' });
      }
    }

    return gate;
  }
}
