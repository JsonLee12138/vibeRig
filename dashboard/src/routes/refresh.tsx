import { createFileRoute } from "@tanstack/react-router";
import { ProjectRefreshPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/refresh")({
  component: ProjectRefreshPage,
});
