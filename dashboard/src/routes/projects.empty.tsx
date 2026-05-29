import { createFileRoute } from "@tanstack/react-router";
import { EmptyProjectPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/projects/empty")({
  component: EmptyProjectPage,
});
