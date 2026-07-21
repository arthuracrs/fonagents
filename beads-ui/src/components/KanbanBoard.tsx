import type { IssueModel } from "../models/IssueModel";
import type { Status, Gate } from "../types";
import { TypeBadge, PriorityBadge } from "./Badge";

interface Props {
  issues: IssueModel[];
  gates: Gate[];
  onSelect: (id: string) => void;
}

const COLUMNS: { status: Status; label: string; icon: string; color: string }[] = [
  { status: "open",        label: "Open",        icon: "○", color: "text-[var(--text-muted)]" },
  { status: "in_progress", label: "In Progress",  icon: "◐", color: "text-[var(--yellow)]" },
  { status: "blocked",     label: "Blocked",      icon: "●", color: "text-[var(--red)]" },
  { status: "deferred",    label: "Deferred",     icon: "❄", color: "text-[var(--accent)]" },
  { status: "closed",      label: "Closed",       icon: "✓", color: "text-[var(--text-muted)]" },
];

function KanbanCard({ issue, gated, onSelect }: { issue: IssueModel; gated: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`group w-full rounded-lg border p-3 text-left transition-all ${
        gated
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/5 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/10"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface2)]"
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={issue.priority} />
        <TypeBadge type={issue.type} />
        {gated && <span className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">⏳ gate</span>}
      </div>

      <p className={`text-sm font-medium leading-snug ${issue.isClosed() ? "text-[var(--text-muted)] line-through" : gated ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
        {issue.title}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-[var(--text-muted)]">{issue.id}</span>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          {issue.assignee && <span>@{issue.assignee}</span>}
          <span>{issue.timeAgo()}</span>
        </div>
      </div>
    </button>
  );
}

export function KanbanBoard({ issues, gates, onSelect }: Props) {
  const grouped = Object.fromEntries(
    COLUMNS.map((col) => [col.status, issues.filter((i) => i.status === col.status)])
  ) as Record<Status, IssueModel[]>;

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {COLUMNS.map((col) => {
        const colIssues = grouped[col.status] ?? [];
        return (
          <div key={col.status} className="flex w-72 shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${col.color}`}>{col.icon}</span>
                <span className="text-sm font-medium text-[var(--text)]">{col.label}</span>
              </div>
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {colIssues.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {colIssues.length === 0 && (
                <div className="flex h-16 items-center justify-center text-xs text-[var(--text-muted)]">
                  Empty
                </div>
              )}
              {colIssues.map((issue) => (
                <KanbanCard
                  key={issue.id}
                  issue={issue}
                  gated={gates.some((g) => g.issueId === issue.id && g.status === "open")}
                  onSelect={() => onSelect(issue.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
