import { createFileRoute } from "@tanstack/react-router";
import { RequirementSelectionPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/requirements")({
  component: RequirementSelectionPage,
});
