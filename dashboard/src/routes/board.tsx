import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoardPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/board")({
  component: KanbanBoardPage,
});
