---
name: task-runner
description: >
  Use when the user asks Codex to execute, continue, resume, or pick the next
  VibeRig task or requirement from the current chat. This is a foreground runner
  skill: Codex itself performs the work in the current session, follows agent-sop
  for staged delivery, and uses VibeRig MCP only to read task state and
  synchronize dashboard-visible task, run, evidence, acceptance, and review
  status. Do not use the backend automatic runner.
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

## Inputs

Resolve these before acting:

- project id
- requirement id
- task id, or a requirement whose next task should be selected

If ids are missing, infer them from the current workspace, current VibeRig project, current requirement context, or task files. If multiple plausible projects or requirements exist, list the ambiguity briefly and ask for the missing id.

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

## Foreground Run Lifecycle

After choosing an actionable task:

1. Read the task detail with `viberig.tasks.get`.
2. Create dashboard bookkeeping with `viberig.runs.create`.
3. Move the task to `running` with `viberig.tasks.update_status`.
4. Append a `preflight` run event that names the selected task, the reason it was selected, and the intended validation approach.
5. Load `agent-sop` if it has not already been loaded this turn, then execute the task through that protocol.

Use the run id from `viberig.runs.create` for all later run events and finalization.

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

- Success: record validation and self-acceptance evidence, move the task to `human_review`, then call `viberig.runs.finish` with `status: "success"`.
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
