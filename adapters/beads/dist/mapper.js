"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapIssue = mapIssue;
exports.mapComment = mapComment;
exports.mapDependency = mapDependency;
exports.mapFormula = mapFormula;
exports.mapGate = mapGate;
exports.mapReadyWork = mapReadyWork;
exports.mapMolecule = mapMolecule;
// ── Mappers ───────────────────────────────────────────────────────────────────
function mapIssue(raw) {
    return {
        id: raw.id,
        title: raw.title,
        description: raw.description ?? '',
        status: normalizeStatus(raw.status),
        type: normalizeType(raw.issue_type),
        priority: raw.priority,
        assignee: raw.owner,
        labels: raw.labels ?? [],
        parentId: raw.parent,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
    };
}
function mapComment(raw, issueId) {
    return {
        id: raw.id,
        issueId: raw.issue_id ?? issueId,
        body: raw.text,
        author: raw.author,
        createdAt: raw.created_at,
    };
}
function mapDependency(raw) {
    return {
        fromId: raw.from_id ?? raw.child ?? '',
        toId: raw.to_id ?? raw.parent ?? '',
        type: raw.type ?? raw.dep_type ?? 'blocks',
    };
}
function mapFormula(raw) {
    return {
        name: raw.name,
        description: raw.description,
        phase: raw.phase,
    };
}
function mapGate(raw) {
    return {
        id: raw.id,
        issueId: raw.issue_id ?? '',
        type: (raw.type ?? 'human'),
        status: (raw.status ?? 'open'),
        awaitId: raw.await_id,
        reason: raw.reason,
        createdAt: raw.created_at ?? '',
        resolvedAt: raw.resolved_at,
    };
}
function mapReadyWork(raw) {
    return {
        issueId: raw.id,
        title: raw.title,
        claimable: true,
        blockers: [],
    };
}
function mapMolecule(raw) {
    return {
        id: raw.id,
        formulaName: raw.formula_name ?? '',
        rootIssueId: raw.id,
        molType: (raw.mol_type ?? 'work'),
        status: 'active',
        variables: {},
    };
}
// ── Normalizers ───────────────────────────────────────────────────────────────
function normalizeStatus(s) {
    const map = {
        open: 'open',
        in_progress: 'in_progress',
        'in-progress': 'in_progress',
        blocked: 'blocked',
        closed: 'closed',
        deferred: 'deferred',
    };
    return map[s] ?? 'open';
}
function normalizeType(t) {
    const map = {
        task: 'task',
        bug: 'bug',
        feature: 'feature',
        feat: 'feature',
        enhancement: 'feature',
        epic: 'epic',
        chore: 'chore',
        decision: 'decision',
        dec: 'decision',
        adr: 'decision',
    };
    return map[t] ?? t;
}
//# sourceMappingURL=mapper.js.map