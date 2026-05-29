import { createFileRoute } from "@tanstack/react-router";
import { TaskDetailPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/tasks/$taskId/accepted")({
  component: TaskAcceptedRoute,
});

function TaskAcceptedRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetailPage taskId={taskId} mode="accepted" />;
}
