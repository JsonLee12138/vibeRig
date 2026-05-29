import { useDroppable } from "@dnd-kit/core";
import type { BoardColumn, TaskStatus } from "../app/types";
import { EmptyState } from "../shared/EmptyState";
import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
  column: BoardColumn;
  dependencyCount: (taskDbId: string) => number;
  onOpenTask: (taskId: string) => void;
  onMoveStatus: (taskId: string, status: TaskStatus) => void;
  onRunTask: (taskId: string) => void;
  onReorder: (taskId: string, direction: "up" | "down") => void;
}

export function TaskColumn({
  column,
  dependencyCount,
  onOpenTask,
  onMoveStatus,
  onRunTask,
  onReorder,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  return (
    <section ref={setNodeRef} className={isOver ? "task-column over" : "task-column"}>
      <header className="column-title">
        <h2>{column.title}</h2>
        <span>{column.tasks.length}</span>
      </header>
      {column.tasks.length ? (
        column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            dependencyCount={dependencyCount(task.id)}
            onOpen={onOpenTask}
            onMoveStatus={onMoveStatus}
            onRun={onRunTask}
            onReorder={onReorder}
          />
        ))
      ) : (
        <EmptyState title="No tasks" />
      )}
    </section>
  );
}
