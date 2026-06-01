---
name: init-viberig
description: Initialize a target project for VibeRig, the global VibeRig panel, local task execution, and optional context-mode usage. Use when the user asks to set up VibeRig in a project, create .vibeRig config, configure worktrees, register the project in the global panel, configure accepted-work insights, or prepare project-level subagents for requirement planning and implementation.
---

# Init VibeRig

Use this skill to prepare a business project for the VibeRig workflow.

User-facing control should happen through the global VibeRig panel. CLI commands
are implementation details used by this skill and by debugging fallbacks.

## Inputs To Resolve

- Target project directory. Default to the current workspace.
- Project name. Default to the target directory name.
- Install, dev, and test commands if obvious from the project; otherwise leave them blank.
- Linear project/team values only when the user provides them.

## Output Contract

Create or update this target-project structure:

```text
<project-root>/
├── .vibeRig/
│   ├── config.yaml
│   ├── context-mode.md
│   ├── bin/
│   │   └── viberig
│   ├── insights/
│   │   ├── candidates.md
│   │   └── confirmed.md
│   └── requirements/
├── .codex/
│   └── agents/
├── worktrees/
└── .gitignore
```

## Workflow

1. Locate the target project root. Prefer the current workspace or git root unless the user gives a path.
2. Run `scripts/init_project.py <project-root>` from this plugin when available. Pass command options only when known.
3. Ensure `.vibeRig/config.yaml` uses:
   - `worktrees.root: ./worktrees`
   - `worktrees.default_base: origin/main`
   - `worktrees.sync_before_pr: merge`
   - `viberig.service_url: http://127.0.0.1:49160`
   - `viberig.autostart: true`
   - `viberig.task_engine: local`
   - preview port starting at `49200`
   - `runner.codex.adapter: codex-cli-mcp`
   - `runner.codex.mcp_command: npx -y codex-mcp-server`
   - `runner.codex.mcp_tool: codex`
   - `runner.codex.enable_features: [hooks]`
   - `runner.codex.sandbox: workspace-write`
   - `runner.codex.full_auto: false`
   - `runner.codex.mcp_initialize_timeout_ms: 60000`
   - `runner.codex.mcp_tool_timeout_ms: 600000`
4. Ensure the target project's `.codex/config.toml` has `[features].hooks = true`. Do not write VibeRig MCP settings into this file; VibeRig's own MCP server is declared by the VibeRig plugin manifest.
5. Ensure the Codex CLI MCP adapter is reachable:
   - Prefer the configured command `npx -y codex-mcp-server`.
   - Do not require global installation.
   - Report that task runs depend on npm registry access unless the project intentionally pins another command.
   - Keep the project initialized even if installation is deferred, and report that task runs require the Codex CLI MCP adapter.
6. Ensure `worktrees/` is ignored in the target project `.gitignore`.
7. Check whether these project-level agents exist under `.codex/agents/`:
   - `analyst`
   - `researcher`
   - `planner`
   - `qa`
   - `code_review`
   - `integrator`
8. If recommended agents are missing, ask the user whether to create them. If they agree, use the `agent-creator` skill.
9. Ensure the global VibeRig service:
   - The global panel uses fixed local URL `http://127.0.0.1:49160`.
   - Run `api/server.py ensure --install-autostart` unless the user explicitly opts out.
   - Register the current project with `api/server.py register <project-root>`.
   - After registration, verify the project appears in `api/server.py status` or `GET /api/projects` with an exact normalized `project_root` match.
   - Refresh the registered project so existing `.vibeRig/requirements/*` are imported into the dashboard.
   - If registration or verification fails, stop and report the register output instead of continuing as if the project is dashboard-ready.
   - If the daemon is already running, do not start a duplicate; just register or update the project, verify it, and refresh it.
10. Check optional context-mode support:
   - Prefer this Codex plugin marketplace install path:
     `codex plugin marketplace add mksglu/context-mode`
   - Do not default to `npm install -g context-mode`.
   - If Codex reports another required install/enable step, report that step.
   - If context-mode is unavailable, keep VibeRig initialized and record the degraded state in `.vibeRig/context-mode.md`.

## Port Rules

- Avoid common app ports such as `3000`, `5173`, `8000`, and `8080`.
- The global VibeRig panel uses fixed port `49160`.
- If `49160` is occupied by a non-VibeRig process, report the conflict instead of choosing another user-facing port.
- Preview servers still use high ports from `.vibeRig/config.yaml`, starting at `49200`.

## Codex CLI MCP Adapter Rules

- VibeRig's default real Codex runner is `codex-cli-mcp`, implemented by `tuannvm/codex-mcp-server`.
- Do not configure the official `codex mcp-server` as the default runner.
- Do not configure `tuannvm/codex-mcp-server` inside `.codex/config.toml`; VibeRig backend calls it as the provider adapter.
- The VibeRig plugin should declare its own MCP server with `mcpServers: "./.mcp.json"` in `.codex-plugin/plugin.json`.
- The plugin `.mcp.json` should expose the backend MCP command:

```json
{
  "mcpServers": {
    "viberig": {
      "command": "python3",
      "args": ["./api/server.py", "mcp"],
      "cwd": "."
    }
  }
}
```

- Project config should explicitly include the adapter command so initialized projects are self-describing:

```yaml
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
```

- The backend speaks JSON-line JSON-RPC over stdio to `codex-mcp-server`.
- The backend executes `runner.codex.mcp_command` exactly as configured. Prefer `npx -y codex-mcp-server` unless the project intentionally pins another command.
- `runner.codex.enable_features` records desired Codex CLI feature flags such as `hooks`. The current `tuannvm/codex-mcp-server` adapter does not expose feature-flag passthrough, so project `.codex/config.toml` is the active hooks enablement path.
- If `runner.codex.model` is omitted, the backend uses the user's `$CODEX_HOME/config.toml` model and falls back to `gpt-5.5` when unavailable.
- The backend passes the task worktree as `workingDirectory` and the VibeRig Codex session id as `sessionId`.
- If a project intentionally uses another provider later, write that as a project override rather than renaming `codex-cli-mcp`.

## Context-Mode Rules

- context-mode is an optional evidence source for post-acceptance insights.
- Use the Codex plugin marketplace route: `codex plugin marketplace add mksglu/context-mode`.
- Do not vendor, submodule, clone, or build context-mode inside VibeRig.
- Do not use npm global install as the default setup path.
- If context-mode MCP tools are unavailable, VibeRig must still support `brainstorm`, `write-plan`, and local task execution.
- Use `.vibeRig/context-mode.md` for local setup status. This file is local runtime state and should be ignored by git.

## Insights Rules

- Initialize `.vibeRig/insights/candidates.md` and `.vibeRig/insights/confirmed.md`.
- During active implementation, agents may read confirmed learnings but must not create new learnings.
- New learning candidates are generated only after validation, acceptance review, and code review pass.
- Only low-risk high-confidence project notes may be auto-applied. Workflow rules, skill updates, and user preferences require confirmation.

## Agent Creation Rules

When creating agents with `agent-creator`:

- Use project-level `.codex/agents/` by default.
- Analysis, research, planning, QA, review, and integration agents should be `read-only` unless they need to run local commands that write caches.
- Implementation agents should be created at runtime for the task domain, such as frontend, backend, DevOps, or data work, and should use `workspace-write` only when expected to edit project files.
- Put role boundaries, inputs, outputs, stop conditions, and escalation conditions in `developer_instructions`.
- Do not add custom TOML fields outside the official Codex custom agent schema.
