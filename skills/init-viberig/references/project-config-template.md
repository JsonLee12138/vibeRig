# .vibeRig/config.yaml Template

```yaml
project:
  name: example-project
  root: .
worktrees:
  root: ./worktrees
  default_base: origin/main
  sync_before_pr: merge
symphony:
  runtime: plugin
  plugin_root: ./plugins/vibe-rig
  workflow_planning: ./WORKFLOW.planning.md
  workflow_implementation: ./WORKFLOW.implementation.md
  setup_command: ./.vibeRig/bin/symphony-setup
  planning_command: ./.vibeRig/bin/symphony-planning
  implementation_command: ./.vibeRig/bin/symphony-implementation
  runner_ports:
    planning_start: 49170
    implementation_start: 49180
viberig:
  service_url: http://127.0.0.1:49160
  service_port: 49160
  autostart: true
  user_entry: panel
ports:
  preview_start: 49200
  strategy: find-next-free
context_mode:
  required: false
  install_method: codex-plugin-marketplace
  marketplace: mksglu/context-mode
  status_file: ./.vibeRig/context-mode.md
insights:
  enabled: true
  trigger: post_acceptance
  auto_apply_project_notes: true
  auto_apply_workflow_rules: false
  auto_apply_skill_updates: false
  auto_apply_user_preferences: false
linear:
  project_slug: ""
  planning_states:
    - Planning
  implementation_states:
    - Todo
    - In Progress
    - Rework
commands:
  install: ""
  dev: ""
  test: ""
```
