import type { IssueTrackerPort, Issue, IssueId, IssueFilter, IssueCreateInput, IssueUpdatePatch, Comment, Dependency, Gate, GateId, GateType, ReadyWork } from '@fonagents/core';
export interface TaskForgeAdapterConfig {
    dbPath?: string;
}
export declare class TaskForgeAdapter implements IssueTrackerPort {
    private forge;
    constructor(config?: TaskForgeAdapterConfig);
    listIssues(filter?: IssueFilter): Promise<Issue[]>;
    getIssue(id: IssueId): Promise<Issue | undefined>;
    createIssue(input: IssueCreateInput): Promise<Issue>;
    updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue>;
    closeIssue(id: IssueId, reason?: string): Promise<Issue>;
    reopenIssue(id: IssueId): Promise<Issue>;
    claimIssue(id: IssueId, actor?: string): Promise<Issue>;
    addComment(id: IssueId, body: string, actor?: string): Promise<Comment>;
    listComments(id: IssueId): Promise<Comment[]>;
    listDependencies(id: IssueId): Promise<Dependency[]>;
    addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void>;
    children(parentId: IssueId): Promise<Issue[]>;
    readyWork(opts?: {
        gated?: boolean;
        assignee?: string;
        claim?: boolean;
    }): Promise<ReadyWork[]>;
    resetStaleTasks(): Promise<Issue[]>;
    listGates(opts?: {
        open?: boolean;
    }): Promise<Gate[]>;
    createGate(input: {
        issueId: IssueId;
        type: GateType;
        reason?: string;
        awaitId?: string;
    }): Promise<Gate>;
    resolveGate(gateId: GateId): Promise<Gate>;
    recordAudit(input: {
        actor: string;
        event: string;
        payload?: unknown;
    }): Promise<void>;
    startServer(port: number): Promise<void>;
    stopServer(): Promise<void>;
}
