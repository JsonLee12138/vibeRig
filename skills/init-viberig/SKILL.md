---
name: init-viberig
description: Initialize a target project for VibeRig, Symphony, and optional context-mode usage. Use when the user asks to set up VibeRig in a project, create .vibeRig config, install workflow templates, configure worktrees, prepare high dashboard ports, configure accepted-work insights, or prepare project-level subagents for requirement planning and implementation.
---

# Init VibeRig

Use this skill to prepare a business project for the VibeRig workflow.

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
3. Ensure `.vibeRig/config.yaml` uses:
   - `worktrees.root: ./worktrees`
   - `worktrees.default_base: origin/main`
   - `worktrees.sync_before_pr: merge`
   - dashboard ports starting at planning `49170`, implementation `49180`
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
   - If `vendor/symphony/elixir/bin/symphony` exists, report it as available.
   - If `vendor/symphony` is empty or uninitialized, tell the user to initialize the submodule before running the daemon.
9. Check optional context-mode support:
   - Prefer this Codex plugin marketplace install path:
     `codex plugin marketplace add mksglu/context-mode`
   - Do not default to `npm install -g context-mode`.
   - If Codex reports another required install/enable step, report that step.
   - If context-mode is unavailable, keep VibeRig initialized and record the degraded state in `.vibeRig/context-mode.md`.
10. Do not start Symphony automatically unless the user asks.

## Port Rules

- Avoid common app ports such as `3000`, `5173`, `8000`, and `8080`.
- Use high starting ports from `.vibeRig/config.yaml`.
- Before starting a daemon or preview server, run `scripts/find_free_port.py <start-port>`.
- If the requested port is occupied, use the next free port and record it in `.vibeRig/runtime.json` or report it clearly.

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
