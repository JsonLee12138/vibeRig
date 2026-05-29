import { createFileRoute } from "@tanstack/react-router";
import { TaskDetailPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/tasks/$taskId/run")({
  component: TaskRunRoute,
});

function TaskRunRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetailPage taskId={taskId} mode="running" />;
}
