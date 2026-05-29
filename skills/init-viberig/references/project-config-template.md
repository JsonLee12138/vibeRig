# .vibeRig/config.yaml Template

```yaml
project:
  name: example-project
  root: .
worktrees:
  root: ./worktrees
  default_base: origin/main
  sync_before_pr: merge
viberig:
  service_url: http://127.0.0.1:49160
  service_port: 49160
  autostart: true
  user_entry: panel
  task_engine: local
ports:
  preview_start: 49200
  strategy: find-next-free
context_mode:
  required: false
  install_method: codex-plugin-marketplace
  marketplace: mksglu/context-mode
  status_file: ./.vibeRig/context-mode.md
runner:
  codex:
    adapter: codex-cli-mcp
    mcp_command: npx -y codex-mcp-server
    mcp_tool: codex
    enable_features:
      - hooks
    sandbox: workspace-write
    full_auto: false
    mcp_initialize_timeout_ms: 60000
    mcp_tool_timeout_ms: 600000
    turn_timeout_ms: 600000
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
