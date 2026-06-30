---
name: vb-init
description: Initialize or reconcile a project for the VibeRig workflow. Use when the user asks to set up VibeRig, create .vibeRig project registration, connect to Linear, or wire the global ~/.vb-skills learned-skill store. Do not use to create requirements, tasks, or implementation branches.
---

# VB Init

Prepare a project for the Linear-native VibeRig workflow.

All steps are **idempotent** — re-running skips what already exists.

## Contract

Single responsibility: initialise or reconcile **one project** and its global skill store.

Do not create requirements, tasks, branches, or dashboards.

## Workflow

### Step 1 — Locate project root

Use current workspace or git root unless the user provides a path. Inspect existing `.vibeRig/project.yaml` and `.vibeRig/requirements/`.

### Step 2 — Global learned-skill store

Check and initialize `~/.vb-skills/` (idempotent):

```bash
# a. Create directory and init git repo if absent
if [ ! -d ~/.vb-skills ]; then
  mkdir -p ~/.vb-skills
  git init ~/.vb-skills
fi

# b. Create empty lock if absent
if [ ! -f ~/.vb-skills/vb-skill-lock.json ]; then
  printf '{\n  "version": 1,\n  "skills": {}\n}\n' > ~/.vb-skills/vb-skill-lock.json
  git -C ~/.vb-skills add vb-skill-lock.json
  git -C ~/.vb-skills commit -m "chore: init vb-skill-lock"
fi
```

Report as created or already exists.

### Step 3 — Project scaffolding

```bash
mkdir -p .vibeRig/requirements .worktrees
```

### Step 4 — project.yaml

Create or update `.vibeRig/project.yaml` from [references/project-config-template.md](./references/project-config-template.md).

Required fields: `output.language` (BCP 47), `workspace.worktrees_root`, pull request policy, gate policy, Linear ids.

Detect language in this order:
1. Existing `output.language` in `project.yaml` (if reconciling).
2. User's current working language in this session.
3. System locale (`$LANG` / `$LC_ALL`).
4. Default to `en` and note the fallback.

### Step 5 — Linear registration

When Linear tools are available:
- `_list_teams` / `_get_team` → confirm team.
- `_search` + `_list_projects` → find existing project (search before creating).
- `_save_project` → create only if none found.
- `_list_documents` + `_save_document` → create/update Project Document.
- Write resolved Linear ids to `project.yaml`.

Report as **partial** when Linear tools are unavailable; do not claim full registration.

### Step 6 — Agent team (update-team)

Call the `update-team` skill to analyze `.vibeRig/requirements/` and any open Linear issues, infer the project's required agent roles, and update `project.yaml` `subagents` section.

Baseline agents (`code_review`, `gemini_research`, `integrator`, `qa`, `researcher`, `security_auditor`, `self_learner`, `test_engineer`, `uiux_design`) are shipped with the plugin — no installation step needed.

### Step 7 — Report

```
VB Init Summary
───────────────────────────────────────
Global store:    ~/.vb-skills/          [created | already exists]
Project yaml:    .vibeRig/project.yaml  [created | updated]
Linear:          <project-name>         [registered | partial | skipped]
Agent team:      <n> roles confirmed    [via update-team]
Output language: <language>             [from project.yaml | system | default]
───────────────────────────────────────
```

## Validation

```bash
ls .vibeRig/project.yaml .vibeRig/requirements/ .worktrees/
grep "language:" .vibeRig/project.yaml
git -C ~/.vb-skills rev-parse --git-dir && echo "vb-skills git ok"
ls ~/.vb-skills/vb-skill-lock.json
```

## Hard Rules

- Do not report full initialization when Linear tools were available but registration was skipped.
- Do not make CI mandatory for all projects — record the project's own gate policy.
- Stop and ask when the Linear team/project choice cannot be inferred safely.
