import type { Comment, Dependency, FormulaSummary, Gate, Issue, IssueId, Molecule, ReadyWork } from '@fonagents/core';
export interface BdIssue {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: number;
    issue_type: string;
    owner?: string;
    created_at: string;
    created_by?: string;
    updated_at: string;
    started_at?: string;
    closed_at?: string;
    close_reason?: string;
    dependency_count?: number;
    dependent_count?: number;
    comment_count?: number;
    parent?: string;
    labels?: string[];
    skills?: string[];
}
export interface BdComment {
    id: string;
    issue_id: string;
    author: string;
    text: string;
    created_at: string;
}
export interface BdDependency {
    from_id?: string;
    to_id?: string;
    type?: string;
    child?: string;
    parent?: string;
    dep_type?: string;
}
export interface BdFormula {
    name: string;
    description?: string;
    phase?: string;
}
export interface BdGate {
    id: string;
    issue_id?: string;
    type?: string;
    status?: string;
    await_id?: string;
    reason?: string;
    created_at?: string;
    resolved_at?: string;
}
export declare function mapIssue(raw: BdIssue): Issue;
export declare function mapComment(raw: BdComment, issueId: IssueId): Comment;
export declare function mapDependency(raw: BdDependency): Dependency;
export declare function mapFormula(raw: BdFormula): FormulaSummary;
export declare function mapGate(raw: BdGate): Gate;
export declare function mapReadyWork(raw: BdIssue): ReadyWork;
export declare function mapMolecule(raw: BdIssue & {
    formula_name?: string;
    mol_type?: string;
}): Molecule;
//# sourceMappingURL=mapper.d.ts.map