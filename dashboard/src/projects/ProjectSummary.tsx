import type { Board, Project, Requirement } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";

export function ProjectSummary({
  project,
  requirements,
  board,
}: {
  project?: Project;
  requirements: Requirement[];
  board?: Board | null;
}) {
  const counts = new Map<string, number>();
  board?.tasks.forEach((task) => counts.set(task.status, (counts.get(task.status) || 0) + 1));

  return (
    <section className="summary-strip" aria-label="Project summary">
      <div className="summary-card summary-card-featured">
        <span className="summary-label">Project</span>
        <strong>{project?.name || "Unselected"}</strong>
        <span className="summary-meta">{project?.project_root || "Connect a repository to start."}</span>
      </div>
      <div className="summary-card">
        <span className="summary-label">Requirements</span>
        <strong>{requirements.length}</strong>
        <span className="summary-meta">Imported into the active board</span>
      </div>
      {["ready", "running", "human_review", "blocked", "failed", "accepted"].map((status) => (
        <div key={status} className="summary-card">
          <StatusBadge value={status} />
          <strong>{counts.get(status) || 0}</strong>
          <span className="summary-meta">Tasks</span>
        </div>
      ))}
    </section>
  );
}
