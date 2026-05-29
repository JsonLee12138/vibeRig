# VibeRig Native Task Engine Plan

## Source

This plan is derived from `docs/viberig-native-task-engine.md`.

## Objective

Build VibeRig into a local task and acceptance control plane. The default workflow must show requirement tasks, roadmap mapping, task status, validation evidence, self-acceptance, and human acceptance without depending on Linear, Lark, Obsidian, GitHub Issues, or external integrations.

## Delivery Principles

- Keep source-of-truth requirement files readable and versionable under `.vibeRig/`.
- Store volatile runtime state in `~/.viberig/viberig.sqlite`.
- Make manual board operation work before adding local runner automation.
- Treat external systems as optional export or mirror integrations only.
- Preserve runtime state when requirement files are re-imported.

## Phase 1: Local Control Database And Import

Goal: establish the runtime state layer and a repeatable import path from existing VibeRig artifacts.

Tasks:

1. Create the global VibeRig runtime home.
   - Create or reuse `~/.viberig/`.
   - Create `~/.viberig/viberig.sqlite`.
   - Create `~/.viberig/projects.json` only if a simple registry file is still needed beside SQLite.

2. Implement the minimum SQLite schema.
   - `projects`
   - `requirements`
   - `roadmap_items`
   - `tasks`
   - `task_dependencies`
   - `acceptance_items`
   - `task_acceptance_links`
   - `runs`
   - `evidence`
   - `manual_reviews`
   - `activity_events`
   - `source_revisions`

3. Implement project registration.
   - Register a local project root.
   - Resolve `.vibeRig/config.yaml` when present.
   - Record project status and timestamps.

4. Implement requirement import.
   - Parse `.vibeRig/requirements/<requirement_id>/tasks.yaml` as canonical task definition.
   - Parse `roadmap.md` and `acceptance.md` for display and linking.
   - Upsert stable records.
   - Preserve existing runtime status unless a task is deleted or materially changed.
   - Mark deleted tasks as `canceled` or `archived`.
   - Record SHA-256 hashes for `tasks.yaml`, `roadmap.md`, and `acceptance.md`.

Validation:

- A clean local project can be registered.
- A requirement can be imported into SQLite.
- Re-importing unchanged files is idempotent.
- Re-importing changed files updates definitions without wiping task state.

## Phase 2: MCP Service And HTTP Bridge

Goal: expose one service interface for agents, CLI, and the dashboard.

Tasks:

1. Implement the VibeRig MCP service in Python.
   - Use SQLite as the runtime store.
   - Keep service operations explicit and small.
   - Emit activity events for state-changing operations.

2. Implement required MCP tools.
   - `viberig.projects.list`
   - `viberig.projects.register`
   - `viberig.projects.refresh`
   - `viberig.requirements.list`
   - `viberig.requirements.import`
   - `viberig.requirements.get`
   - `viberig.board.get`
   - `viberig.tasks.get`
   - `viberig.tasks.move`
   - `viberig.tasks.update_status`
   - `viberig.tasks.update_order`
   - `viberig.acceptance.list`
   - `viberig.acceptance.update_status`
   - `viberig.runs.create`
   - `viberig.runs.append_event`
   - `viberig.runs.finish`
   - `viberig.runs.get_log`
   - `viberig.evidence.list`
   - `viberig.evidence.record`
   - `viberig.reviews.record_manual_review`

3. Implement MCP resources.
   - `viberig://projects`
   - `viberig://projects/{project_id}`
   - `viberig://projects/{project_id}/requirements`
   - `viberig://requirements/{requirement_id}`
   - `viberig://requirements/{requirement_id}/board`
   - `viberig://tasks/{task_id}`
   - `viberig://tasks/{task_id}/acceptance`
   - `viberig://tasks/{task_id}/runs`
   - `viberig://runs/{run_id}/log`

4. Add a thin HTTP and event bridge for the dashboard.
   - Provide REST endpoints matching the design document.
   - Add `GET /api/events/stream` using server-sent events or WebSocket.
   - Route dashboard mutations through the same service methods used by MCP.

Validation:

- MCP and HTTP return consistent board state.
- Status moves are rejected when dependency or acceptance rules fail.
- Event stream emits task, run, evidence, and review updates.

## Phase 3: Dashboard Foundation

Goal: provide a local project and requirement board that makes task state visible.

Tasks:

1. Build the React dashboard shell.
   - Project selector.
   - Requirement selector.
   - Kanban board.
   - Task detail drawer.
   - Acceptance review panel.
   - Run log panel.

2. Implement the kanban board with `dnd-kit`.
   - Columns: Backlog, Ready, Running, Self Accepted, Human Review, Accepted, Blocked, Failed.
   - Cards show task id, title, roadmap item, dependency count, acceptance progress, latest run status, and manual review status.
   - Drag/drop calls the service-backed status/order APIs.

3. Implement task detail.
   - Summary.
   - Scope include/exclude.
   - Dependencies.
   - Acceptance checklist.
   - Validation commands.
   - Runs.
   - Evidence files.
   - Manual review controls.
   - Activity history.

Validation:

- A user can select a project, select a requirement, and inspect all imported tasks.
- Manual status changes are reflected in SQLite and immediately visible in the board.
- Task details expose acceptance and evidence state without opening raw files manually.

## Phase 4: Evidence And Human Review

Goal: make self-acceptance and human acceptance visible and auditable.

Tasks:

1. Implement evidence discovery.
   - Read evidence from `.vibeRig/requirements/<requirement_id>/evidence/<task_id>/`.
   - Record evidence metadata in SQLite.
   - Support `self-acceptance.md`, `validation.json`, `run.log`, `changed-files.txt`, and `human-review.md`.

2. Implement acceptance matrix display.
   - Show linked acceptance criteria per task.
   - Show PASS, FAIL, PARTIAL, BLOCKED, or NOT RUN status.
   - Link each result to evidence.

3. Implement manual review.
   - Record reviewer, result, notes, reviewed evidence, and accepted residual risks.
   - Allow `human_review -> accepted` only when review passes or the task is explicitly auto-acceptable.

Validation:

- A task cannot move to `self_accepted` without validation evidence.
- A task cannot move to `accepted` without passing human review or an explicit auto-accept rule.
- Review records are visible in activity history.

## Phase 5: Optional Local Runner

Goal: automate task execution after the manual board model is proven.

Tasks:

1. Implement run creation.
   - Pick a `ready` task.
   - Check dependencies.
   - Record a run row.
   - Use the synchronized DB task payload to generate the execution prompt.

2. Implement worktree setup.
   - Fetch and resolve `origin/main` by default.
   - Record the base ref and source Git commit SHA.
   - Create or reuse `worktrees/<requirement_id>-<task_id>/`.
   - Reject runs if Codex changes `.vibeRig/` inside the worktree.

3. Execute the task.
   - Start Codex or a placeholder command with task id, requirement id, and local file paths.
   - Stream logs to the run directory and service.
   - Run validation commands.
   - Write self-acceptance evidence.
   - Move the task to `self_accepted` or `failed`.

Validation:

- Runner output is visible from the dashboard while running.
- A successful run produces required evidence files.
- A failed run keeps logs and moves the task to `failed`.

## Phase 6: Optional Export And Mirror Integrations

Goal: keep collaboration integrations available without making them source of truth.

Tasks:

1. Add Linear mirror metadata and export.
   - Render task contracts into Markdown stories.
   - Support dry-run preview.
   - Store Linear IDs under `.vibeRig/exports/linear/`.

2. Add Obsidian export.
   - Export human-readable task and acceptance dashboards.
   - Do not let Obsidian own execution state.

3. Add Lark report export if needed.
   - Publish selected task and acceptance status.
   - Keep SQLite as source of truth.

4. Keep external integrations compatibility as a bridge.
   - Allow external integrations to consume exported tasks.
   - Do not require external integrations for core execution.

Validation:

- Disabling every external integration leaves the core workflow fully usable.
- Exported state can be regenerated from local VibeRig state.

## Task State Rules

- `draft -> ready`
- `ready -> running`
- `running -> self_accepted`
- `self_accepted -> human_review`
- `human_review -> accepted`
- `ready -> blocked`
- `running -> blocked`
- `running -> failed`
- `blocked -> ready`
- `failed -> ready`
- any non-terminal state can move to `canceled` with an explicit reason.

Guardrails:

- A task cannot move to `ready` if required dependencies are not `accepted` or explicitly waived.
- A task cannot move to `self_accepted` unless validation evidence exists.
- A task cannot move to `accepted` unless manual review passes or the task is explicitly marked as auto-acceptable.
- Runtime state changes must create activity events.

## Implementation Order

1. SQLite schema and migrations.
2. Project registry and requirement import.
3. MCP service.
4. HTTP/event bridge.
5. React project selector and kanban board.
6. Task detail, acceptance checklist, and evidence display.
7. Manual review.
8. Local runner.
9. Optional exports and mirrors.

## Open Decisions

- Which evidence files should be committed to Git by default.
- Whether statuses should be user-customizable.
- Whether manual review is required for every task or only high-risk tasks.
- Whether runner concurrency should default to single-task execution.

## Completion Status

Status: completed for the local native task engine baseline.

Implemented in `api/server.py`:

- Phase 1: SQLite runtime store, schema, migrations, project registration, requirement import, roadmap import, source revision hashing, idempotent re-import, deleted task archiving.
- Phase 2: Python service operations, HTTP bridge, server-sent event stream, stdio MCP JSON-RPC tool/resource bridge.
- Phase 3: Local dashboard shell with project selector, requirement selector, kanban board, native drag/drop, task detail drawer, acceptance, evidence, manual review, run log, and export controls.
- Phase 4: Evidence discovery, acceptance-linked task detail, manual review records, state transition guardrails, and activity history.
- Phase 5: Optional local runner with run rows, run log, per-run SQLite file, worktree preparation, validation execution, self-acceptance evidence, and success/failure status updates.
- Phase 6: Optional Linear markdown export, Obsidian dashboard export, and Lark JSON report export.

Accepted by:

- `python3 -B -m unittest tests.test_viberig_task_engine`
- `printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' | python3 -B api/server.py mcp`
- `python3 -B api/server.py --help`

Detailed acceptance record: `docs/viberig-native-task-engine-acceptance-result.md`.
