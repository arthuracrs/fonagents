import type { Comment, Dependency, FormulaSummary, Gate, GateId, GateType, Issue, IssueId, IssueTrackerPort, IssueCreateInput, IssueFilter, IssueUpdatePatch, Molecule, MoleculeId, ReadyWork } from '@fonagents/core';
export interface BeadsAdapterConfig {
    bdPath?: string;
    projectDir: string;
    actor?: string;
}
export declare class BeadsAdapter implements IssueTrackerPort {
    private readonly bin;
    private readonly projectDir;
    private readonly actor?;
    constructor(config: BeadsAdapterConfig);
    listIssues(filter?: IssueFilter): Promise<Issue[]>;
    getIssue(id: IssueId): Promise<Issue | undefined>;
    createIssue(input: IssueCreateInput): Promise<Issue>;
    updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue>;
    closeIssue(id: IssueId, reason?: string): Promise<Issue>;
    reopenIssue(id: IssueId): Promise<Issue>;
    claimIssue(id: IssueId): Promise<Issue>;
    addComment(id: IssueId, body: string): Promise<Comment>;
    listComments(id: IssueId): Promise<Comment[]>;
    listDependencies(id: IssueId): Promise<Dependency[]>;
    addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void>;
    children(parentId: IssueId): Promise<Issue[]>;
    readyWork(opts?: {
        molId?: MoleculeId;
        gated?: boolean;
        assignee?: string;
        claim?: boolean;
    }): Promise<ReadyWork[]>;
    listFormulas(): Promise<FormulaSummary[]>;
    showFormula(name: string): Promise<unknown>;
    pourMolecule(formulaName: string, vars: Record<string, string>, opts?: {
        assignee?: string;
    }): Promise<Molecule>;
    listMolecules(): Promise<Molecule[]>;
    showMolecule(id: MoleculeId): Promise<unknown>;
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
    private run;
    private parseArray;
    private applyFilter;
    private detectBd;
}
//# sourceMappingURL=BeadsAdapter.d.ts.map