---
name: vb-init
description: Initialize a target project for the Linear-native VibeRig workflow. Use when the user asks to set up VibeRig in a project, create .vibeRig project registration, configure local Docs as Code under .vibeRig/requirements, connect the project to Linear, record CI/gate policy, prepare project-level subagent routing, or build the agent team for the project.
---

# VB Init

Use this skill to prepare a project for the Linear-native VibeRig workflow, including building the agent team that will execute the workflow.

VibeRig is a Codex plugin protocol, not a local dashboard or local task engine. The source of truth is split deliberately:

- Local `.vibeRig/requirements/`: versioned requirement, contract, architecture, acceptance, validation, and Mermaid documents.
- Local `.vibeRig/project.yaml`: machine-readable project registration, workflow policy, and project output language.
- Linear Project, issues, sub-issues, and comments: task state, ownership, execution status, acceptance conclusion, and proof packets.
- Codex main agent: subagent routing, validation, and Linear updates.
- Git worktrees: isolated task execution directories under the project `.worktrees/` root.

## Contract

Use this skill to initialize or reconcile one project for the Linear-native VibeRig workflow, then build the project's agent team using `agent-creator`.

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
- Whether to build the agent team now. Default to yes. Team includes: `researcher`, `implementation`, `qa`, `code_review`, `security_auditor`, `test_engineer`, `integrator`. Skip agents that already exist under `.codex/agents/`.
- Project technology stack or domain context (e.g., "React + Node.js", "data pipeline", "mobile app"). Used by `agent-creator` to tailor agent instructions.

## Output Contract

Create or update:

```text
<project-root>/
├── AGENTS.md
├── .vibeRig/
│   ├── project.yaml
│   └── requirements/
├── .agents/
│   └── skills/
│       ├── insights/        # pre-installed for self_learner
│       ├── skill-builder/   # pre-installed for self_learner
│       └── skillos-lite/    # pre-installed for self_learner
├── .claude/
│   └── skills -> ../.agents/skills   # symlink
├── .codex/
│   └── agents/
│       ├── researcher.toml
│       ├── implementation.toml
│       ├── qa.toml
│       ├── code_review.toml
│       ├── security_auditor.toml
│       ├── test_engineer.toml
│       ├── integrator.toml
│       └── self_learner.toml
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
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `.vibeRig/project.yaml` through `vb-init`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing external labels/status names.
```

## Required Project YAML

`.vibeRig/project.yaml` is the machine-readable registration file. Read [references/project-config-template.md](./references/project-config-template.md) before writing the file and use it as the authoritative field set.

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
3a. **Skills directory and symlink setup** — run once per project init:
    ```bash
    mkdir -p .agents/skills
    # Create .claude/skills as a symlink to .agents/skills if not already linked
    if [ ! -L .claude/skills ]; then
      mkdir -p .claude
      ln -s ../.agents/skills .claude/skills
    fi
    ```
3b. **Pre-install self_learner dependencies** — install `insights`, `skill-builder`, and `skillos-lite` at project level using `find-skills`. These are required by the `self_learner` agent and must be present before any accept-phase self-learning can run:
    - Invoke `find-skills` with skill name `insights`; install result to project `.claude/skills/`.
    - Invoke `find-skills` with skill name `skill-builder`; install result to project `.claude/skills/`.
    - Invoke `find-skills` with skill name `skillos-lite`; install result to project `.claude/skills/`.
    - If a skill is not found, log the gap in the init report — do not abort init.
    - Never install globally; project-level only.
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
9. **Team Building** — build the agent team using `agent-creator`. This step runs after Linear registration and local file setup.
   - Scan `.codex/agents/` for existing agents. Skip any that already have a valid TOML file.
   - For each missing agent in the standard VibeRig team, invoke `agent-creator` with the project's technology stack and domain context:

     | Agent name | Responsibility | sandbox_mode |
     |---|---|---|
     | `researcher` | Research and exploration; read-only analysis | `read-only` |
     | `implementation` | Code editing, feature implementation | `workspace-write` |
     | `qa` | Test design, QA verification, regression checks | `workspace-write` |
     | `code_review` | Code quality, style, correctness review | `read-only` |
     | `security_auditor` | Security analysis, vulnerability scanning | `read-only` |
     | `test_engineer` | Test file authoring, coverage analysis | `workspace-write` |
     | `integrator` | Cross-module integration, merge coordination | `workspace-write` |
     | `self_learner` | Post-accept self-learning: extract lessons, update skills, record insights | `workspace-write` |

   - Tailor each agent's `developer_instructions` to the project stack/domain. For example, a React project's `code_review` agent gets JSX/TypeScript-specific guidance.
   - After creating all agents, update `.vibeRig/project.yaml` `subagents` section with the resolved agent names.
   - If `agent-creator` is unavailable, report that team building was skipped and list which agents are missing.

10. Report the project YAML path, AGENTS.md path/status, docs root, output language, Linear Project id/status, Linear Project Document id/status, gate policy, and agent team status (created / already existed / skipped).

## Red Flags

- `.vibeRig/project.yaml` was created without Linear registration (when Linear tools are available) → report partial initialization; do not claim complete registration.
- `_save_project` was called before checking for existing projects with `_search` or `_list_projects` → duplicate Linear projects corrupt the registration; search first.
- The inline YAML template in this file was edited to fix a field rather than updating `references/project-config-template.md` → the canonical template is the reference file; keep them in sync.
- `AGENTS.md` was not updated to include the VibeRig output language rule → downstream skills cannot reliably infer `output.language` without it.
- Team building was skipped without user consent and no existing agents were found → the project has no subagent team; report which agents are missing and offer to create them.
- `agent-creator` was called without providing the project stack/domain context → agents get generic instructions that won't fit the project; always pass stack context.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "Linear registration failed, but the local files are done so I'll call it complete" | Registration is complete only when both local files and Linear (Project + Project Document) are reconciled. Partial initialization must be reported as partial. |
| "I'll create the Linear project now and search for existing ones later" | Creating duplicates requires manual Linear cleanup. Search first, create only when no match exists. |
| "The `output.language` field is optional, I'll skip it if the user doesn't mention it" | Missing `output.language` causes downstream skills to fall back to inference, which can produce mixed-language records in Linear. Set it explicitly — ask once if ambiguous. |
| "The agents can be created later when we actually need them" | An agent team that is absent at init time means the first task execution must block on setup. Build the team during init so the project is immediately executable. |
| "Generic agent instructions are fine, I don't know the stack yet" | Read the project's `package.json`, `go.mod`, `Cargo.toml`, or framework imports before calling `agent-creator`. Pass the stack — the agent instructions will be permanently better for it. |

## Validation

```bash
# Confirm local files exist
ls .vibeRig/project.yaml .vibeRig/requirements/ .worktrees/ AGENTS.md 2>&1

# Confirm output.language is set
grep "output:" .vibeRig/project.yaml && grep "language:" .vibeRig/project.yaml

# Confirm .agents/skills/ directory exists and .claude/skills is a symlink to it
ls -la .claude/skills && test -L .claude/skills && echo "symlink ok" || echo "symlink missing"

# Confirm self_learner dependencies are pre-installed at project level
ls .agents/skills/insights/ .agents/skills/skill-builder/ .agents/skills/skillos-lite/ 2>&1

# Confirm agent team exists (including self_learner)
ls .codex/agents/*.toml 2>&1

# Confirm no invalid fields in any agent TOML
grep -En "^\[skills\]|^recommended_skills|^scope\s*=|^inputs\s*=|^outputs\s*=|^boundaries" .codex/agents/*.toml && echo "INVALID FIELDS FOUND" || echo "agents ok"
```

- [ ] `.vibeRig/project.yaml` exists and has project, docs, output, workspace, pull request, Linear, gate policy, and subagent sections.
- [ ] `output.language` is a BCP 47-style tag (`zh-CN`, `en-US`).
- [ ] Root `AGENTS.md` includes the VibeRig output language rule.
- [ ] `.vibeRig/requirements/` exists.
- [ ] Linear Project and Project Document were reconciled, or partial initialization is explicitly reported.
- [ ] `.vibeRig/project.yaml` records resolved Linear ids after successful registration.
- [ ] `.agents/skills/` directory exists.
- [ ] `.claude/skills` is a symlink pointing to `../.agents/skills`.
- [ ] `insights`, `skill-builder`, and `skillos-lite` are installed under `.agents/skills/`, or missing ones are reported.
- [ ] `.codex/agents/` contains TOML files for all standard VibeRig agents (including `self_learner`), or missing agents are explicitly reported.
- [ ] Each agent TOML has one clear `Mission`, a `Scope` with `Not allowed:` list, and an `Output` section.
- [ ] `.vibeRig/project.yaml` `subagents` section reflects the actual agent names created.

Report partial initialization when only local files were created. Report partial team when some agents already existed and were skipped.

## Hard Rules

- Do not start or register a local VibeRig dashboard.
- Do not call `api/server.py ensure`, `api/server.py register`, or any local daemon route.
- Do not configure `codex-cli-mcp`, `runner.codex`, or shell-based Codex execution.
- Do not add VibeRig MCP settings to `.codex/config.toml`.
- Do not generate `tasks.yaml`.
- Do not make CI mandatory for all projects. Record the target project's chosen gate policy instead.
- Do not report initialization as complete if Linear tools were available but `_save_project` or `_save_document` was skipped.
- Subagents must not update Linear or make final acceptance decisions.
