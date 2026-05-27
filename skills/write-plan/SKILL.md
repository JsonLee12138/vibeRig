---
name: write-plan
description: Compile VibeRig brainstorm outputs into plan.md and tasks.yaml. Use after brainstorm has produced requirement.md, research.md, acceptance.md, roadmap.md, and spec.md, or when the user asks to split a VibeRig requirement into Symphony-ready child tasks, Linear child issues, worktree branches, validation commands, and subagent assignments.
---

# Write Plan

Use this skill after `brainstorm` has produced the five requirement documents.

## Input Contract

Resolve a requirement directory under:

```text
.vibeRig/requirements/<requirement-name>/
```

Required inputs:

- `requirement.md`
- `research.md`
- `acceptance.md`
- `roadmap.md`
- `spec.md`

Do not generate missing brainstorm documents in this skill. If any required file is missing, stop and tell the user which `brainstorm` phase must run first.

## Output Contract

Write:

```text
.vibeRig/requirements/<requirement-name>/
├── plan.md
└── tasks.yaml
```

`plan.md` is the human-readable execution plan. `tasks.yaml` is the machine contract for Symphony, Linear, and subagents.

## Workflow

1. Resolve the VibeRig root and requirement directory.
2. Read all five required brainstorm files and `.vibeRig/config.yaml` if it exists.
3. Check for contradictions:
   - acceptance criteria that are not represented in spec or roadmap
   - roadmap tasks that are not testable
   - spec changes that exceed stated goals or non-goals
4. If contradictions are material, stop and request a brainstorm update.
5. Draft task boundaries. Each task should map to one child issue, one branch, one worktree, and one PR or handoff.
6. Prefer different subagents for task splitting, implementation, acceptance, and code review.
7. If a needed subagent is missing, ask the user whether to create it with `agent-creator`. If declined, record the fallback risk in `plan.md`.
8. Write `plan.md` using `references/plan-template.md`.
9. Write `tasks.yaml` using `references/tasks-yaml-template.md`.
10. Validate `tasks.yaml` with `scripts/validate_tasks.py` when available.
11. Optionally render Linear child issue markdown with `scripts/render_linear_children.py`.

## Task Rules

- `depends_on` must make serial requirements explicit.
- `parallelizable` must be false when tasks are likely to collide on the same files or shared contracts.
- `scope.include` and `scope.exclude` must be specific enough for an implementation agent to obey.
- `acceptance_refs` must point to criteria in `acceptance.md`.
- `validation` must include executable commands or explicit manual acceptance items.
- `branch` should use `symphony/<requirement-id>-<task-id>`.
- `worktree_hint` should use `./worktrees/<requirement-id>-<task-id>`.
- `base_policy.default_base` should default to `origin/main`.
- `base_policy.require_fetch_before_worktree`, `require_base_sha_record`, and `require_sync_before_pr` should be true.

## Symphony Fit

Plan for two Symphony workflows:

- Planning daemon consumes parent issues in a planning state and produces brainstorm plus write-plan outputs.
- Implementation daemon consumes child issues and executes one task per worktree.

Child issue descriptions should include enough task contract content to run even if planning files are not merged yet.
