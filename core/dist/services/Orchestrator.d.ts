import type { Comment, Dependency, Gate, GateId, Issue, IssueId, RuntimeInfo, WorkerHandle, WorkerId } from '../domain/types.js';
import type { AgentRuntimePort } from '../ports/AgentRuntimePort.js';
import type { IssueCreateInput, IssueFilter, IssueTrackerPort, IssueUpdatePatch } from '../ports/IssueTrackerPort.js';
import type { ManagerToolsPort } from '../ports/ManagerToolsPort.js';
import type { UiCommandPort } from '../ports/UiCommandPort.js';
import type { UiEventPort } from '../ports/UiEventPort.js';
export interface OrchestratorConfig {
    projectDir: string;
    managerRuntimeId?: string;
    overseer?: {
        enabled: boolean;
        mode: string;
    };
    maxWorkers?: number;
}
export declare class Orchestrator implements UiCommandPort, ManagerToolsPort {
    private readonly tracker;
    private readonly runtime;
    private readonly events;
    private readonly config;
    private readonly workerSubscriptions;
    constructor(tracker: IssueTrackerPort, runtime: AgentRuntimePort, events: UiEventPort, config: OrchestratorConfig);
    resolveGate(gateId: GateId, note?: string): Promise<void>;
    cancelWorker(workerId: WorkerId): Promise<void>;
    listIssues(filter?: IssueFilter): Promise<Issue[]>;
    getIssue(id: IssueId): Promise<Issue | undefined>;
    listGates(): Promise<Gate[]>;
    getWorkerStatus(workerId: WorkerId): Promise<WorkerHandle | undefined>;
    listWorkers(): Promise<WorkerHandle[]>;
    listRuntimes(): Promise<RuntimeInfo[]>;
    listComments(issueId: IssueId): Promise<Comment[]>;
    listDependencies(issueId: IssueId): Promise<Dependency[]>;
    children(parentId: IssueId): Promise<Issue[]>;
    createIssue(input: IssueCreateInput): Promise<Issue>;
    updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue>;
    closeIssue(id: IssueId, reason?: string): Promise<Issue>;
    reopenIssue(id: IssueId): Promise<Issue>;
    claimIssue(id: IssueId): Promise<Issue>;
    addComment(issueId: IssueId, body: string): Promise<Comment>;
    addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void>;
    createTask(input: {
        title: string;
        description?: string;
        type?: string;
        priority?: number;
    }): Promise<{
        taskId: IssueId;
    }>;
    listTasks(filter?: IssueFilter): Promise<Issue[]>;
    dispatchWorker(input: {
        issueId: IssueId;
        runtimeId?: string;
        prompt?: string;
    }): Promise<{
        workerId: WorkerId;
    }>;
    listReady(): Promise<{
        issueId: IssueId;
        title: string;
        status: string;
    }[]>;
    workerStatus(input: {
        workerId?: WorkerId;
        issueId?: IssueId;
    }): Promise<{
        id: WorkerId;
        status: string;
        issueId: IssueId;
    }[]>;
    escalate(input: {
        reason: string;
        issueId: IssueId;
    }): Promise<{
        gateId: string;
    }>;
    recordProgress(input: {
        issueId: IssueId;
        body: string;
    }): Promise<void>;
    completeTask(input: {
        taskId: IssueId;
        reason?: string;
    }): Promise<void>;
    resetStaleTasks(): Promise<{
        resetIssueIds: IssueId[];
    }>;
    overseerStatus(): Promise<{
        enabled: boolean;
        mode: string;
        activeOverseers: number;
        queueLength: number;
    }>;
    setOverseerConfig(config: {
        enabled: boolean;
        mode: string;
    }): void;
    private releaseWorkerSlot;
    private forwardWorkerEvent;
    private emit;
}
//# sourceMappingURL=Orchestrator.d.ts.map