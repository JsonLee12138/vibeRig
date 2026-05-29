import type { Task } from "../app/types";
import { StatusBadge } from "../shared/StatusBadge";

export function DependencyPanel({ dependencies, onOpenTask }: { dependencies: Task[]; onOpenTask: (taskId: string) => void }) {
  return (
    <section className="drawer-section">
      <h3>Dependencies</h3>
      {dependencies.length ? (
        <ul className="linked-list">
          {dependencies.map((task) => (
            <li key={task.id}>
              <button onClick={() => onOpenTask(task.task_id)}>{task.task_id} · {task.title}</button>
              <StatusBadge value={task.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No dependencies.</p>
      )}
    </section>
  );
}
