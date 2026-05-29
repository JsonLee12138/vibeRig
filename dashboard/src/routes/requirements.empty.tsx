import { createFileRoute } from "@tanstack/react-router";
import { EmptyRequirementPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/requirements/empty")({
  component: EmptyRequirementPage,
});
