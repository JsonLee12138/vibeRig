import { createFileRoute } from "@tanstack/react-router";
import { TaskDetailPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/tasks/$taskId/blocked")({
  component: TaskBlockedRoute,
});

function TaskBlockedRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetailPage taskId={taskId} mode="blocked" />;
}
