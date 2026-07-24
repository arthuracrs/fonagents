import type { Gate, GateType } from '../domain/Gate';
import type { StoragePort } from '../ports/StoragePort';
import type { EventBusPort } from '../ports/EventBusPort';
export declare class GateService {
    private readonly storage;
    private readonly events;
    constructor(storage: StoragePort, events: EventBusPort);
    list(taskId?: string): Promise<Gate[]>;
    get(id: string): Promise<Gate | undefined>;
    create(taskId: string, type: GateType, reason?: string, awaitId?: string): Promise<Gate>;
    resolve(id: string, resolvedBy: string): Promise<Gate>;
}
//# sourceMappingURL=GateService.d.ts.map