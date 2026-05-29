import { createFileRoute } from "@tanstack/react-router";
import { RunLogPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/runs/$taskId/log")({
  component: RunLogRoute,
});

function RunLogRoute() {
  const { taskId } = Route.useParams();
  return <RunLogPage taskId={taskId} />;
}
