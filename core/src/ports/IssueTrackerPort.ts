import type {
  Comment,
  Dependency,
  FormulaSummary,
  Gate,
  GateId,
  GateType,
  Issue,
  IssueId,
  IssueType,
  Molecule,
  MoleculeId,
  ReadyWork,
} from '../domain/types.js'

// The issue tracker port. Implemented by adapters/beads (bd CLI).
// A future adapter could target Linear/Jira/GitHub Issues without touching core.
export interface IssueTrackerPort {
  // ── Issues ──────────────────────────────────────────────────────────────────
  listIssues(filter?: IssueFilter): Promise<Issue[]>
  getIssue(id: IssueId): Promise<Issue | undefined>
  createIssue(input: IssueCreateInput): Promise<Issue>
  updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue>
  closeIssue(id: IssueId, reason?: string): Promise<Issue>
  reopenIssue(id: IssueId): Promise<Issue>
  claimIssue(id: IssueId): Promise<Issue>

  // ── Comments ────────────────────────────────────────────────────────────────
  addComment(id: IssueId, body: string): Promise<Comment>
  listComments(id: IssueId): Promise<Comment[]>

  // ── Dependencies & hierarchy ─────────────────────────────────────────────────
  listDependencies(id: IssueId): Promise<Dependency[]>
  addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void>
  children(parentId: IssueId): Promise<Issue[]>

  // ── Ready work ───────────────────────────────────────────────────────────────
  readyWork(opts?: ReadyWorkOpts): Promise<ReadyWork[]>

  // ── Molecules & formulas ─────────────────────────────────────────────────────
  listFormulas(): Promise<FormulaSummary[]>
  showFormula(name: string): Promise<unknown>
  pourMolecule(
    formulaName: string,
    vars: Record<string, string>,
    opts?: { assignee?: string },
  ): Promise<Molecule>
  listMolecules(): Promise<Molecule[]>
  showMolecule(id: MoleculeId): Promise<unknown>

  // ── Gates ────────────────────────────────────────────────────────────────────
  listGates(opts?: { open?: boolean }): Promise<Gate[]>
  createGate(input: { issueId: IssueId; type: GateType; reason?: string; awaitId?: string }): Promise<Gate>
  resolveGate(gateId: GateId): Promise<Gate>

  // ── Audit ────────────────────────────────────────────────────────────────────
  recordAudit(input: { actor: string; event: string; payload?: unknown }): Promise<void>
}

export interface IssueFilter {
  status?: string
  type?: string
  priority?: number
  assignee?: string
  labels?: string[]
  parent?: IssueId
  moleculeId?: MoleculeId
}

export interface IssueCreateInput {
  title: string
  description?: string
  type?: IssueType
  priority?: number
  assignee?: string
  labels?: string[]
  parent?: IssueId
  moleculeId?: MoleculeId
  skills?: string[]
  deps?: string[]
  waitsFor?: IssueId
  waitsForGate?: 'all-children' | 'any-children'
}

export interface IssueUpdatePatch {
  status?: string
  priority?: number
  assignee?: string
  title?: string
}

export interface ReadyWorkOpts {
  molId?: MoleculeId
  gated?: boolean
  assignee?: string
  claim?: boolean
}
