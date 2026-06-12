---
name: init-viberig
description: Initialize a target project for the Linear-native VibeRig workflow. Use when the user asks to set up VibeRig in a project, create .vibeRig project registration, configure local Docs as Code under .vibeRig/requirements, connect the project to Linear, record CI/gate policy, or prepare project-level subagent routing.
---

# Init VibeRig

Use this skill to prepare a project for the Linear-native VibeRig workflow.

VibeRig is a Codex plugin protocol, not a local dashboard or local task engine. The source of truth is split deliberately:

- Local `.vibeRig/requirements/`: versioned requirement, contract, architecture, acceptance, validation, and Mermaid documents.
- Local `.vibeRig/project.yaml`: machine-readable project registration, workflow policy, and project output language.
- Linear Project, issues, sub-issues, and comments: task state, ownership, execution status, acceptance conclusion, and proof packets.
- Codex main agent: context summary, subagent routing, validation, and Linear updates.
- Git worktrees: isolated task execution directories under the project `.worktrees/` root.

## Contract

Use this skill to initialize or reconcile one project for the Linear-native VibeRig workflow.

Do not use this skill to create requirements, Linear execution tasks, implementation branches, local dashboards, or backend runners. Use `brainstorm`, `write-plan`, and `task-runner` for those later phases.

Stop and ask when the target project, Linear team/project choice, or permission to create Linear artifacts cannot be inferred safely.

## Input Contract

- Target project directory. Default to the current workspace or git root.
- Project name. Default to the target directory name.
- Linear team and project. Prefer existing `.vibeRig/project.yaml`; otherwise ask the user or use Linear search when available.
- Linear Project Document title or id. Use it for human-readable registration notes.
- Docs root. Default to `.vibeRig/requirements`.
- Output language for human-readable records. Prefer existing `.vibeRig/project.yaml`; otherwise infer from the user's current working language or ask when ambiguous.
- Worktrees root. Default to `.worktrees`.
- Pull request policy. Default to required, provider auto-detected, and base branch inferred from the repository.
- Gate policy for the target project: test/build/lint/manual gates and whether CI is required.
- Default subagent routing for research, planning, implementation, QA, review, and integration.

## Output Contract

Create or update:

```text
<project-root>/
├── AGENTS.md
├── .vibeRig/
│   ├── project.yaml
│   └── requirements/
└── .worktrees/
```

Do not create a local dashboard registration, local task database, `.vibeRig/bin/viberig`, or Codex CLI/MCP runner config.

## Required Project AGENTS.md

Create or update the target project's root `AGENTS.md` with a VibeRig output language rule. Preserve existing project-specific rules and append or reconcile only the VibeRig section.

Required rule:

```markdown
## VibeRig Output Language

- Read `.vibeRig/project.yaml` before creating or updating VibeRig human-facing records.
- Use `.vibeRig/project.yaml` `output.language` for VibeRig issue titles, issue descriptions, comments, requirement documents, validation notes, proof packets, human acceptance records, retrospectives, and final summaries.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `.vibeRig/project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing external labels/status names.
```

## Required Project YAML

`.vibeRig/project.yaml` is the machine-readable registration file. The canonical template is `references/project-config-template.md`; read it before writing the file and keep the inline copy below in sync with it. It should contain only stable project policy and pointers:

```yaml
version: 1
project:
  name: "<project-name>"
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
  default_planning: "planner"
  default_implementation: "implementation"
  default_qa: "qa"
  default_review: "code_review"
  default_integration: "integrator"
context_mode:
  main_agent_only: true
```

## Linear Registration

Use the `linear` skill/plugin when it is available. The current Linear app exposes concrete create-or-update tools. Do not treat Linear registration as a follow-up note when tools are available.

If Linear tools are unavailable or unauthenticated, still create local `.vibeRig/project.yaml` and report the result as a partial local initialization. Do not claim project registration is complete until Linear Project and Project Document reconciliation has succeeded.

### Required Linear Tool Mapping

Use these Linear app tools through the `linear` skill/plugin:

- `_list_teams` and `_get_team`: find or confirm the target Linear team.
- `_search` with `type="project"` and `_list_projects`: find existing project candidates by repo URL, project name, project slug, or ids already recorded in `.vibeRig/project.yaml`.
- `_save_project`: create a missing Linear Project or update the matched Linear Project registration summary. Creating requires `name` and `addTeams` or `setTeams`.
- `_list_documents`: find an existing Linear Project Document for the project by title, project id/name, or registration keywords.
- `_save_document`: create or update the Linear Project Document. Creating requires `title` and `project`.

Do not substitute chat-only instructions for these tool calls when the Linear app tools are connected.

Registration rules:

1. Search for an existing Linear Project by repo URL, project name, project slug, or ids already recorded in `.vibeRig/project.yaml`.
2. If exactly one matching Linear Project exists, use it.
3. If none exists, create one only after the user confirms the target Linear team.
4. If multiple plausible projects exist, ask the user to choose.
5. Create or update a Linear Project Document for human-readable registration:
   - project purpose
   - repo path or URL
   - docs root `.vibeRig/requirements`
   - worktrees root `.worktrees`
   - output language for human-readable VibeRig records
   - pull request policy
   - gate policy summary
   - subagent routing summary
   - rule that local docs are contracts and Linear issues are tasks
6. Reconcile `.vibeRig/project.yaml` with Linear ids after registration.

Use both `.vibeRig/project.yaml` and the Linear Project Document. The YAML is for machines and repeatable initialization; the Linear document is for humans discovering the project inside Linear.

## Workflow

1. Locate the target project root. Prefer the current workspace or git root unless the user gives a path.
2. Inspect existing `AGENTS.md`, `.vibeRig/project.yaml`, `.vibeRig/config.yaml`, and `.vibeRig/requirements/` when present.
3. Create `.vibeRig/requirements/` and `.worktrees/` if missing.
4. Create or update `.vibeRig/project.yaml` using the required schema above, including `output.language`, `workspace.worktrees_root: ".worktrees"`, and the default pull request policy.
5. Create or update root `AGENTS.md` with the Required Project AGENTS.md VibeRig output language rule. Preserve unrelated project rules.
6. Resolve Linear registration using the `linear` skill/plugin when available:
   - call `_list_teams` or `_get_team` to confirm the team
   - call `_search` or `_list_projects` to find existing projects
   - call `_save_project` when no matching project exists or when the project summary needs reconciliation
7. Create or update the Linear Project Document with the registration explanation:
   - call `_list_documents` to find the registration document
   - call `_save_document` to create or update it under the Linear Project
8. Record the resolved Linear Project id/name, Linear Project Document id/title, target project's output language, pull request policy, and gate policy in `.vibeRig/project.yaml`.
9. Check whether recommended project-level subagents exist under `.codex/agents/` only if the user wants project-local agents. Missing agents are handled through `subagent-routing`; do not block initialization.
10. Report the project YAML path, AGENTS.md path/status, docs root, output language, Linear Project id/status, Linear Project Document id/status, and gate policy.

## Validation

Before reporting complete initialization, verify:

- `.vibeRig/project.yaml` exists and contains project, docs, output, workspace, pull request, Linear, gate policy, subagent, and context-mode sections.
- `.vibeRig/project.yaml` records `output.language` as a stable BCP 47-style language tag such as `zh-CN` or `en-US`.
- Root `AGENTS.md` exists and tells agents to use `.vibeRig/project.yaml` `output.language` for VibeRig human-facing records.
- `.vibeRig/requirements/` exists.
- `.worktrees/` exists or its absence is explained.
- Linear Project and Project Document were created, found, or explicitly skipped because tools/auth were unavailable.
- `.vibeRig/project.yaml` records resolved Linear ids after successful registration.

Report partial initialization when only local files were created.

## Hard Rules

- Do not start or register a local VibeRig dashboard.
- Do not call `api/server.py ensure`, `api/server.py register`, or any local daemon route.
- Do not configure `codex-cli-mcp`, `runner.codex`, or shell-based Codex execution.
- Do not add VibeRig MCP settings to `.codex/config.toml`.
- Do not generate `tasks.yaml`.
- Do not make CI mandatory for all projects. Record the target project's chosen gate policy instead.
- Do not report initialization as complete if Linear tools were available but `_save_project` or `_save_document` was skipped.
- Main agent may use context-mode for discovery and summarization. Subagents must not use context-mode.
