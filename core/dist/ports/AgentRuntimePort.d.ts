import type { AgentStreamEvent, ExecMode, IssueId, RuntimeId, RuntimeInfo, WorkerHandle, WorkerId } from '../domain/types.js';
export interface AgentRuntimePort {
    listRuntimes(): Promise<RuntimeInfo[]>;
    spawnWorker(input: SpawnWorkerInput): Promise<WorkerHandle>;
    cancelWorker(workerId: WorkerId): Promise<boolean>;
    subscribeWorker(workerId: WorkerId, cb: (event: AgentStreamEvent) => void): {
        unsubscribe(): void;
    };
    getWorker(workerId: WorkerId): WorkerHandle | undefined;
    getWorkersForIssue(issueId: IssueId): WorkerHandle[];
}
export interface SpawnWorkerInput {
    issueId: IssueId;
    runtimeId: RuntimeId;
    prompt: string;
    systemPrompt: string;
    mode?: ExecMode;
    cwd: string;
}
//# sourceMappingURL=AgentRuntimePort.d.ts.map