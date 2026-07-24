"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateService = void 0;
class GateService {
    storage;
    events;
    constructor(storage, events) {
        this.storage = storage;
        this.events = events;
    }
    list(taskId) {
        return this.storage.listGates(taskId);
    }
    get(id) {
        return this.storage.getGate(id);
    }
    async create(taskId, type, reason, awaitId) {
        const gate = await this.storage.createGate({ taskId, type, reason, awaitId });
        await this.storage.updateTask(taskId, { status: 'blocked' });
        this.events.emit({ type: 'gate_opened', gate });
        return gate;
    }
    async resolve(id, resolvedBy) {
        const gate = await this.storage.resolveGate(id, resolvedBy);
        this.events.emit({ type: 'gate_resolved', gateId: id });
        const remaining = await this.storage.listGates(gate.taskId);
        const hasOpenGates = remaining.some((g) => g.id !== id && g.status === 'open');
        if (!hasOpenGates) {
            const task = await this.storage.getTask(gate.taskId);
            if (task && task.status === 'blocked') {
                await this.storage.updateTask(gate.taskId, { status: 'open' });
            }
        }
        return gate;
    }
}
exports.GateService = GateService;
//# sourceMappingURL=GateService.js.map