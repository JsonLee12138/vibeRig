const toneByStatus: Record<string, string> = {
  draft: "badge-neutral",
  ready: "badge-info",
  running: "badge-warning",
  self_accepted: "badge-review",
  human_review: "badge-review",
  accepted: "badge-success-strong",
  blocked: "badge-danger",
  failed: "badge-danger",
  canceled: "badge-neutral",
  "definition changed": "badge-warning",
  passed: "badge-success",
  rejected: "badge-danger",
};

export function StatusBadge({ value }: { value?: string | null }) {
  const status = value || "unknown";
  return <span className={`status-badge ${toneByStatus[status] || "badge-neutral"}`}>{status.replaceAll("_", " ")}</span>;
}
