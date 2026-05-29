import { createFileRoute } from "@tanstack/react-router";
import { TaskDetailPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskRoute,
});

function TaskRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetailPage taskId={taskId} />;
}
