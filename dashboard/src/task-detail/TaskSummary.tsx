import type { TaskDetail } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";

export function TaskSummary({ detail }: { detail: TaskDetail }) {
  const { task } = detail;
  const statusReason = task.status_reason || task.blocked_reason || task.latest_run?.error_summary || task.latest_run?.summary;
  return (
    <section className="drawer-section">
      <div className="drawer-title">
        <div>
          <p className="drawer-eyebrow">{task.task_id}</p>
          <h2>{task.title}</h2>
          <span>{task.roadmap_id || "No roadmap item"}</span>
        </div>
        <div className="status-stack">
          <StatusBadge value={task.status} />
          {task.definition_stale ? <StatusBadge value="definition changed" /> : null}
        </div>
      </div>
      {task.definition_stale ? (
        <p className="stale-warning">
          Task definition changed after the current status was recorded. Move it back to Ready and rerun before relying on old evidence.
        </p>
      ) : null}
      {task.status === "blocked" || task.status === "failed" ? (
        <p className="card-reason">{statusReason || "Needs attention"}</p>
      ) : null}
      <div className="detail-grid">
        <span>Type</span><strong>{task.type || "task"}</strong>
        <span>Branch</span><code>{task.branch || "none"}</code>
        <span>Worktree</span><code>{task.worktree_hint || "none"}</code>
        <span>Definition</span><code>{task.definition_stale ? `changed ${task.definition_changed_at || ""}` : "current"}</code>
      </div>
    </section>
  );
}
