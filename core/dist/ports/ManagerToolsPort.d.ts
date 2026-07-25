import type { Issue, IssueId, MoleculeId, RuntimeId, WorkerId } from '../domain/types.js';
import type { IssueFilter } from './IssueTrackerPort.js';
export interface ManagerToolsPort {
    decompose(input: {
        formulaName: string;
        vars: Record<string, string>;
    }): Promise<{
        moleculeId: MoleculeId;
        childIssueIds: IssueId[];
    }>;
    dispatchWorker(input: {
        issueId: IssueId;
        runtimeId?: RuntimeId;
        prompt?: string;
    }): Promise<{
        workerId: WorkerId;
    }>;
    listIssues(input?: IssueFilter): Promise<Issue[]>;
    listReady(input: {
        moleculeId?: MoleculeId;
    }): Promise<{
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
        issueId?: IssueId;
    }): Promise<{
        gateId: string;
    }>;
    recordProgress(input: {
        issueId: IssueId;
        body: string;
    }): Promise<void>;
    completeIssue(input: {
        issueId: IssueId;
        reason?: string;
    }): Promise<void>;
    overseerStatus(): Promise<{
        enabled: boolean;
        mode: string;
        activeOverseers: number;
        queueLength: number;
    }>;
}
export interface ToolSchema {
    name: keyof ManagerToolsPort;
    description: string;
    inputSchema: Record<string, unknown>;
}
export declare const MANAGER_TOOL_SCHEMAS: ToolSchema[];
//# sourceMappingURL=ManagerToolsPort.d.ts.map