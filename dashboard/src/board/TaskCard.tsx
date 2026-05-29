import { ChevronDown, ChevronUp, FileText, GripVertical, Play, SlidersHorizontal } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import type { Task, TaskStatus } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";
import { runPhaseLabel } from "../runs/runPhase";
import { boardStatuses, statusLabels } from "./boardRules";

interface TaskCardProps {
  task: Task;
  dependencyCount: number;
  onOpen: (taskId: string) => void;
  onOpenRun?: (runId: string) => void;
  onMoveStatus: (taskId: string, status: TaskStatus) => void;
  onRun: (taskId: string) => void;
  onReorder: (taskId: string, direction: "up" | "down") => void;
}

export function TaskCard({ task, dependencyCount, onOpen, onOpenRun, onMoveStatus, onRun, onReorder }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.task_id,
    data: { status: task.status },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const progress = task.acceptance_progress || { completed: 0, total: 0 };
  const canRun = task.status === "ready";
  const latestRunPhase = task.latest_run?.implementation_status || task.latest_run?.status;
  const statusReason = task.status_reason || task.blocked_reason || task.latest_run?.error_summary || task.latest_run?.summary;

  return (
    <article ref={setNodeRef} style={style} className={isDragging ? "task-card dragging" : "task-card"}>
      <div className="card-head">
        <button
          className="drag-handle"
          title="Drag task"
          aria-label={`Drag ${task.task_id}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={16} />
        </button>
        <button className="card-title" onClick={() => onOpen(task.task_id)}>
          <strong>{task.task_id}</strong>
          <span>{task.title}</span>
        </button>
      </div>
      <div className="card-meta">
        <StatusBadge value={task.status} />
        {task.definition_stale ? <StatusBadge value="definition changed" /> : null}
        <span>{task.roadmap_id || "no roadmap"}</span>
        <span>deps {dependencyCount}</span>
      </div>
      <div className="card-meta">
        <span>AC {progress.completed}/{progress.total}</span>
        <span>{task.status === "running" ? runPhaseLabel(latestRunPhase) : task.latest_run?.status || "no run"}</span>
        <span>{task.manual_review?.result || "no review"}</span>
      </div>
      {task.status === "blocked" || task.status === "failed" ? (
        <p className="card-reason">{String(statusReason || "Needs attention")}</p>
      ) : null}
      <div className="card-actions">
        {canRun ? (
          <button className="card-start-button primary" title="Start task" onClick={() => onRun(task.task_id)}>
            <Play size={15} />
            <span>Start</span>
          </button>
        ) : null}
        {onOpenRun && task.latest_run?.id && ["running", "blocked", "failed"].includes(task.status) ? (
          <button title="Open run log" onClick={() => onOpenRun(task.latest_run?.id || "")}>
            <FileText size={15} />
            <span>Logs</span>
          </button>
        ) : null}
        <button title="Move up" onClick={() => onReorder(task.task_id, "up")}>
          <ChevronUp size={15} />
        </button>
        <button title="Move down" onClick={() => onReorder(task.task_id, "down")}>
          <ChevronDown size={15} />
        </button>
        {!canRun ? (
          <button title="Set task to Ready before running" onClick={() => onRun(task.task_id)} disabled aria-disabled>
            <Play size={15} />
          </button>
        ) : null}
        <label title="Change status">
          <SlidersHorizontal size={15} />
          <select value={task.status} onChange={(event) => onMoveStatus(task.task_id, event.target.value as TaskStatus)}>
            {boardStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
