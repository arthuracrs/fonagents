import type { AgentRuntimePort, AgentStreamEvent, IssueId, RuntimeInfo, SpawnWorkerInput, WorkerHandle, WorkerId } from '@fonagents/core';
export interface AnagentAdapterConfig {
    anagentPath?: string;
    cwd: string;
}
export declare class AnagentAdapter implements AgentRuntimePort {
    private readonly workers;
    private readonly listeners;
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
    listWorkers(): WorkerHandle[];
    private pipeEvents;
    private notify;
}
//# sourceMappingURL=AnagentAdapter.d.ts.map