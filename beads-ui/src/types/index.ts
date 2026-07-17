export type Status = "open" | "in_progress" | "blocked" | "deferred" | "closed";
export type IssueType = "bug" | "feature" | "task" | "epic" | "chore";
export type DependencyType = "blocks" | "related" | "parent-child" | "relates-to" | "duplicates" | "supersedes" | "replies-to";

export interface Issue {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: number;
  type: IssueType;
  assignee?: string;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  closed_at?: string;
  close_reason?: string;
  due_at?: string;
  defer_until?: string;
  dependencies?: Dependency[];
  comments?: Comment[];
}

export interface Dependency {
  id: string;
  dep_type: DependencyType;
  title?: string;
  status?: Status;
}

export interface Comment {
  id: string;
  issueId: string;
  body: string;
  author?: string;
  createdAt: string;
}

export interface StatsSummary {
  total_issues?: number;
  open_issues?: number;
  in_progress_issues?: number;
  blocked_issues?: number;
  closed_issues?: number;
  ready_issues?: number;
  deferred_issues?: number;
}

export interface Stats {
  summary?: StatsSummary;
  [key: string]: unknown;
}

export interface AgentRuntime {
  id: string;
  name: string;
  description: string;
  defaultMode: "headless" | "tmux";
}

export type ExecStatus = "running" | "completed" | "failed" | "cancelled";

export interface AgentExecution {
  id: string;
  issueId: string;
  mode: "headless" | "tmux";
  status: ExecStatus;
  output: string;
  exitCode?: number;
  startedAt: string;
  finishedAt?: string;
  triggeredBy: string;
  tmuxSession?: string;
  prompt?: string;
  runtimeId?: string;
}

export interface Formula {
  name: string;
  description?: string;
  type?: string;
  source?: string;
  variables?: Record<string, unknown>;
  steps?: unknown[];
}

export interface AgentTrigger {
  id: string;
  issueId: string;
  name: string;
  condition: "execution_completed" | "execution_failed";
  command: string;
  enabled: boolean;
  createdAt: string;
}

// ── Gates ─────────────────────────────────────────────────────────────────────

export type GateType = "human" | "timer" | "gh:run" | "gh:pr" | "bead";
export type GateStatus = "open" | "closed";

export interface Gate {
  id: string;
  issueId: string;
  type: GateType;
  status: GateStatus;
  awaitId?: string;
  reason?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ── SSE events from the daemon ────────────────────────────────────────────────

export type UiEvent =
  | { type: "worker_started"; worker: { id: string; issueId: string; runtimeId: string; status: string } }
  | { type: "worker_output"; workerId: string; delta: string }
  | { type: "worker_status"; workerId: string; status: string; exitCode?: number }
  | { type: "gate_opened"; gate: Gate }
  | { type: "gate_resolved"; gateId: string }
  | { type: "molecule_poured"; moleculeId: string; formulaName: string }
  | { type: "issue_changed"; issueId: string; change: string }
  | { type: "error"; message: string };
