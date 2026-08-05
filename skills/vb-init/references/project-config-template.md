# .vibeRig/project.yaml V2 Template

```yaml
version: 2
project:
  name: "example-project"
  root: "."
  repo_url: ""
  architecture: "ARCHITECTURE.md"
documents:
  mode: "discover"
  requirement_root: ".vibeRig/requirements"
  exec_plan_root: "docs/exec-plans"
  runbook_index: "docs/runbooks/index.md"
  context_routes: ".vibeRig/context-routes.yaml"
environment:
  manifest: ".vibeRig/environments.yaml"
  default_profile: "local"
commands:
  bootstrap: ""
  start: ""
  reset: ""
  health: ""
  targeted_test: ""
  smoke: ""
evidence:
  root: "artifacts/viberig"
  retention: "accepted_only"
tracking:
  provider: "linear"
  mode: "adapter"
output:
  language: "zh-CN"
pull_request:
  required: "true"
  provider: "auto"
  base_branch: ""
  draft: "false"
linear:
  team_id: ""
  project_id: ""
  project_document_id: ""
  project_document_title: "VibeRig Project Registration"
gate_policy:
  hooks_enabled: false
  ci_required: "project_decides"
  required_commands: []
  manual_checks: []
subagents:
  default_research: "researcher"
  default_qa: "qa"
  default_security_audit: "security_auditor"
  default_review: "code_review"
```

Validate with `assets/project-profile.schema.json`. Worktrees always live at `.worktrees/`; V2 removes the legacy `docs.root` and `workspace` sections. Run `viberig init --upgrade --yes` for an explicit preserving migration: it maps `docs.root` to `documents.requirement_root`, removes `workspace`, retains known settings and preserves unknown extension keys.

`documents.mode=discover` is the default. Existing project documentation remains authoritative; the requirement directory stores bounded Work Item state and references instead of mirroring whole specs. `tracking` is an adapter and cannot block local execution.

`subagents` only pins the four recurring defaults above. Implementation, integration, test authoring, architecture and domain review are resolved ad hoc through `subagent-routing`; do not add fixed keys for them.
