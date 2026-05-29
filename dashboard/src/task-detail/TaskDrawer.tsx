import { X } from "lucide-react";
import type { TaskDetail } from "../app/types";
import { AcceptanceChecklist } from "../acceptance/AcceptanceChecklist";
import { AcceptanceMatrix } from "../acceptance/AcceptanceMatrix";
import { ManualReviewForm } from "../acceptance/ManualReviewForm";
import { EvidenceList } from "../runs/EvidenceList";
import { RunList } from "../runs/RunList";
import { ToolbarButton } from "../shared/ToolbarButton";
import { ActivityTimeline } from "./ActivityTimeline";
import { DependencyPanel } from "./DependencyPanel";
import { ScopePanel } from "./ScopePanel";
import { TaskSummary } from "./TaskSummary";

interface TaskDrawerProps {
  detail?: TaskDetail | null;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenRun?: (runId: string) => void;
  onRunTask: (taskId: string) => void;
  onAcceptanceStatus: (acceptanceId: string, status: string) => void;
  onManualReview: (
    reviewer: string,
    result: "accepted" | "rejected",
    notes: string,
    residualRisks: string,
    evidenceReviewed: string[],
  ) => void;
}

function formatValidationItem(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    return Object.entries(item)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ");
  }
  return String(item);
}

export function TaskDrawer({
  detail,
  onClose,
  onOpenTask,
  onOpenRun,
  onRunTask,
  onAcceptanceStatus,
  onManualReview,
}: TaskDrawerProps) {
  if (!detail) {
    return (
      <aside className="task-drawer empty" aria-label="Task detail">
        Select a task.
      </aside>
    );
  }

  const canRun = detail.task.status === "ready";

  return (
    <aside className="task-drawer" aria-label="Task detail">
      <div className="drawer-actions">
        <ToolbarButton
          label={canRun ? "Run" : "Ready required"}
          onClick={() => onRunTask(detail.task.task_id)}
          disabled={!canRun}
          title={canRun ? "Run task" : "Set task to Ready before running"}
        />
        <button className="icon-button" onClick={onClose} aria-label="Close task detail">
          <X size={18} />
        </button>
      </div>
      <TaskSummary detail={detail} />
      <ScopePanel task={detail.task} />
      <DependencyPanel dependencies={detail.dependencies} onOpenTask={onOpenTask} />
      <section className="drawer-section">
        <h3>Validation</h3>
        <ul>
          {(detail.task.validation || []).map((command, index) => {
            const label = formatValidationItem(command);
            return (
              <li key={`${index}-${label}`}>
                <code>{label}</code>
              </li>
            );
          })}
        </ul>
      </section>
      <AcceptanceMatrix detail={detail} />
      <AcceptanceChecklist items={detail.acceptance_items} onUpdateStatus={onAcceptanceStatus} />
      <RunList runs={detail.runs} onOpenRun={onOpenRun} />
      <EvidenceList evidence={detail.evidence} />
      <ManualReviewForm evidence={detail.evidence} onSubmit={onManualReview} />
      <ActivityTimeline events={detail.activity} />
    </aside>
  );
}
