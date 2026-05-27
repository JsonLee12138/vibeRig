---
name: init-viberig
description: Initialize a target project for VibeRig, the global VibeRig panel, Symphony runners, and optional context-mode usage. Use when the user asks to set up VibeRig in a project, create .vibeRig config, install workflow templates, configure worktrees, register the project in the global panel, configure accepted-work insights, or prepare project-level subagents for requirement planning and implementation.
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
- Whether to use the Symphony reference runtime from the plugin `vendor/symphony`.

## Output Contract

Create or update this target-project structure:

```text
<project-root>/
├── .vibeRig/
│   ├── config.yaml
│   ├── context-mode.md
│   ├── bin/
│   │   ├── viberig
│   │   ├── symphony-setup
│   │   ├── symphony-planning
│   │   └── symphony-implementation
│   ├── insights/
│   │   ├── candidates.md
│   │   └── confirmed.md
│   └── requirements/
├── .codex/
│   └── agents/
├── WORKFLOW.planning.md
├── WORKFLOW.implementation.md
├── worktrees/
└── .gitignore
```

## Workflow

1. Locate the target project root. Prefer the current workspace or git root unless the user gives a path.
2. Run `scripts/init_project.py <project-root>` from this plugin when available. Pass command options only when known.
   - Use `--setup-symphony` only when the user explicitly asks init to build the bundled Symphony runtime.
3. Ensure `.vibeRig/config.yaml` uses:
   - `worktrees.root: ./worktrees`
   - `worktrees.default_base: origin/main`
   - `worktrees.sync_before_pr: merge`
   - `symphony.runtime: plugin`
   - `symphony.setup_command: ./.vibeRig/bin/symphony-setup`
   - `symphony.planning_command: ./.vibeRig/bin/symphony-planning` as an internal fallback
   - `symphony.implementation_command: ./.vibeRig/bin/symphony-implementation` as an internal fallback
   - `viberig.service_url: http://127.0.0.1:49160`
   - `viberig.autostart: true`
   - preview port starting at `49200`
4. Ensure `worktrees/` is ignored in the target project `.gitignore`.
5. Render `WORKFLOW.planning.md` and `WORKFLOW.implementation.md` from this skill's references.
6. Check whether these project-level agents exist under `.codex/agents/`:
   - `analyst`
   - `researcher`
   - `planner`
   - `qa`
   - `code_review`
   - `integrator`
7. If recommended agents are missing, ask the user whether to create them. If they agree, use the `agent-creator` skill.
8. Check Symphony runtime:
   - Symphony must live in the VibeRig plugin, not in the target business project.
   - Ensure project commands exist at `.vibeRig/bin/viberig`, `.vibeRig/bin/symphony-setup`, `.vibeRig/bin/symphony-planning`, and `.vibeRig/bin/symphony-implementation`.
   - If `vendor/symphony/elixir/bin/symphony` exists under the plugin root, report it as available.
   - If plugin `vendor/symphony` is empty or uninitialized, tell the user to initialize the VibeRig plugin submodule before running the daemon.
   - Do not add `openai/symphony` as a target-project submodule.
9. Ensure the global VibeRig service:
   - The global panel uses fixed local URL `http://127.0.0.1:49160`.
   - Run `scripts/viberig_service.py ensure --install-autostart` unless the user explicitly opts out.
   - Register the current project with `scripts/viberig_service.py register <project-root>`.
   - If the daemon is already running, do not start a duplicate; just register or update the project.
   - Do not ask the user to manage Symphony runner ports. Runner ports are internal state under `~/.viberig/runtime/runners/`.
10. Check optional context-mode support:
   - Prefer this Codex plugin marketplace install path:
     `codex plugin marketplace add mksglu/context-mode`
   - Do not default to `npm install -g context-mode`.
   - If Codex reports another required install/enable step, report that step.
   - If context-mode is unavailable, keep VibeRig initialized and record the degraded state in `.vibeRig/context-mode.md`.
11. Do not start Symphony runners automatically unless the user asks or starts them from the global panel. Running `.vibeRig/bin/symphony-setup` is allowed during explicit full initialization because it builds the plugin runtime but does not start issue execution.

## Port Rules

- Avoid common app ports such as `3000`, `5173`, `8000`, and `8080`.
- The global VibeRig panel uses fixed port `49160`.
- If `49160` is occupied by a non-VibeRig process, report the conflict instead of choosing another user-facing port.
- Symphony runner ports are internal and managed by the global service. Do not surface them as normal user workflow.
- Preview servers still use high ports from `.vibeRig/config.yaml`, starting at `49200`.

## Context-Mode Rules

- context-mode is an optional evidence source for post-acceptance insights.
- Use the Codex plugin marketplace route: `codex plugin marketplace add mksglu/context-mode`.
- Do not vendor, submodule, clone, or build context-mode inside VibeRig.
- Do not use npm global install as the default setup path.
- If context-mode MCP tools are unavailable, VibeRig must still support `brainstorm`, `write-plan`, and Symphony workflow generation.
- Use `.vibeRig/context-mode.md` for local setup status. This file is local runtime state and should be ignored by git.

## Insights Rules

- Initialize `.vibeRig/insights/candidates.md` and `.vibeRig/insights/confirmed.md`.
- During active implementation, agents may read confirmed learnings but must not create new learnings.
- New learning candidates are generated only after Symphony validation, acceptance review, and code review pass.
- Only low-risk high-confidence project notes may be auto-applied. Workflow rules, skill updates, and user preferences require confirmation.

## Agent Creation Rules

When creating agents with `agent-creator`:

- Use project-level `.codex/agents/` by default.
- Analysis, research, planning, QA, review, and integration agents should be `read-only` unless they need to run local commands that write caches.
- Implementation agents should be created at runtime for the task domain, such as frontend, backend, DevOps, or data work, and should use `workspace-write` only when expected to edit project files.
- Put role boundaries, inputs, outputs, stop conditions, and escalation conditions in `developer_instructions`.
- Do not add custom TOML fields outside the official Codex custom agent schema.
