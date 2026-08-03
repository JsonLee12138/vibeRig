export function contextRoutesYaml(): string {
  return `version: 1
routes:
  - id: project-default
    match:
      paths:
        - "**"
    read:
      - "AGENTS.md"
      - "ARCHITECTURE.md"
      - "nearest:AGENTS.md"
      - "active:requirement"
    verify: []
    reviewers: []
`;
}

export function environmentsYaml(): string {
  return `version: 1
profiles:
  local:
    autonomy: full
    disposable: true
    production_network: denied
    commands:
      bootstrap: ""
      start: ""
      reset: ""
      health: ""
    credentials:
      disposable_local: autonomous
      provider_sandbox: autonomous_if_present
      shared_dev: require_existing
      production: forbidden
`;
}

export function runbooksYaml(): string {
  return `version: 1
policy:
  require_for_operational_change: true
  require_exercise_evidence: true
runbooks: []
`;
}
