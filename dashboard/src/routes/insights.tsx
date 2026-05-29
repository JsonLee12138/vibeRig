import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
});
