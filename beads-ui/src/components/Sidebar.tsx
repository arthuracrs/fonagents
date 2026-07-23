import { useEffect, useState } from "react";
import type { OverseerStatus } from "../types";
import { api } from "../api";

export type View = "all" | "ready" | "formulas" | "graph";

interface Props {
  view: View;
  onView: (v: View) => void;
}

const navItems: { label: string; view: View; icon: string }[] = [
  { label: "Board",         view: "all",         icon: "⊞" },
  { label: "Ready",        view: "ready",        icon: "→" },
  { label: "Graph",        view: "graph",        icon: "◇" },
  { label: "Formulas",     view: "formulas",     icon: "⬡" },
];

export function Sidebar({ view, onView }: Props) {
  const [overseer, setOverseer] = useState<OverseerStatus | null>(null);

  useEffect(() => {
    api.overseer().then(setOverseer).catch(() => {});
  }, []);

  const handleToggle = async () => {
    const result = await api.overseerToggle();
    setOverseer((prev) =>
      prev ? { ...prev, config: { ...prev.config, enabled: result.enabled } } : prev
    );
  };

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-2 py-4">
      <div className="mb-4 px-3">
        <div className="flex items-center gap-2">
          <span className="text-base">◎</span>
          <span className="text-sm font-semibold text-[var(--text)]">Beads</span>
        </div>
      </div>

      <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Views</div>
      <div className="space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onView(item.view)}
            className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              view === item.view
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            }`}
          >
            <span className="text-xs w-4 text-center">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Overseer</div>
        <div className="flex items-center justify-between px-3 py-1.5 text-sm">
          <span className={`text-xs ${overseer?.config.enabled ? "text-green-500" : "text-[var(--text-muted)]"}`}>
            {overseer?.config.enabled ? "On" : "Off"}
          </span>
          <button
            onClick={handleToggle}
            className={`relative h-4 w-7 rounded-full transition-colors ${
              overseer?.config.enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`}
            title={overseer?.config.enabled ? "Click to disable" : "Click to enable"}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                overseer?.config.enabled ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {overseer && (
          <div className="px-3 text-[10px] text-[var(--text-muted)] leading-relaxed">
            <div>mode: {overseer.config.mode}</div>
            <div>active: {overseer.activeOverseers}</div>
            <div>queued: {overseer.queueLength}</div>
          </div>
        )}
      </div>
    </nav>
  );
}
