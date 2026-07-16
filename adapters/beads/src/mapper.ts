import type {
  Comment,
  Dependency,
  FormulaSummary,
  Gate,
  GateStatus,
  GateType,
  Issue,
  IssueId,
  IssueStatus,
  IssueType,
  Molecule,
  MoleculeId,
  ReadyWork,
} from '@fonagents/core'

// ── bd JSON shapes (snake_case, as returned by the CLI) ───────────────────────

export interface BdIssue {
  id: string
  title: string
  description: string
  status: string
  priority: number
  issue_type: string
  owner?: string
  created_at: string
  created_by?: string
  updated_at: string
  started_at?: string
  closed_at?: string
  close_reason?: string
  dependency_count?: number
  dependent_count?: number
  comment_count?: number
  parent?: string
  labels?: string[]
  skills?: string[]
}

export interface BdComment {
  id: string
  issue_id: string
  author: string
  text: string
  created_at: string
}

export interface BdDependency {
  from_id?: string
  to_id?: string
  type?: string
  child?: string
  parent?: string
  dep_type?: string
}

export interface BdFormula {
  name: string
  description?: string
  phase?: string
}

export interface BdGate {
  id: string
  issue_id?: string
  type?: string
  status?: string
  await_id?: string
  reason?: string
  created_at?: string
  resolved_at?: string
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapIssue(raw: BdIssue): Issue {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    status: normalizeStatus(raw.status),
    type: normalizeType(raw.issue_type) as IssueType,
    priority: raw.priority,
    assignee: raw.owner,
    labels: raw.labels ?? [],
    parentId: raw.parent,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

export function mapComment(raw: BdComment, issueId: IssueId): Comment {
  return {
    id: raw.id,
    issueId: raw.issue_id ?? issueId,
    body: raw.text,
    author: raw.author,
    createdAt: raw.created_at,
  }
}

export function mapDependency(raw: BdDependency): Dependency {
  return {
    fromId: raw.from_id ?? raw.child ?? '',
    toId: raw.to_id ?? raw.parent ?? '',
    type: raw.type ?? raw.dep_type ?? 'blocks',
  }
}

export function mapFormula(raw: BdFormula): FormulaSummary {
  return {
    name: raw.name,
    description: raw.description,
    phase: raw.phase as FormulaSummary['phase'],
  }
}

export function mapGate(raw: BdGate): Gate {
  return {
    id: raw.id,
    issueId: raw.issue_id ?? '',
    type: (raw.type ?? 'human') as GateType,
    status: (raw.status ?? 'open') as GateStatus,
    awaitId: raw.await_id,
    reason: raw.reason,
    createdAt: raw.created_at ?? '',
    resolvedAt: raw.resolved_at,
  }
}

export function mapReadyWork(raw: BdIssue): ReadyWork {
  return {
    issueId: raw.id,
    title: raw.title,
    claimable: true,
    blockers: [],
  }
}

export function mapMolecule(raw: BdIssue & { formula_name?: string; mol_type?: string }): Molecule {
  return {
    id: raw.id as MoleculeId,
    formulaName: raw.formula_name ?? '',
    rootIssueId: raw.id,
    molType: (raw.mol_type ?? 'work') as Molecule['molType'],
    status: 'active',
    variables: {},
  }
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeStatus(s: string): IssueStatus {
  const map: Record<string, IssueStatus> = {
    open: 'open',
    in_progress: 'in_progress',
    'in-progress': 'in_progress',
    blocked: 'blocked',
    closed: 'closed',
    deferred: 'deferred',
  }
  return map[s] ?? 'open'
}

function normalizeType(t: string): string {
  const map: Record<string, string> = {
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
  }
  return map[t] ?? t
}
