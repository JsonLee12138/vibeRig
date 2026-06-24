---
name: vb-init
description: Initialize or reconcile a project for the Linear-native VibeRig workflow. Use when the user asks to set up VibeRig, create .vibeRig project registration, connect to Linear, configure CI gates, set up the agent team, or wire the global ~/.vb-skills learned-skill store. Do not use to create requirements, tasks, or implementation branches.
---

# VB Init

Prepare a project for the Linear-native VibeRig workflow: local docs structure, `.vibeRig/project.yaml`, Linear registration, Codex agent team, and the global learned-skill store at `~/.vb-skills`.

All steps are **idempotent** — re-running skips what already exists.

## Contract

Single responsibility: initialise or reconcile **one project** and its global skill store. Stop and ask when the Linear team/project choice cannot be inferred safely.

Do not create requirements, tasks, branches, dashboards, or MCP runner config.

## Output

```text
<project-root>/
├── AGENTS.md                    (VibeRig inject block from assets/agents-md-inject.md)
├── .vibeRig/project.yaml        (see references/project-config-template.md)
├── .vibeRig/requirements/
├── .agents/skills/              (pre-installed: insights, skill-builder, skillos-lite)
├── .claude/skills  ->  ../.agents/skills
├── .codex/agents/*.toml         (full team including self_learner)
└── .worktrees/

~/.vb-skills/                    (global learned-skill git repo, one per machine)
├── .git/
└── vb-skill-lock.json

~/.agents/skills/vb  ->  ~/.vb-skills   (Codex discovery symlink)
```

## Workflow

### 1. Locate project root
Use current workspace or git root unless the user provides a path.
Inspect existing `AGENTS.md`, `.vibeRig/project.yaml`, and `.vibeRig/requirements/`.

### 2. Project scaffolding

```bash
mkdir -p .vibeRig/requirements .worktrees
mkdir -p .agents/skills
[ ! -L .claude/skills ] && { mkdir -p .claude; ln -s ../.agents/skills .claude/skills; }
```

Pre-install `insights`, `skill-builder`, `skillos-lite` at project level via `find-skills`.
Log missing skills in the init report; do not abort.

### 3. Global learned-skill store (idempotent)

```bash
# a. Init git repo
git -C ~/.vb-skills rev-parse --git-dir 2>/dev/null \
  || git init ~/.vb-skills

# b. Create empty lock if absent
if [ ! -f ~/.vb-skills/vb-skill-lock.json ]; then
  printf '{\n  "version": 1,\n  "skills": {}\n}\n' \
    > ~/.vb-skills/vb-skill-lock.json
  git -C ~/.vb-skills add vb-skill-lock.json
  git -C ~/.vb-skills commit -m "chore: init vb-skill-lock"
fi

# c. Codex discovery symlink — MUST be inside ~/.agents/skills/
mkdir -p ~/.agents/skills
[ ! -L ~/.agents/skills/vb ] \
  && ln -s ~/.vb-skills ~/.agents/skills/vb
```

> **Critical**: symlink must be `~/.agents/skills/vb → ~/.vb-skills`.
> `~/.agents/vb` (sibling of `skills/`) is outside Codex scan depth and will never be discovered.

### 4. project.yaml

Create or update `.vibeRig/project.yaml` from [references/project-config-template.md](./references/project-config-template.md).
Required fields: `output.language` (BCP 47), `workspace.worktrees_root`, pull request policy, gate policy, Linear ids.

### 5. AGENTS.md

Copy the inject block from [assets/agents-md-inject.md](./assets/agents-md-inject.md) between
`<!-- inject:viberig:start -->` and `<!-- inject:viberig:end -->` tags.
Preserve all unrelated project rules already in `AGENTS.md`.

### 6. Linear registration

When Linear tools are available:
- `_list_teams` / `_get_team` → confirm team.
- `_search` + `_list_projects` → find existing project (search before creating).
- `_save_project` → create only if none found.
- `_list_documents` + `_save_document` → create/update Project Document.
- Write resolved Linear ids to `project.yaml`.

Report as **partial** when Linear tools are unavailable; do not claim full registration.

### 7. Agent team

For each missing agent, invoke `agent-creator` with the project stack/domain:

| Agent | Responsibility | sandbox_mode |
|---|---|---|
| `researcher` | Research, read-only analysis | `read-only` |
| `implementation` | Feature implementation | `workspace-write` |
| `qa` | QA verification | `workspace-write` |
| `code_review` | Code quality, style | `read-only` |
| `security_auditor` | Vulnerability scanning | `read-only` |
| `test_engineer` | Test authoring | `workspace-write` |
| `integrator` | Cross-module integration | `workspace-write` |
| `self_learner` | Post-accept learning via `vb-learn` | `workspace-write` |

Skip agents that already have a valid TOML. Update `project.yaml` `subagents` section.

### 8. Report

Project YAML, AGENTS.md, docs root, output language, Linear Project/Document status,
gate policy, agent team (created / existed / skipped), global store status.

## Validation

```bash
# Local project
ls .vibeRig/project.yaml .vibeRig/requirements/ .worktrees/ AGENTS.md
grep "language:" .vibeRig/project.yaml
test -L .claude/skills && echo "symlink ok"
ls .agents/skills/insights/ .agents/skills/skill-builder/ .agents/skills/skillos-lite/
ls .codex/agents/*.toml

# Global learned-skill store
git -C ~/.vb-skills rev-parse --git-dir && echo "vb-skills git ok"
ls ~/.vb-skills/vb-skill-lock.json
test -L ~/.agents/skills/vb \
  && readlink ~/.agents/skills/vb | grep -q vb-skills \
  && echo "symlink ok" || echo "SYMLINK MISSING"
```

- [ ] `.vibeRig/project.yaml` has all required sections including `output.language`.
- [ ] Root `AGENTS.md` contains the VibeRig inject block.
- [ ] `.claude/skills` symlinks to `../.agents/skills`.
- [ ] `insights`, `skill-builder`, `skillos-lite` present in `.agents/skills/`.
- [ ] All standard agents present in `.codex/agents/` (or gaps reported).
- [ ] `~/.vb-skills` is a git repo with `vb-skill-lock.json`.
- [ ] `~/.agents/skills/vb` symlinks to `~/.vb-skills`.
- [ ] Linear registration complete, or partial explicitly reported.

## Hard Rules

- Do not add VibeRig MCP settings to `.codex/config.toml`.
- Do not start or register a local VibeRig dashboard.
- Do not place the Codex symlink at `~/.agents/vb` — it must be `~/.agents/skills/vb`.
- Do not report full initialization when Linear tools were available but registration was skipped.
- Do not make CI mandatory for all projects — record the project's own gate policy.
