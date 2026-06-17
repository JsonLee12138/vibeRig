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
workspace:
  worktrees_root: ".worktrees"
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
  default_implementation: "implementation"
  default_qa: "qa"
  default_review: "code_review"
  default_security_audit: "security_auditor"
  default_test_engineer: "test_engineer"
  default_integration: "integrator"
```
