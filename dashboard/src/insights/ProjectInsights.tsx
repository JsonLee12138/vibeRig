import type { Board, Project, Requirement } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";

export function ProjectInsights({
  board,
  project,
  requirements,
  onBackToBoard,
}: {
  board?: Board | null;
  project?: Project;
  requirements: Requirement[];
  onBackToBoard: () => void;
}) {
  if (!project || !board) {
    return null;
  }

  const statusEntries = [
    "draft",
    "ready",
    "running",
    "human_review",
    "accepted",
    "blocked",
    "failed",
    "canceled",
  ].map((status) => ({
    status,
    count: board.tasks.filter((task) => task.status === status).length,
  })).filter((entry) => entry.count > 0);

  const staleCount = board.tasks.filter((task) => task.definition_stale).length;
  const evidenceCount = board.tasks.reduce((sum, task) => sum + (task.evidence_count || 0), 0);
  const roadmapCount = new Set(board.tasks.map((task) => task.roadmap_id).filter(Boolean)).size;

  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <p className="eyebrow">Project Insights</p>
          <h1>{project.name || project.id}</h1>
          <p className="page-copy">
            Summary of execution health, requirement import coverage, task status distribution, and evidence density for the active requirement.
          </p>
        </div>
        <div className="page-actions">
          <ToolbarButton label="Back to Board" onClick={onBackToBoard} />
        </div>
      </div>

      <div className="insight-grid">
        <article className="insight-card">
          <span>Requirements imported</span>
          <strong>{requirements.length}</strong>
        </article>
        <article className="insight-card">
          <span>Tasks in board</span>
          <strong>{board.tasks.length}</strong>
        </article>
        <article className="insight-card">
          <span>Acceptance criteria</span>
          <strong>{board.acceptance_items.length}</strong>
        </article>
        <article className="insight-card">
          <span>Evidence records</span>
          <strong>{evidenceCount}</strong>
        </article>
        <article className="insight-card">
          <span>Roadmap items</span>
          <strong>{roadmapCount}</strong>
        </article>
        <article className="insight-card">
          <span>Stale definitions</span>
          <strong>{staleCount}</strong>
        </article>
      </div>

      <section className="insight-panel">
        <div className="insight-panel-head">
          <h2>Status distribution</h2>
          <span>{board.requirement.requirement_id}</span>
        </div>
        <div className="status-distribution">
          {statusEntries.map((entry) => (
            <div key={entry.status} className="status-distribution-row">
              <StatusBadge value={entry.status} />
              <strong>{entry.count}</strong>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
