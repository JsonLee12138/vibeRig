---
name: write-plan
description: Compile VibeRig brainstorm outputs into plan.md and tasks.yaml. Use after brainstorm has produced requirement.md, acceptance.md, roadmap.md, and spec.md, with research.md optional, or when the user asks to split a VibeRig requirement into local execution tasks, Linear child issue drafts, worktree branches, validation commands, and subagent assignments.
---

# Write Plan

Use this skill after `brainstorm` has produced the planning-ready requirement documents. `research.md` is useful context but is not required when `requirement.md`, `acceptance.md`, `roadmap.md`, and `spec.md` are present.

## Input Contract

Resolve a requirement directory under:

```text
.vibeRig/requirements/<requirement-name>/
```

Required inputs:

- `requirement.md`
- `acceptance.md`
- `roadmap.md`
- `spec.md`

Optional inputs:

- `research.md`
- `acceptance-human.md`

Do not generate missing brainstorm documents in this skill. If any required file is missing, stop and tell the user which `brainstorm` phase must run first. If only `research.md` is missing, continue and treat `roadmap.md`, `spec.md`, and `acceptance.md` as the approved technical direction; record any research-gap risk in `plan.md` only when it materially affects task confidence.

## Output Contract

Write:

```text
.vibeRig/requirements/<requirement-name>/
├── plan.md
└── tasks.yaml
```

`plan.md` is the human-readable execution plan. `tasks.yaml` is the machine contract for the VibeRig local task engine, optional Linear exports, worktrees, and subagents.

## Workflow

1. Resolve the VibeRig root and requirement directory.
2. Read all required brainstorm files, optional `research.md` and `acceptance-human.md` when present, and `.vibeRig/config.yaml` if it exists.
3. Check for contradictions:
   - requirement points that are not represented in acceptance, roadmap, or spec
   - acceptance criteria that are not represented in spec or roadmap
   - roadmap tasks that are not testable
   - spec changes that exceed stated goals or non-goals
   - manual acceptance points that cannot be mapped to a task, task group, or final integration check
   - research findings that conflict with roadmap or spec when `research.md` exists
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
- If `acceptance-human.md` exists, referenced IDs must also appear there in the same human-facing order.
- `acceptance_refs` must include manual acceptance IDs when the task requires human verification.
- `validation` must include executable commands or explicit manual acceptance items, and manual items must cite the related acceptance ID.
- `branch` should use `viberig/<requirement-id>-<task-id>`.
- `worktree_hint` should use `./worktrees/<requirement-id>-<task-id>`.
- `base_policy.default_base` should default to `origin/main`.
- `base_policy.require_fetch_before_worktree`, `require_base_sha_record`, and `require_sync_before_pr` should be true.

## Local Execution Fit

Plan for VibeRig's local task and acceptance flow:

- `tasks.yaml` is imported into the global VibeRig panel.
- Each task maps to a branch, a worktree, validation commands, acceptance checks, manual checks when needed, and review ownership.
- Optional Linear child issue drafts should mirror the local task contract instead of becoming the source of truth.

## Acceptance Mapping

`brainstorm` defines stable automated and manual acceptance IDs in `acceptance.md`; `write-plan` maps them to executable tasks.

For every task:

- Include the relevant automated and manual IDs in `acceptance_refs`.
- Put runnable checks in `validation` as commands.
- Put manual checks in `validation` as explicit strings prefixed with the acceptance ID, for example `[AC-M1] Manual: verify keyboard focus order in the browser and capture notes`.
- Use `plan.md` to show the human-readable Task -> Acceptance -> Manual Check mapping.
- If a manual check only makes sense after multiple tasks are complete, assign it to the integration task or note the dependency in `plan.md`.
