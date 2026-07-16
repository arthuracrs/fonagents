import type { ChatMessage, Comment, Dependency, Gate, GateId, Issue, IssueId, Molecule, MoleculeId, ReadyWork, RuntimeInfo, SessionId, WorkerHandle, WorkerId } from '../domain/types.js';
import type { IssueCreateInput, IssueFilter, IssueUpdatePatch } from './IssueTrackerPort.js';
export interface UiCommandPort {
    sendUserMessage(content: string): Promise<{
        userMessageId: string;
        managerMessageId: string;
    }>;
    resolveGate(gateId: GateId, note?: string): Promise<void>;
    cancelWorker(workerId: WorkerId): Promise<void>;
    listIssues(filter?: IssueFilter): Promise<Issue[]>;
    getIssue(id: IssueId): Promise<Issue | undefined>;
    listMolecules(): Promise<Molecule[]>;
    showMolecule(id: MoleculeId): Promise<unknown>;
    listReadyWork(): Promise<ReadyWork[]>;
    listGates(): Promise<Gate[]>;
    getWorkerStatus(workerId: WorkerId): Promise<WorkerHandle | undefined>;
    listMessages(): Promise<ChatMessage[]>;
    listRuntimes(): Promise<RuntimeInfo[]>;
    listComments(issueId: IssueId): Promise<Comment[]>;
    listDependencies(issueId: IssueId): Promise<Dependency[]>;
    children(parentId: IssueId): Promise<Issue[]>;
    listFormulas(): Promise<import('../domain/types.js').FormulaSummary[]>;
    createIssue(input: IssueCreateInput): Promise<Issue>;
    updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue>;
    closeIssue(id: IssueId, reason?: string): Promise<Issue>;
    reopenIssue(id: IssueId): Promise<Issue>;
    claimIssue(id: IssueId): Promise<Issue>;
    addComment(issueId: IssueId, body: string): Promise<Comment>;
    addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void>;
    startManager(): Promise<{
        sessionId: SessionId;
    }>;
    endManager(): Promise<void>;
}
//# sourceMappingURL=UiCommandPort.d.ts.map