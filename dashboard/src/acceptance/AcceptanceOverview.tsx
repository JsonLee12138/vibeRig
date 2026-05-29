import type { Board } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";

export function AcceptanceOverview({
  board,
  onBackToBoard,
  onOpenTask,
}: {
  board?: Board | null;
  onBackToBoard: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  if (!board) {
    return null;
  }

  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <p className="eyebrow">Acceptance Matrix</p>
          <h1>{board.requirement.title}</h1>
          <p className="page-copy">
            Requirement-wide view of acceptance criteria, linked tasks, current result, and implementation coverage.
          </p>
        </div>
        <div className="page-actions">
          <ToolbarButton label="Back to Board" onClick={onBackToBoard} />
        </div>
      </div>

      <div className="matrix-page">
        <div className="matrix-page-head">Criteria</div>
        <div className="matrix-page-head">Status</div>
        <div className="matrix-page-head">Linked Tasks</div>
        <div className="matrix-page-head">Coverage</div>
        {board.acceptance_items.map((item) => {
          const linkedTasks = board.task_acceptance_links
            .filter((link) => link.acceptance_item_id === item.id)
            .map((link) => board.tasks.find((task) => task.id === link.task_id))
            .filter((task): task is NonNullable<typeof task> => Boolean(task));
          const completed = linkedTasks.filter((task) => task.status === "accepted").length;

          return (
            <div className="matrix-page-row" key={item.id}>
              <div className="matrix-page-cell">
                <strong>{item.acceptance_id}</strong>
                <span>{item.title}</span>
              </div>
              <div className="matrix-page-cell">
                <StatusBadge value={item.status} />
              </div>
              <div className="matrix-page-cell">
                {linkedTasks.length ? (
                  <div className="matrix-task-list">
                    {linkedTasks.map((task) => (
                      <button key={task.id} className="matrix-task-pill" onClick={() => onOpenTask(task.task_id)}>
                        <span>{task.task_id}</span>
                        <StatusBadge value={task.status} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="muted">No linked tasks</span>
                )}
              </div>
              <div className="matrix-page-cell">
                <strong>{completed}/{linkedTasks.length || 0}</strong>
                <span>tasks accepted</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
