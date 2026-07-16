export type IssueId = string;
export type MoleculeId = string;
export type SessionId = string;
export type WorkerId = string;
export type GateId = string;
export type RuntimeId = string;
export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed' | 'deferred';
export type IssueType = 'bug' | 'feature' | 'task' | 'epic' | 'chore' | 'decision';
export interface Issue {
    id: IssueId;
    title: string;
    description: string;
    status: IssueStatus;
    type: IssueType;
    priority: number;
    assignee?: string;
    labels: string[];
    parentId?: IssueId;
    moleculeId?: MoleculeId;
    skills?: string[];
    createdAt: string;
    updatedAt: string;
}
export interface Dependency {
    fromId: IssueId;
    toId: IssueId;
    type: string;
}
export interface Comment {
    id: string;
    issueId: IssueId;
    body: string;
    author?: string;
    createdAt: string;
}
export type MoleculeType = 'swarm' | 'patrol' | 'work';
export type MoleculeStatus = 'active' | 'complete' | 'stale';
export interface Molecule {
    id: MoleculeId;
    formulaName: string;
    rootIssueId: IssueId;
    molType: MoleculeType;
    status: MoleculeStatus;
    variables: Record<string, string>;
}
export interface FormulaSummary {
    name: string;
    description?: string;
    phase?: 'solid' | 'liquid' | 'vapor';
}
export type GateType = 'human' | 'timer' | 'gh:run' | 'gh:pr' | 'bead';
export type GateStatus = 'open' | 'closed';
export interface Gate {
    id: GateId;
    issueId: IssueId;
    type: GateType;
    status: GateStatus;
    awaitId?: string;
    reason?: string;
    createdAt: string;
    resolvedAt?: string;
}
export interface ReadyWork {
    issueId: IssueId;
    title: string;
    claimable: boolean;
    blockers: IssueId[];
}
export type ExecMode = 'headless' | 'tmux';
export type WorkerStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface RuntimeInfo {
    id: RuntimeId;
    name: string;
    description: string;
    defaultMode: ExecMode;
}
export interface WorkerHandle {
    id: WorkerId;
    issueId: IssueId;
    runtimeId: RuntimeId;
    mode: ExecMode;
    status: WorkerStatus;
    startedAt: string;
    finishedAt?: string;
    exitCode?: number;
}
export interface ManagerSession {
    sessionId: SessionId;
    formulaName?: string;
    rootMoleculeId?: MoleculeId;
    startedAt: string;
    status: 'active' | 'idle' | 'ended';
}
export type AgentStreamEvent = {
    type: 'text';
    delta: string;
} | {
    type: 'tool_use';
    tool: string;
    input: unknown;
} | {
    type: 'tool_result';
    toolUseId: string;
    content: string;
    isError?: boolean;
} | {
    type: 'session';
    sessionId: SessionId;
} | {
    type: 'done';
    exitCode: number;
    durationMs: number;
} | {
    type: 'failed';
    error: string;
    exitCode: number;
    durationMs: number;
};
export type MessageRole = 'user' | 'manager' | 'system';
export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    createdAt: string;
    moleculeId?: MoleculeId;
    workerId?: WorkerId;
}
export interface AuditEntry {
    actor: string;
    event: string;
    payload?: unknown;
    createdAt: string;
}
//# sourceMappingURL=types.d.ts.map