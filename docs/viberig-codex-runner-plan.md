# VibeRig Codex Runner Plan

## Source

This plan is derived from:

- `docs/viberig-native-task-engine.md`
- `docs/viberig-codex-runner-design.md`
- Symphony's orchestrator, agent runner, workspace, and Codex AppServer design
- `tuannvm/codex-mcp-server` as a possible Codex MCP adapter

## Objective

Build the VibeRig backend runner so task implementation is performed by Codex in an isolated worktree, while VibeRig owns orchestration, status transitions, run records, Codex session lookup, validation, and evidence.

The dashboard remains a control and visibility surface. It may create or inspect runs, but it must not be the implementation engine and must not decide task success.

## Delivery Principles

- Follow Symphony's split between orchestrator, task runner, workspace setup, Codex session/turn management, and event forwarding.
- Make Codex session traceability a first-class backend capability.
- Keep VibeRig task state in `~/.viberig/viberig.sqlite`.
- Keep run artifacts under `~/.viberig/runs/<run_id>/`.
- Keep accepted evidence under `.vibeRig/requirements/<requirement_id>/evidence/<task_id>/`.
- Never treat validation-only execution as a complete task run.
- Keep Codex connection behind an adapter interface so AppServer, MCP, and CLI adapters can share the same backend state machine.

## Target Run Flow

```text
ready task
  -> create run
  -> mark task running
  -> prepare worktree
  -> build Codex prompt
  -> start Codex implementation session
  -> persist Codex session, turns, transcript, events, usage, and output
  -> collect changed files and diff
  -> run validation commands
  -> write validation and self-acceptance evidence
  -> mark task self_accepted, failed, blocked, or canceled
```

## Phase 1: Runner State Model

Goal: make the backend data model capable of representing implementation runs, not only validation results.

Tasks:

1. Extend run state.
   - Add implementation-level statuses: `created`, `preflight`, `workspace_ready`, `codex_starting`, `codex_running`, `codex_completed`, `codex_failed`, `validating`, `validation_failed`, `self_acceptance_written`, `success`, `failed`, `blocked`, and `canceled`.
   - Preserve existing task statuses, but stop using task status as the only source of run progress.

2. Add Codex session persistence.
   - Add a `codex_sessions` table or equivalent normalized records.
   - Link each session to `project_id`, `requirement_id`, `task_id`, and `run_id`.
   - Store adapter name, session id, thread id, conversation id, turn ids, status, timestamps, transcript path, event path, final response path, usage JSON, and error summary.

3. Extend `runs`.
   - Store `implementation_status`.
   - Store `codex_adapter`.
   - Store `codex_session_id`.
   - Store `codex_thread_id`.
   - Store `codex_conversation_id`.
   - Store `codex_exit_code`.
   - Store `codex_usage_json`.
   - Store `changed_files_json`.
   - Store `diff_path`.

4. Extend run events.
   - Add event types for runner, workspace, Codex, diff collection, validation, and evidence.
   - Keep event payloads JSON-serializable and queryable.

Validation:

- Existing projects and tasks migrate without data loss.
- Existing run records remain readable.
- A new run can store Codex session metadata even before validation starts.
- A run can be queried back to its Codex session.

## Phase 2: Runner Decomposition

Goal: split the current validation-only runner into explicit backend phases.

Tasks:

1. Refactor `execute_ready_task()`.
   - Extract `create_run_context`.
   - Extract `prepare_task_worktree`.
   - Extract `build_codex_prompt`.
   - Extract `run_codex_implementation`.
   - Extract `collect_git_diff`.
   - Extract `run_validation`.
   - Extract `write_run_evidence`.
   - Extract `finish_task_run`.

2. Preserve existing guardrails.
   - A task must be `ready` before a run starts.
   - Dependencies must be accepted or waived.
   - Failed or blocked tasks require a reason before moving back to `ready`.
   - `self_accepted` still requires validation or self-acceptance evidence.

3. Change run ordering.
   - Current behavior: create run, prepare worktree, run validation.
   - New behavior: create run, prepare worktree, run Codex, collect diff, run validation.

4. Persist phase events.
   - Emit events at phase start and phase finish.
   - Include duration, status, and artifact paths where useful.

Validation:

- Running a task no longer starts validation before Codex implementation.
- Each runner phase writes a run event.
- Failure in any phase produces a failed or blocked run with preserved artifacts.

## Phase 3: Prompt Contract

Goal: ensure Codex receives the complete task context from VibeRig, not from the dashboard.

Tasks:

1. Build a deterministic prompt file at `~/.viberig/runs/<run_id>/codex-prompt.md`.
2. Include project context.
   - Project id.
   - Project root.
   - Worktree path.
   - Requirement id.
3. Include task context.
   - Task id.
   - Title.
   - Type and priority.
   - Scope include/exclude.
   - Dependencies and statuses.
   - Suggested agent, review agent, and acceptance agent when present.
4. Include acceptance context.
   - Linked acceptance criteria.
   - Requirement source file paths.
   - Expected evidence files.
5. Include validation context.
   - Validation commands.
   - Manual validation items.
   - Clear instruction that the runner owns final validation.
6. Include execution rules.
   - Implement only this task.
   - Keep changes scoped to the worktree.
   - Do not edit runtime SQLite files directly.
   - Do not mark human acceptance.
   - Write a concise final summary.

Validation:

- Prompt generation is deterministic for the same task and source revision.
- Prompt file is saved before Codex starts.
- Run logs and APIs expose the prompt artifact path.

## Phase 4: Codex Adapter Interface

Goal: isolate Codex connectivity from the VibeRig runner state machine.

Tasks:

1. Add a backend adapter interface.
   - Input: run context, worktree path, prompt path, model, reasoning effort, sandbox, approval policy, timeout settings.
   - Output: status, session metadata, transcript paths, usage, final message, error summary, and exit code.

2. Implement adapter result shape.
   - `adapter`
   - `session_id`
   - `thread_id`
   - `conversation_id`
   - `turn_ids`
   - `status`
   - `exit_code`
   - `usage`
   - `transcript_path`
   - `events_path`
   - `final_message_path`
   - `error`

3. Add config.
   - `runner.codex.adapter`
   - `runner.codex.command`
   - `runner.codex.model`
   - `runner.codex.reasoning_effort`
   - `runner.codex.approval_policy`
   - `runner.codex.sandbox`
   - `runner.codex.turn_timeout_ms`
   - `runner.codex.stall_timeout_ms`

Validation:

- A test adapter can simulate success, failure, input-required, and timeout.
- The runner can finish each simulated adapter result correctly.
- The selected adapter is recorded on the run and Codex session.

## Phase 5: Codex CLI Adapter

Goal: provide the smallest local implementation path while the AppServer adapter is being built.

Tasks:

1. Implement `codex exec --json`.
   - Run with `--cd <worktree>`.
   - Run with configured sandbox and approval policy.
   - Feed prompt through stdin or prompt file.
   - Capture JSONL events.
   - Capture stdout and stderr.
   - Capture exit code.

2. Persist artifacts.
   - `codex-events.jsonl`
   - `codex-final.md`
   - `run.log`
   - optional transcript file if extractable.

3. Extract session metadata.
   - Parse native Codex conversation id when available.
   - If unavailable, create a VibeRig-owned `codex_session_id` and still expose stored transcript/artifacts.

Validation:

- A run can invoke Codex CLI from the worktree.
- Output is streamed or appended into run log.
- JSONL events are stored and queryable.
- A run can be traced to a VibeRig Codex session id even if the CLI does not expose a native conversation id.

## Phase 6: Codex MCP Adapter

Goal: support `tuannvm/codex-mcp-server` as a Codex connection path.

Tasks:

1. Add a small MCP client in the VibeRig backend.
   - Start or connect to `codex-mcp-server`.
   - Call the `codex` tool.
   - Pass `prompt`, `sessionId`, `workingDirectory`, `model`, `reasoningEffort`, `sandbox`, and `fullAuto`.

2. Map MCP sessions into VibeRig sessions.
   - Use VibeRig `run_id` or generated `codex_session_id` as MCP `sessionId`.
   - Persist any native Codex conversation id returned by the MCP server.
   - Store progress notifications as run events.

3. Support resume.
   - Allow a blocked or failed run to resume with the previous VibeRig Codex session id when safe.
   - Record resumed turns as additional turn records.

Validation:

- Backend can call the MCP `codex` tool for a task worktree.
- Progress notifications become run events.
- Session id and conversation id can be queried after the run.
- Resuming a session appends a new turn instead of overwriting history.

## Phase 7: Symphony-Style AppServer Adapter

Goal: implement the preferred long-term Codex integration model.

Tasks:

1. Start configured AppServer command.
   - Default command: `codex app-server`.
   - Communicate over JSON-RPC stdio.

2. Implement startup protocol.
   - Send `initialize`.
   - Send initialized notification.
   - Send `thread/start`.
   - Capture `thread_id`.

3. Implement turn protocol.
   - Send `turn/start` with prompt and worktree context.
   - Capture turn ids and events.
   - Support turn completion, failure, cancellation, input required, and timeout.

4. Persist AppServer events.
   - `session_started`
   - `turn_started`
   - `turn_completed`
   - `turn_failed`
   - `turn_cancelled`
   - `turn_input_required`
   - `approval_auto_approved`
   - `unsupported_tool_call`
   - `notification`
   - `malformed`

5. Add dynamic tool foundation.
   - Keep VibeRig MCP tools available.
   - Later expose selected VibeRig operations as AppServer dynamic tools.

Validation:

- AppServer adapter can initialize a Codex session.
- AppServer adapter can start at least one turn.
- Thread id, turn ids, events, usage, final output, and errors are persisted.
- A session can be queried by run id, task id, and Codex session id.

## Phase 8: Diff, Validation, And Evidence

Goal: turn Codex implementation output into auditable self-acceptance evidence.

Tasks:

1. Collect changed files.
   - Use Git inside the worktree.
   - Write `changed-files.txt`.
   - Store changed file list in SQLite.

2. Collect diff.
   - Write `diff.patch`.
   - Store diff artifact path in SQLite.

3. Run validation after Codex completes.
   - Execute string validation commands.
   - Record manual validation items without executing them.
   - Append stdout and stderr to `run.log`.
   - Write `validation.json`.

4. Write self-acceptance evidence.
   - Include Codex session id.
   - Include changed files.
   - Include validation results.
   - Include residual risks and manual validation requirements.

5. Copy accepted evidence into project requirement evidence folder.

Validation:

- Validation is never executed before implementation finishes.
- Failed validation preserves Codex output, diff, changed files, and validation logs.
- Successful validation writes self-acceptance evidence with Codex session references.

## Phase 9: API And Dashboard Queries

Goal: make Codex sessions and run artifacts discoverable from the dashboard and external clients.

Tasks:

1. Add run detail APIs.
   - `GET /api/runs/:run_id`
   - `GET /api/runs/:run_id/events`
   - `GET /api/runs/:run_id/log`
   - `GET /api/runs/:run_id/diff`
   - `GET /api/runs/:run_id/artifacts`
   - `POST /api/runs/:run_id/cancel`

2. Add Codex session APIs.
   - `GET /api/runs/:run_id/codex-session`
   - `GET /api/tasks/:task_id/codex-sessions`
   - `GET /api/codex-sessions/:session_id`
   - `GET /api/codex-sessions/:session_id/transcript`
   - `GET /api/codex-sessions/:session_id/events`

3. Add MCP tools/resources.
   - `viberig.runs.get_events`
   - `viberig.runs.get_artifacts`
   - `viberig.runs.get_diff`
   - `viberig.codex_sessions.get`
   - `viberig.codex_sessions.list_for_task`
   - `viberig.codex_sessions.get_transcript`

4. Update dashboard.
   - Show implementation status separately from validation status.
   - Show Codex session id and adapter.
   - Link to transcript, events, final message, diff, changed files, validation, and self-acceptance evidence.

Validation:

- A user can start from a task and find every Codex session associated with it.
- A user can start from a run and find the exact Codex session, transcript, events, prompt, diff, and validation evidence.
- Dashboard displays implementation and validation phases separately.

## Phase 10: Orchestrator And Reconciliation

Goal: move from one-off synchronous runs to a robust backend-controlled execution loop.

Tasks:

1. Add a queue or worker loop.
   - Single-task concurrency by default.
   - Explicit opt-in for parallel runs.

2. Add run reconciliation.
   - Detect stale `running` tasks.
   - Detect stale Codex sessions.
   - Mark interrupted runs as failed or blocked with evidence.

3. Add cancellation.
   - Cancel active adapter process when possible.
   - Mark run canceled.
   - Preserve partial output.

4. Add retry/resume.
   - Retry failed or blocked tasks only after an explicit reason.
   - Reuse or fork Codex session depending on adapter support and run state.

Validation:

- A crashed backend can restart and show unfinished runs.
- Stale runs can be reconciled without losing logs.
- Cancellation preserves partial Codex events and worktree state.

## Implementation Order

1. Phase 1: Runner state model.
2. Phase 2: Runner decomposition.
3. Phase 3: Prompt contract.
4. Phase 4: Adapter interface with a fake adapter for tests.
5. Phase 5: CLI adapter for local end-to-end testing.
6. Phase 8: Diff, validation, and evidence.
7. Phase 9: Query APIs and dashboard visibility.
8. Phase 6: MCP adapter.
9. Phase 7: AppServer adapter.
10. Phase 10: Orchestrator and reconciliation.

## Initial Verification Commands

```bash
python3 -B -m py_compile api/server.py tests/test_viberig_task_engine.py
python3 -B -m unittest tests.test_viberig_task_engine
npm --prefix dashboard run build
```

Additional adapter tests should use fake Codex adapters by default and only use real Codex commands when explicitly enabled.
