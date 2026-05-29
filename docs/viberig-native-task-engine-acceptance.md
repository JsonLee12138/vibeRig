# VibeRig Native Task Engine Acceptance

## Scope

These acceptance criteria cover the native VibeRig task engine described in `docs/viberig-native-task-engine.md` and planned in `docs/viberig-native-task-engine-plan.md`.

The accepted system provides a local task and acceptance control plane backed by SQLite, MCP, a dashboard, explicit evidence, and optional runner automation. Linear, Lark, Obsidian, GitHub Issues, and external integrations are not required for core execution.

## Acceptance Criteria

### AC-1: Local Source Of Truth

The system keeps requirement source artifacts in the project repository and runtime state outside the repository.

Checks:

- `.vibeRig/requirements/<requirement_id>/` remains the location for requirement source files.
- `tasks.yaml` is treated as canonical task definition during import.
- `roadmap.md` and `acceptance.md` are parsed for display, mapping, and acceptance links.
- `~/.viberig/viberig.sqlite` stores runtime state.
- SQLite runtime files are not written into project Git history.

Evidence:

- Import log.
- SQLite schema dump or migration test output.
- Git status showing runtime database files are outside the repository.

### AC-2: Project And Requirement Registration

A user can register a local project and import requirements into the global VibeRig runtime database.

Checks:

- Project registration records project id, name, root, optional config path, status, and timestamps.
- Requirement import creates or updates requirement records.
- Re-importing an unchanged requirement is idempotent.
- Re-importing changed source files updates definitions while preserving runtime task state.
- Deleted tasks are marked `canceled` or `archived` instead of being silently removed.

Evidence:

- Automated import tests.
- Before/after database rows for unchanged and changed imports.
- Source revision hashes for `tasks.yaml`, `roadmap.md`, and `acceptance.md`.

### AC-3: Minimum Data Model

The runtime database supports board state, task definitions, dependencies, acceptance criteria, runs, evidence, reviews, and activity history.

Checks:

- The database includes tables for projects, requirements, roadmap items, tasks, task dependencies, acceptance items, task acceptance links, runs, evidence, manual reviews, activity events, and source revisions.
- Foreign-key-like references are validated in service code or database constraints.
- Every state-changing service method writes an activity event.
- Runtime records include created and updated timestamps where applicable.

Evidence:

- Migration test output.
- Schema snapshot.
- Service tests that assert activity event creation.

### AC-4: MCP Service Interface

Agents and CLI clients can operate VibeRig through MCP without using the browser dashboard.

Checks:

- Project tools list, register, and refresh projects.
- Requirement tools list, import, and get requirements.
- Board and task tools return board state, task details, and allow valid status/order moves.
- Acceptance tools list and update acceptance status.
- Run tools create, append events, finish, and retrieve logs.
- Evidence tools list and record evidence.
- Review tools record manual review.
- MCP resources expose projects, requirements, boards, tasks, acceptance, runs, and logs.

Evidence:

- MCP integration tests or scripted calls.
- Example responses for board, task detail, acceptance, and run log resources.

### AC-5: HTTP And Event Bridge

The dashboard uses a thin HTTP and event bridge that calls the same service operations as MCP.

Checks:

- HTTP endpoints expose project, requirement, board, task, acceptance, run, evidence, manual review, and event stream operations.
- MCP and HTTP return consistent state for the same project and requirement.
- Browser mutations do not bypass service transition rules.
- Event stream publishes task, run, evidence, and review changes.

Evidence:

- API tests.
- Event stream test output.
- Dashboard network trace or Playwright flow showing live update behavior.

### AC-6: Kanban Dashboard

The first-class UI is a kanban-style task board with project and requirement selection.

Checks:

- Dashboard starts with project selector and requirement selector.
- Board columns include Backlog, Ready, Running, Self Accepted, Human Review, Accepted, Blocked, and Failed.
- Task cards show task id, title, roadmap item, dependency count, acceptance progress, latest run status, and manual review status.
- Drag/drop or explicit status controls call service-backed APIs.
- The UI does not require graph visualization to operate the workflow.

Evidence:

- Playwright screenshot or UI test.
- API call trace for a manual status move.
- Database row showing the status/order update.

### AC-7: Task Detail Drawer

Each task exposes enough context for implementation and review without manually opening multiple files.

Checks:

- Detail drawer shows summary, scope include/exclude, dependencies, acceptance checklist, validation commands, runs, evidence files, manual review controls, and activity history.
- Acceptance items are linked to the task through stable ids.
- Run and evidence sections show empty states when no evidence exists.
- Activity history updates after status moves, evidence records, and manual reviews.

Evidence:

- UI test for task detail rendering.
- Example task detail API response.
- Screenshot showing a task with linked acceptance and evidence.

### AC-8: State Transition Guardrails

Invalid task transitions are rejected with actionable errors.

Checks:

- A task cannot move to `ready` if required dependencies are not `accepted` or explicitly waived.
- A task cannot move to `self_accepted` unless validation evidence exists.
- A task cannot move to `accepted` unless manual review passes or an explicit auto-accept rule applies.
- A blocked or failed task can move back to `ready` only with a recorded reason.
- Any non-terminal task can move to `canceled` only with an explicit reason.

Evidence:

- Service tests for allowed and rejected transitions.
- Error response examples.
- Activity events for valid transitions.

### AC-9: Self-Acceptance Evidence

Self-acceptance is mandatory before human acceptance.

Checks:

- The expected self-acceptance files are supported under `evidence/<task_id>/`.
- `self-acceptance.md` contains an acceptance matrix, commands run, and residual risk.
- `validation.json`, `run.log`, and `changed-files.txt` can be discovered and recorded.
- The dashboard shows PASS, FAIL, PARTIAL, BLOCKED, or NOT RUN per acceptance item.
- `self_accepted` is impossible without validation evidence.

Evidence:

- Example `self-acceptance.md`.
- Evidence discovery test output.
- UI screenshot of acceptance matrix.

### AC-10: Human Review

Human acceptance is explicit, visible, and auditable.

Checks:

- Manual review records reviewer, result, notes, reviewed evidence, and accepted residual risks.
- Passing review can move a task from `human_review` to `accepted`.
- Failed or incomplete review keeps the task out of `accepted`.
- Review output can be written to `evidence/<task_id>/human-review.md`.
- The dashboard displays current review status and review history.

Evidence:

- Manual review API test.
- Example `human-review.md`.
- Activity history showing review creation and acceptance.

### AC-11: Optional Runner

The local runner can execute ready tasks, create evidence, and update status, but the core workflow remains usable without it.

Checks:

- Runner is not required for manual board operation.
- Runner picks a `ready` task only after dependency checks pass.
- Runner records the source Git commit SHA.
- Runner creates or reuses the expected worktree path.
- Runner creates Git worktrees from the configured base ref, `origin/main` by default.
- Runner passes task context through the backend-generated prompt instead of copying untracked requirement files.
- Runner streams logs to the run directory and service.
- Successful runs write self-acceptance evidence and move to `self_accepted`.
- Failed runs preserve logs and move to `failed`.

Evidence:

- Runner integration test.
- Run log.
- Generated evidence files.
- Database rows for run status and task status.

### AC-12: Worktree Source Context

Worktrees use Git as the source context mechanism.

Checks:

- Runner does not copy requirement context snapshots by default.
- Codex receives requirement context through the prompt and does not depend on `.vibeRig` files in the worktree.
- Runs fail if Codex changes `.vibeRig/` inside the worktree.
- Runtime output is written under run/evidence paths, not into source definition files.
- Worktree run database, if used, lives under `~/.viberig/runs/<run_id>/run.sqlite`.

Evidence:

- Worktree file listing.
- Recorded source commit SHA.
- Runner preflight output.

### AC-13: Optional Integrations Are Not Core Dependencies

External systems are export or mirror integrations only.

Checks:

- Core project registration, import, board operation, acceptance review, and evidence display work with no Linear, Lark, Obsidian, GitHub Issues, or external integrations credentials.
- Linear export stores metadata under `.vibeRig/exports/linear/` when enabled.
- Obsidian export produces human-readable views without owning execution state.
- Lark report export publishes selected status only when enabled.
- external integrations compatibility is a bridge, not a required runner path.

Evidence:

- Core workflow test with external integrations disabled.
- Export dry-run output for enabled integrations.
- Configuration showing integrations are optional.

### AC-14: Observability And Recovery

Users can understand what happened and recover from common failure states.

Checks:

- Activity events show task moves, run lifecycle events, evidence records, and manual reviews.
- Failed imports explain the invalid source file and reason.
- Failed transitions explain unmet dependencies, missing evidence, or missing review.
- Runner failures keep logs available through the dashboard and MCP resource.
- Refreshing a project does not erase runtime history.

Evidence:

- Error handling tests.
- Activity event samples.
- Failed run sample with retrievable log.

## Manual Acceptance Scenarios

### Scenario 1: Manual Board Workflow

1. Register a local project.
2. Import one requirement with at least three tasks and two acceptance items.
3. Open the dashboard.
4. Move a dependency-free task from Backlog to Ready.
5. Try to move a dependent task to Ready before dependency acceptance.
6. Confirm the dependent move is rejected.
7. Add evidence to the first task.
8. Move it through Self Accepted, Human Review, and Accepted.
9. Confirm the dependent task can now move to Ready.

Pass condition:

- The board, database, and activity history all show the expected state.

### Scenario 2: Evidence And Human Review

1. Import a task linked to at least two acceptance criteria.
2. Record `self-acceptance.md`, `validation.json`, `run.log`, and `changed-files.txt`.
3. Confirm the acceptance matrix is visible in the task detail drawer.
4. Record a manual review with accepted residual risks.
5. Move the task to Accepted.

Pass condition:

- The task cannot reach Accepted before review, and can reach Accepted after passing review.

### Scenario 3: Runner Failure

1. Prepare a ready task with a validation command that fails.
2. Start the local runner.
3. Confirm the run is created and logs stream.
4. Confirm the task moves to Failed.
5. Confirm logs are visible through the dashboard and MCP run log resource.

Pass condition:

- Failure evidence is preserved and the task does not appear accepted.

### Scenario 4: External Integrations Disabled

1. Run the full manual board workflow with no external integration credentials configured.
2. Confirm no Linear, Lark, Obsidian, GitHub Issues, or external integrations call is required.
3. Enable one export integration and run a dry-run export.

Pass condition:

- Core workflow succeeds without external systems, and export is regenerated from local state.

## Exit Criteria

The native task engine is accepted when:

- All AC-1 through AC-14 checks pass.
- Manual acceptance scenarios 1 through 4 pass.
- Existing VibeRig requirement files remain readable and versionable.
- Runtime state is recoverable from SQLite and evidence files.
- External systems remain optional.
