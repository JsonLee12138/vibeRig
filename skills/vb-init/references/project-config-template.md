# .vibeRig/project.yaml Template

```yaml
version: 1
project:
  name: "example-project"
  root: "."
  repo_url: ""
docs:
  root: ".vibeRig/requirements"
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
  ci_required: "project_decides"
  required_commands: []
  manual_checks: []
subagents:
  default_research: "researcher"
  default_qa: "qa"
  default_security_audit: "security_auditor"
  default_review: "code_review"
```

Worktrees always live at the fixed project path `.worktrees/` — not configurable, no `workspace` section needed.

`subagents` only pins the four defaults above. Any other role (implementation, integration, test authoring, domain-specific review, etc.) is resolved ad hoc through `subagent-routing` at the point of need — do not add more fixed keys here. Codex, Claude Code, and Cursor each have their own native subagent/dispatch mechanism; this file only records which capability name to prefer for the four recurring roles.
