import { useState } from "react";
import type { Run } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";
import { ToolbarButton } from "../shared/ToolbarButton";
import { RunLogViewer } from "./RunLogViewer";
import { runPhaseLabel } from "./runPhase";

export function RunList({ runs, onOpenRun }: { runs: Run[]; onOpenRun?: (runId: string) => void }) {
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.id || "");
  return (
    <section className="drawer-section">
      <h3>Runs</h3>
      {runs.length ? (
        <>
          <ul className="run-list">
            {runs.map((run) => (
              <li key={run.id}>
                <button onClick={() => setSelectedRunId(run.id)}>{run.id.slice(0, 12)}</button>
                <StatusBadge value={run.status} />
                <span>{runPhaseLabel(run.implementation_status)}</span>
                <span>{run.started_at || ""}</span>
                <span>{run.finished_at || ""}</span>
              </li>
            ))}
          </ul>
          {onOpenRun && selectedRunId ? (
            <div className="row-actions">
              <ToolbarButton label="Open Full Log View" onClick={() => onOpenRun(selectedRunId)} />
            </div>
          ) : null}
          <RunLogViewer runId={selectedRunId} />
        </>
      ) : (
        <p className="muted">No runs recorded.</p>
      )}
    </section>
  );
}
