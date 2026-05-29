import { createFileRoute } from "@tanstack/react-router";
import { TaskDetailPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/tasks/$taskId/review")({
  component: TaskReviewRoute,
});

function TaskReviewRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetailPage taskId={taskId} mode="review" />;
}
