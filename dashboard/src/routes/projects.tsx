import { createFileRoute } from "@tanstack/react-router";
import { ProjectSelectionPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/projects")({
  component: ProjectSelectionPage,
});
