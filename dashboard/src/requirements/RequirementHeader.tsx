import { RefreshCw } from "lucide-react";
import type { Board } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";

export function RequirementHeader({ board, onSync, loading }: { board?: Board | null; onSync?: () => void; loading?: boolean }) {
  if (!board) {
    return null;
  }

  const total = board.tasks.length;
  const accepted = board.tasks.filter((task) => task.status === "accepted").length;
  const blocked = board.tasks.filter((task) => task.status === "blocked").length;
  const failed = board.tasks.filter((task) => task.status === "failed").length;

  return (
    <section className="requirement-header">
      <div className="requirement-copy">
        <span className="eyebrow">Requirement</span>
        <h1>{board.requirement.title}</h1>
        <div className="requirement-meta">
          <span>{board.requirement.requirement_id}</span>
          <span>{total} tasks in scope</span>
        </div>
      </div>
      <div className="header-metrics">
        {onSync ? (
          <ToolbarButton
            icon={<RefreshCw size={16} />}
            label={loading ? "Syncing" : "Sync Requirement"}
            onClick={onSync}
            disabled={loading}
          />
        ) : null}
        <strong>{accepted}/{total}</strong>
        <StatusBadge value="accepted" />
        <strong>{blocked}</strong>
        <StatusBadge value="blocked" />
        <strong>{failed}</strong>
        <StatusBadge value="failed" />
      </div>
    </section>
  );
}
