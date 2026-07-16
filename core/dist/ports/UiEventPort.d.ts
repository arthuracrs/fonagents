import type { ChatMessage, Gate, GateId, IssueId, MoleculeId, WorkerHandle, WorkerId, WorkerStatus } from '../domain/types.js';
export interface UiEventPort {
    emit(event: UiEvent): void;
}
export type UiEvent = {
    type: 'user_message';
    message: ChatMessage;
} | {
    type: 'manager_message';
    message: ChatMessage;
} | {
    type: 'manager_stream';
    delta: string;
} | {
    type: 'manager_thinking';
    active: boolean;
} | {
    type: 'worker_started';
    worker: WorkerHandle;
} | {
    type: 'worker_output';
    workerId: WorkerId;
    delta: string;
} | {
    type: 'worker_status';
    workerId: WorkerId;
    status: WorkerStatus;
    exitCode?: number;
} | {
    type: 'gate_opened';
    gate: Gate;
} | {
    type: 'gate_resolved';
    gateId: GateId;
} | {
    type: 'molecule_poured';
    moleculeId: MoleculeId;
    formulaName: string;
} | {
    type: 'issue_changed';
    issueId: IssueId;
    change: string;
} | {
    type: 'manager_started';
    sessionId: string;
} | {
    type: 'manager_ended';
    sessionId: string;
} | {
    type: 'error';
    message: string;
};
//# sourceMappingURL=UiEventPort.d.ts.map