import type { TaskDetail } from "../app/types";
import { RunLogViewer } from "./RunLogViewer";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";
import { runPhaseLabel } from "./runPhase";

export function RunExplorer({
  detail,
  runId,
  onBackToBoard,
  onSelectRun,
}: {
  detail?: TaskDetail | null;
  runId: string;
  onBackToBoard: () => void;
  onSelectRun: (runId: string) => void;
}) {
  if (!detail) {
    return null;
  }

  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <p className="eyebrow">Full Run Log View</p>
          <h1>{detail.task.task_id} · {detail.task.title}</h1>
          <p className="page-copy">
            Inspect execution history, live logs, run status, and timestamps without collapsing back into the task drawer.
          </p>
        </div>
        <div className="page-actions">
          <ToolbarButton label="Back to Board" onClick={onBackToBoard} />
        </div>
      </div>

      <div className="run-explorer">
        <section className="run-explorer-list">
          <h2>Runs</h2>
          {detail.runs.length ? (
            <ul className="run-list run-list-expanded">
              {detail.runs.map((run) => (
                <li key={run.id}>
                  <button onClick={() => onSelectRun(run.id)}>{run.id.slice(0, 12)}</button>
                  <StatusBadge value={run.status} />
                  <span>{runPhaseLabel(run.implementation_status)}</span>
                  <span>{run.started_at || ""}</span>
                  <span>{run.finished_at || ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No runs recorded.</p>
          )}
        </section>

        <section className="run-explorer-log">
          <div className="insight-panel-head">
            <h2>Execution log</h2>
            <span>{runId ? runId.slice(0, 12) : "No run selected"}</span>
          </div>
          <RunLogViewer runId={runId} />
        </section>
      </div>
    </section>
  );
}
