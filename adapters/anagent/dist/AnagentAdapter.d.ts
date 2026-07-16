import type { AgentRuntimePort, AgentStreamEvent, IssueId, ManagerSession, RuntimeInfo, SessionId, SpawnWorkerInput, StartManagerInput, SendManagerTurnInput, WorkerHandle, WorkerId } from '@fonagents/core';
export interface AnagentAdapterConfig {
    anagentPath?: string;
    cwd: string;
}
export declare class AnagentAdapter implements AgentRuntimePort {
    private readonly workers;
    private readonly listeners;
    private readonly managerSessions;
    private readonly bin;
    private readonly binArgs;
    private readonly cwd;
    constructor(config: AnagentAdapterConfig);
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
    getManagerSession(sessionId: SessionId): ManagerSession | undefined;
    private pipeEvents;
    private notify;
    private runStreamingSession;
}
//# sourceMappingURL=AnagentAdapter.d.ts.map