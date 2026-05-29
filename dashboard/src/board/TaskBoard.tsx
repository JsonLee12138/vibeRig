import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { Board, TaskStatus } from "../app/types";
import { EmptyState } from "../shared/EmptyState";
import { TaskColumn } from "./TaskColumn";

interface TaskBoardProps {
  board?: Board | null;
  onOpenTask: (taskId: string) => void;
  onMoveStatus: (taskId: string, status: TaskStatus) => void;
  onRunTask: (taskId: string) => void;
  onReorder: (taskId: string, direction: "up" | "down") => void;
}

export function TaskBoard({ board, onOpenTask, onMoveStatus, onRunTask, onReorder }: TaskBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  if (!board) {
    return <EmptyState title="Select a requirement" />;
  }

  const dependencyCount = (taskDbId: string) => board.dependencies.filter((item) => item.task_id === taskDbId).length;

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const targetStatus = event.over?.id as TaskStatus | undefined;
    if (targetStatus) {
      onMoveStatus(taskId, targetStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="board-grid">
        {board.columns.map((column) => (
          <TaskColumn
            key={column.status}
            column={column}
            dependencyCount={dependencyCount}
            onOpenTask={onOpenTask}
            onMoveStatus={onMoveStatus}
            onRunTask={onRunTask}
            onReorder={onReorder}
          />
        ))}
      </div>
    </DndContext>
  );
}
