import type { AgentStreamEvent, ExecMode, IssueId, RuntimeId, RuntimeInfo, SessionId, WorkerHandle, WorkerId } from '../domain/types.js';
export interface AgentRuntimePort {
    listRuntimes(): Promise<RuntimeInfo[]>;
    spawnWorker(input: SpawnWorkerInput): Promise<WorkerHandle>;
    cancelWorker(workerId: WorkerId): Promise<boolean>;
    subscribeWorker(workerId: WorkerId, cb: (event: AgentStreamEvent) => void): {
        unsubscribe(): void;
    };
    getWorker(workerId: WorkerId): WorkerHandle | undefined;
    getWorkersForIssue(issueId: IssueId): WorkerHandle[];
    startManager(input: StartManagerInput): Promise<{
        sessionId: SessionId;
        events: AgentStreamEvent[];
    }>;
    sendManagerTurn(input: SendManagerTurnInput): Promise<AgentStreamEvent[]>;
    endManager(sessionId: SessionId): Promise<void>;
    getManagerSession(sessionId: SessionId): import('../domain/types.js').ManagerSession | undefined;
}
export interface SpawnWorkerInput {
    issueId: IssueId;
    runtimeId: RuntimeId;
    prompt: string;
    systemPrompt: string;
    mode?: ExecMode;
    cwd: string;
}
export interface StartManagerInput {
    runtimeId: RuntimeId;
    systemPrompt: string;
    bootstrapMessage: string;
    mcpConfigPath?: string;
    cwd: string;
    onEvent?: (event: AgentStreamEvent) => void;
}
export interface SendManagerTurnInput {
    sessionId: SessionId;
    message: string;
    onEvent?: (event: AgentStreamEvent) => void;
}
//# sourceMappingURL=AgentRuntimePort.d.ts.map