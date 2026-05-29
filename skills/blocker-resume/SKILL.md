---
name: blocker-resume
description: Use when a VibeRig task is blocked and the agent should inspect the blocker, run log, Codex session, transcript, diff, or evidence, then either resume the blocked run through the existing session or rerun the task through VibeRig MCP.
---

# Blocker Resume

Use this workflow when a VibeRig task is in `blocked` state and the user wants AI-assisted recovery instead of manual-only inspection.

## ID Lookup Modes

The user may provide any of these ids. Resolve the full blocker context before deciding whether to resume or rerun.

- `project_id` + `requirement_id` + `task_id`: call `viberig.tasks.get`, then use the latest blocked run from `runs`.
- `run_id`: call `viberig.runs.get`, then read the run log, events, artifacts, diff, and Codex session. Use the returned task/project/requirement ids to call `viberig.tasks.get`.
- `codex_session_id`: call `viberig.codex_sessions.get`, read transcript/events, then use the session's run id to call `viberig.runs.get` and task ids to call `viberig.tasks.get`.
- If only a human-facing task id is provided, first locate the active project and requirement from `viberig.projects.list`, `viberig.requirements.list`, and `viberig.board.get`.

For a full context read, gather:

- task detail, dependencies, acceptance items, evidence, manual reviews, and activity
- latest blocked run metadata
- run log, run events, artifacts, and diff
- Codex session metadata, transcript, and events

## Workflow

1. Identify the task:
   - If project, requirement, task, run, or session id is provided, resolve it using the ID Lookup Modes above.
   - If project, requirement, or task id is missing, read projects, requirements, and board data until the task is uniquely identified.
   - Confirm the task status is `blocked`.
2. Inspect the blocker:
   - Read `viberig.tasks.get`.
   - Read the latest run with `viberig.runs.get`.
   - Read the run log with `viberig.runs.get_log`.
   - Read run events, artifacts, diff, and Codex session transcript when they exist.
3. Decide the action:
   - Use continue-after-fix when the current worktree and previous Codex session are still useful, such as missing user input, credentials now provided, or a small correction is needed.
   - Use rerun when the previous run is stale, worktree setup is bad, the wrong branch/base was used, or the task definition changed.
4. Execute through MCP:
   - Continue after fix: call `viberig.tasks.continue_after_fix` with `project_id`, `requirement_id`, `task_id`, and a concise `comment` describing what was fixed or what should be checked. The backend first runs an AI resume preflight. Only if that preflight approves continuing does the backend move the task to `running` and resume the previous Codex session.
   - Rerun: call `viberig.tasks.rerun` with `project_id`, `requirement_id`, `task_id`, and a `reason`.
   - For a known run id, `viberig.runs.continue_after_fix` may be used instead of task-level continue-after-fix.
5. Report:
   - State whether you resumed or reran.
   - Include run id, reused Codex session id if resumed, and the next place to inspect logs.
   - Do not mark acceptance or final review yourself.

## Guardrails

- Do not edit `.vibeRig/` files, SQLite files, or generated evidence files to change state.
- Do not call raw task status updates to move a blocked task to `running`; use `viberig.tasks.continue_after_fix`.
- Continue-after-fix keeps the task `blocked` during AI preflight, then moves it to `running` only after the backend approves the resume path and continues the existing session id. It is not a fresh run.
- Rerun moves the task back through `ready` with a reason and creates a new run.
