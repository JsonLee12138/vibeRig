import { createFileRoute } from "@tanstack/react-router";
import { AcceptanceMatrixPage } from "../app/StaticDashboard";

export const Route = createFileRoute("/matrix")({
  component: AcceptanceMatrixPage,
});
