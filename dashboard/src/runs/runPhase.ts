export const runPhaseLabels: Record<string, string> = {
  created: "Created",
  preflight: "Preflight",
  workspace_ready: "Workspace Ready",
  development: "Development",
  codex_starting: "Codex Starting",
  codex_running: "Codex Running",
  codex_completed: "Implementation Done",
  test_authoring: "Test Authoring",
  test_authoring_completed: "Tests Authored",
  validating: "Validation",
  validation_failed: "Validation Failed",
  self_acceptance_written: "Self Acceptance",
  acceptance_review: "Acceptance Review",
  acceptance_review_completed: "AI Review Done",
  acceptance_failed: "AI Review Failed",
  success: "Success",
  failed: "Failed",
  blocked: "Blocked",
  canceled: "Canceled",
};

export function runPhaseLabel(value?: string | null): string {
  if (!value) return "No phase";
  return runPhaseLabels[value] || value.replaceAll("_", " ");
}
