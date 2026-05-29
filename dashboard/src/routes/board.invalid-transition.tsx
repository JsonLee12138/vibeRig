import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoardPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/board/invalid-transition")({
  component: () => <KanbanBoardPage invalidTransition />,
});
