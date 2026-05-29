import { createFileRoute } from "@tanstack/react-router";
import { RegisterProjectPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/projects_/register")({
  component: RegisterProjectPage,
});
