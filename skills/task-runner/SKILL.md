---
name: task-runner
description: >
  Use when the user asks Codex to execute, continue, resume, pick the next task,
  or run an entire VibeRig requirement from the current chat. This is a
  foreground runner skill: Codex itself performs the work in the current session,
  follows agent-sop for staged delivery, uses real git worktrees for execution
  isolation, and uses VibeRig MCP only to read task state and synchronize
  dashboard-visible task, run, evidence, acceptance, and review status. Do not
  use the backend automatic runner.
---

# Task Runner

## Contract

Use this skill as a VibeRig foreground execution wrapper around `agent-sop`.

Codex remains the main agent and executes the task in the current chat. Load and follow `agent-sop` for scope analysis, test decisions, implementation, validation, QA review, and evidence-based rework. This skill only adds VibeRig task selection and MCP status synchronization.

The main agent owns all VibeRig MCP writes. Subagents may inspect code, implement bounded changes, write tests, review, or return evidence, but they must not mutate VibeRig task, run, acceptance, evidence, or review state.

## Hard Rules

- Do not call backend automatic execution, resume, rerun, or continue tools or HTTP routes, including `viberig.runs.execute_ready_task`, `viberig.tasks.continue_after_fix`, `viberig.tasks.resume_blocked`, `viberig.tasks.rerun`, `viberig.runs.continue_after_fix`, `viberig.runs.resume`, `POST /api/runs/execute_ready_task`, or `POST /api/tasks/<task_id>/runs`.
- Do not ask the backend to run Codex. The current Codex session performs the work directly.
- `viberig.runs.create` is allowed only as dashboard bookkeeping for the current foreground run. It must not be treated as permission for the backend to execute anything.
- Do not edit `.vibeRig/` files, SQLite files, or generated dashboard runtime state to update status. Use VibeRig MCP.
- Do not mark acceptance items passed unless there is concrete implementation and validation evidence.
- Do not move a task to `accepted`; foreground Codex stops at `human_review` unless a human explicitly performs manual acceptance.
- If VibeRig MCP is unavailable, continue only with explicit user consent and report that dashboard synchronization is degraded.
- Execution workspaces must be real git worktrees. Do not treat a normal branch checkout inside the main project checkout as a worktree substitute.
- In requirement-run mode, use one requirement-level worktree for the whole requirement. Do not create one worktree per task.
- Every successfully completed task must produce a git commit in the execution worktree before moving to the next task or reporting requirement-run completion.

## Project Registration Preflight

This preflight is mandatory before any requirement, board, task, run, evidence, or acceptance tool call. Do not skip it just because a requirement id or task id was provided.

1. Determine the intended project root. Prefer the current workspace or git root unless the user provided a project path.
2. Call `viberig.projects.list`.
3. Normalize project roots to absolute paths and match the intended project root against registered `project_root` values. Require an exact path match after symlink and `..` normalization; do not pick a different project just because it is the only registered project.
4. If no registered project matches, immediately call `viberig.projects.register` with the intended absolute `project_root`. Include `project_name` when it can be inferred safely from the directory name or user input.
5. After registering, call `viberig.projects.list` again and verify the intended `project_root` is now present. If it is still absent, treat registration as failed, report the returned register payload, and stop before task selection.
6. Call `viberig.projects.refresh` when available so dashboard-visible requirements and tasks are synchronized before task selection.
7. Use the matched or newly registered project id for the rest of the task-runner flow.

If VibeRig MCP is unavailable, stop before task selection and ask whether to continue without dashboard synchronization. If multiple registered projects plausibly match the workspace, list the ambiguity briefly and ask for the intended project id.

## Inputs

Resolve these before acting:

- project id
- requirement id
- task id, or a requirement whose next task should be selected
- execution mode: single-task mode or requirement-run mode

If ids are missing, infer them from the current workspace, current VibeRig project, current requirement context, or task files. If multiple plausible projects or requirements exist, list the ambiguity briefly and ask for the missing id.

## Execution Mode

Choose the mode from the user's intent before selecting work:

- Single-task mode: use when the user names a task, asks for the next task, asks to continue one blocked or failed task, or otherwise expects one task to be implemented.
- Requirement-run mode: use when the user asks to run, finish, execute, or complete the whole requirement, all ready tasks in a requirement, or the requirement end to end.

In single-task mode, run exactly one actionable task and stop after its final state is synchronized.

In requirement-run mode:

1. Resolve the requirement once and prepare one requirement-level worktree.
2. Repeatedly select the next actionable task from the same requirement.
3. For each task, create its own VibeRig run, status updates, events, evidence, acceptance updates, validation, and final task state.
4. After each successful task, commit that task's completed changes in the requirement worktree before selecting the next task.
5. Stop when there are no actionable tasks, a task fails, a task is blocked, validation cannot be completed, or the user interrupts.
6. Report the aggregate requirement result, including every task attempted, each run id, each commit sha, validation status, and any remaining blocked or waiting tasks.

Requirement-run mode still respects task dependencies, readiness, and human review boundaries. Tasks that reach `human_review` are complete for foreground execution, but they are not accepted until a human review records acceptance.

## Task Selection

When the user gives a task id:

1. Read it with `viberig.tasks.get`.
2. Confirm the task belongs to the intended project and requirement.
3. Continue only if the task is actionable.

When the user gives a requirement:

1. Read the board with `viberig.board.get`.
2. Choose the next actionable task by dependency readiness first, then explicit ordering, then priority.
3. Skip `accepted` and `canceled` tasks.
4. Treat `human_review` and `self_accepted` tasks as waiting for review, not implementation work.
5. Treat `blocked` or `failed` tasks as rework only when the user asked to continue, resume, or fix them.
6. Prefer `ready` tasks. Only move `draft` to `ready` when dependencies are satisfied and the transition succeeds.

If no task is actionable, report the requirement state and the blocking reason.

## Git Worktree and Commit Discipline

Prepare execution isolation before implementation, after project and requirement resolution:

1. Resolve the git root and base ref. Prefer task or requirement metadata when present; otherwise use the project's configured VibeRig base ref, then `origin/main`, then the current branch only when no remote base is available.
2. Choose the branch and worktree path:
   - Single-task mode: prefer the task's `branch` and `worktree_hint`; otherwise use `viberig/<requirement-id>-<task-id>` and `./worktrees/<requirement-id>-<task-id>`.
   - Requirement-run mode: prefer an existing requirement-level branch or worktree hint if present; otherwise use `viberig/<requirement-id>` and `./worktrees/<requirement-id>`.
3. Fetch the base ref when a remote base is used.
4. Create or reuse a real git worktree with `git worktree add`. If the branch already exists, attach the worktree to that branch. If the worktree already exists, verify it points at the intended branch before reusing it.
5. Verify the execution path appears in `git worktree list --porcelain` as a `worktree` entry. If not, stop and fix the workspace setup before changing files.
6. Run implementation, tests, validation, diff inspection, and commits from the execution worktree, not from the main checkout.
7. Inspect `git status --short` before each task. If unrelated existing changes are present, do not overwrite them; either work around them or ask the user how to proceed.

Commit rules:

- Commit only after task validation and self-acceptance evidence support completion.
- Make one commit per successfully completed task, even in requirement-run mode where all tasks share the same requirement worktree.
- Keep each commit scoped to the just-completed task. Do not mix pending work for later tasks into the commit.
- Use a traceable message such as `viberig(<requirement-id>): complete <task-id>` and include the run id, validation commands, and key evidence in the commit body when practical.
- Record the commit sha in VibeRig evidence or a run event.
- If a task is genuinely complete with no file changes, create an explicit empty commit only after recording why no file changes were expected.
- Do not commit `.vibeRig/` runtime files, SQLite files, generated dashboard runtime state, or unrelated user changes.

## Foreground Run Lifecycle

After choosing an actionable task:

1. Read the task detail with `viberig.tasks.get`.
2. Create dashboard bookkeeping with `viberig.runs.create`.
3. Move the task to `running` with `viberig.tasks.update_status`.
4. Append a `preflight` run event that names the selected task, the reason it was selected, and the intended validation approach.
5. Load `agent-sop` if it has not already been loaded this turn, then execute the task through that protocol from the prepared execution worktree.

Use the run id from `viberig.runs.create` for all later run events and finalization.

In requirement-run mode, repeat this lifecycle independently for every selected task in the same requirement worktree. Do not reuse a previous task's run id for a later task.

## Stage Sync Points

At each stage boundary, the main agent appends a VibeRig run event:

- `preflight`: task, scope, dependencies, acceptance refs, and test decision.
- `development`: implementation start, important design decisions, and implementation completion.
- `test_authoring`: tests added, tests changed, or why no focused test is appropriate.
- `validating`: validation commands, results, failures, and manual validation notes.
- `self_acceptance`: evidence summary and acceptance criteria coverage.
- `acceptance_review`: review verdict, residual risks, and whether human review is needed.

If `viberig.runs.update_progress` exists, call it at these same boundaries to update `implementation_status`. If it does not exist, use `viberig.runs.append_event` only.

## Evidence Sync

Record durable evidence with `viberig.evidence.record` when useful evidence exists, especially:

- validation command results
- focused test coverage summary
- changed-file summary or diff artifact path
- self-acceptance notes
- screenshots, logs, or manual verification notes

Keep evidence summaries short and factual. Prefer file paths for durable artifacts when they already exist. Do not create noisy evidence files just to satisfy this skill.

## Acceptance Sync

Use `viberig.acceptance.list` or the task detail to map task acceptance refs before self-acceptance.

For each linked acceptance item:

- mark `passed` only when implementation and validation evidence directly support it;
- mark `failed` when validation proves it is not met;
- mark `blocked` when external input, missing credentials, unavailable services, or unresolved product decisions prevent verification;
- leave `pending` when evidence is incomplete.

Do not use acceptance status as a substitute for human review.

## Final State

Finish every foreground run with one of these outcomes:

- Success: record validation, self-acceptance evidence, and commit sha; move the task to `human_review`; then call `viberig.runs.finish` with `status: "success"`.
- Validation failure: record failure evidence, move the task to `failed`, then call `viberig.runs.finish` with `status: "failed"`.
- Blocked: record the blocker, move the task to `blocked`, then call `viberig.runs.finish` with `status: "blocked"`.
- Canceled by user: move the task to `canceled` only when the user explicitly asks and a reason is provided, then finish or cancel the run if the MCP tool supports it.

The final response to the user should include the task id, final task status, run id, key evidence, validation result, and any required human review or rework.

## Error Handling

If a VibeRig MCP write fails:

1. Stop and read the current task/run state.
2. Retry only when the failure is transient or caused by stale local assumptions.
3. If the write still fails, do not continue mutating code unless the user explicitly accepts unsynchronized execution.

If implementation fails after the task is already `running`, try to record a `blocked` or `failed` run event and finish the run before reporting the blocker.
