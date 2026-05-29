import type { TaskStatus } from "../app/types";

export const statusLabels: Record<TaskStatus, string> = {
  draft: "Backlog",
  ready: "Ready",
  running: "Running",
  self_accepted: "Self Accepted",
  human_review: "Human Review",
  accepted: "Accepted",
  blocked: "Blocked",
  failed: "Failed",
  canceled: "Canceled",
};

export const boardStatuses: TaskStatus[] = [
  "draft",
  "ready",
  "running",
  "human_review",
  "accepted",
  "blocked",
  "failed",
];

export function orderedTaskIds(taskIds: string[], taskId: string, direction: "up" | "down") {
  const next = [...taskIds];
  const index = next.indexOf(taskId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= next.length) {
    return next;
  }
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
