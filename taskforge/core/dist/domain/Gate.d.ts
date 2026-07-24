export type GateType = 'human' | 'external';
export type GateStatus = 'open' | 'resolved';
export interface Gate {
    id: string;
    taskId: string;
    type: GateType;
    status: GateStatus;
    reason?: string;
    awaitId?: string;
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
}
//# sourceMappingURL=Gate.d.ts.map