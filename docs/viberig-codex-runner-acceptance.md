# VibeRig Codex Runner Acceptance

## Scope

These acceptance criteria cover the backend Codex runner described in:

- `docs/viberig-codex-runner-design.md`
- `docs/viberig-codex-runner-plan.md`

The accepted system must let VibeRig use Codex to implement tasks in isolated worktrees, persist Codex sessions and transcripts, validate completed work, and expose all run evidence through API, MCP, and dashboard views.

## Non-Negotiable Acceptance Rule

A VibeRig run is not accepted as complete unless the user can answer this question from VibeRig data alone:

```text
Which Codex session implemented this task, what prompt did it receive, what did it output, what files did it change, what validation ran, and why did the task end in its current state?
```

## Acceptance Criteria

### AC-1: Backend Owns The Run Flow

The dashboard only creates and inspects runs. The backend owns implementation, validation, evidence, and status transitions.

Checks:

- `POST /api/tasks/:task_id/runs` creates a backend-controlled run.
- The dashboard does not run validation commands directly.
- The dashboard does not mark a run successful.
- Task status changes during a run are produced by backend service methods.
- All state-changing operations emit activity or run events.

Evidence:

- API test for run creation.
- Browser network trace showing the dashboard only calls run/status APIs.
- Database rows showing backend-created run and run events.

### AC-2: Validation Does Not Run Before Codex Implementation

A task run must enter a Codex implementation phase before validation starts.

Checks:

- Run event order includes Codex implementation before validation.
- Validation events cannot appear before `codex.completed`.
- Validation-only execution is allowed only through an explicitly named test/fake runner mode, not the default run path.

Evidence:

- Run events for a sample task.
- Unit test asserting event order.
- Failed Codex run showing validation was skipped.

### AC-3: Codex Session Is A First-Class Entity

Every implementation run has a durable Codex session record, even if the adapter cannot expose a native Codex conversation id.

Checks:

- Each implementation run has a VibeRig `codex_session_id`.
- Session records link to `project_id`, `requirement_id`, `task_id`, and `run_id`.
- Session records store adapter name, status, timestamps, prompt path, transcript/event paths, and final output path.
- Native identifiers are stored when available: thread id, turn ids, or Codex conversation id.
- Session records survive backend restart.

Evidence:

- SQLite query or API response for a run's Codex session.
- Artifact directory containing prompt, events, transcript, and final response.
- Restart test showing session lookup still works.

### AC-4: Codex Session Lookup Works From Run, Task, And Session Id

Users and tools can query Codex sessions from the entities they naturally start with.

Checks:

- `GET /api/runs/:run_id/codex-session` returns the exact session for a run.
- `GET /api/tasks/:task_id/codex-sessions` returns all sessions for a task.
- `GET /api/codex-sessions/:session_id` returns metadata.
- `GET /api/codex-sessions/:session_id/transcript` returns or links to the transcript.
- `GET /api/codex-sessions/:session_id/events` returns persisted Codex events.
- MCP resources or tools expose the same session lookup paths.

Evidence:

- API tests for all lookup paths.
- MCP scripted call output.
- Dashboard task detail showing session links.

### AC-5: Prompt Is Persisted And Reproducible

The exact prompt given to Codex is stored before Codex starts.

Checks:

- `codex-prompt.md` is written under `~/.viberig/runs/<run_id>/`.
- Prompt includes project id, project root, worktree path, requirement id, task id, task title, scope, dependencies, linked acceptance criteria, validation commands, and execution rules.
- Prompt artifact path is recorded in the Codex session record.
- Rebuilding the prompt for unchanged source artifacts produces stable content except timestamps or run-specific ids.

Evidence:

- Prompt file for a sample run.
- Unit test for prompt contents.
- API response linking the prompt artifact.

### AC-6: Worktree Isolation

Codex implementation runs inside the task worktree, not the main project checkout.

Checks:

- Runner creates or reuses `worktrees/<requirement_id>-<task_id>/`.
- Codex adapter receives the worktree as its working directory.
- Requirement files needed for implementation are visible in the worktree.
- Runtime SQLite files are not written into the worktree.
- Failed and blocked runs preserve the worktree for inspection.

Evidence:

- Run record showing worktree path.
- Codex prompt and adapter invocation showing worktree cwd.
- Git status from main checkout and worktree after a sample run.

### AC-7: Codex Adapter Interface Is Enforced

Codex connectivity is behind a stable backend adapter interface.

Checks:

- Runner calls a common adapter interface instead of embedding adapter-specific logic throughout the run flow.
- Adapter result includes status, session metadata, output paths, usage, final response, error summary, and exit code.
- Fake adapter can simulate success, failure, input required, and timeout.
- Real adapters record their adapter name on the run/session.

Evidence:

- Unit tests using fake adapter results.
- Code references showing adapter interface use.
- Sample run record showing `codex_adapter`.

### AC-8: Codex CLI Adapter Works

The minimal local adapter can invoke Codex through CLI for end-to-end testing.

Checks:

- Adapter runs `codex exec` with configured working directory, sandbox, approval policy, and model options.
- JSONL events are captured when `--json` is enabled.
- stdout and stderr are appended to run logs.
- Exit code is captured.
- A VibeRig Codex session is created even when native Codex conversation id is unavailable.

Evidence:

- Local smoke test run.
- Stored `codex-events.jsonl`.
- Stored `codex-final.md`.
- Run log showing Codex invocation and result.

### AC-9: Codex MCP Adapter Works

The backend can use `tuannvm/codex-mcp-server` or a compatible MCP server as a Codex execution adapter.

Checks:

- Backend can start or connect to the MCP server.
- Backend calls MCP `tools/call` for the `codex` tool.
- Tool arguments include `prompt`, `sessionId`, `workingDirectory`, `model`, `reasoningEffort`, `sandbox`, and `fullAuto` when configured.
- Progress notifications are persisted as run events.
- Native Codex conversation id is stored when returned by the MCP server.
- Resume appends a new turn/session event rather than overwriting the old one.

Evidence:

- MCP adapter integration test or mocked MCP server test.
- Run events showing progress notifications.
- Session record showing MCP session id and native conversation id when available.

### AC-10: Symphony-Style AppServer Adapter Works

The long-term adapter can drive Codex using AppServer JSON-RPC over stdio.

Checks:

- Adapter starts the configured AppServer command.
- Adapter sends `initialize`.
- Adapter sends initialized notification.
- Adapter sends `thread/start` with cwd, sandbox, approval policy, and tools configuration.
- Adapter sends `turn/start` with the generated prompt.
- Adapter captures thread id, turn ids, completion events, errors, usage, and final output.
- Adapter handles turn completion, failure, cancellation, input required, malformed messages, and timeout.

Evidence:

- AppServer adapter integration test.
- Stored AppServer event stream.
- Session record showing thread id and turn ids.

### AC-11: Codex Events Are Persisted

Codex runtime behavior is visible after the run completes or fails.

Checks:

- Events are persisted to `run_events`.
- Raw or normalized Codex event stream is written under the run directory.
- Events include enough data to debug failure, blocked input, unsupported tool calls, and approval behavior.
- Events are retrievable through HTTP and MCP.

Evidence:

- `GET /api/runs/:run_id/events` output.
- `codex-events.jsonl` artifact.
- MCP tool/resource output for the same run.

### AC-12: Diff And Changed Files Are Captured

Every implementation run records what Codex changed.

Checks:

- Runner writes `changed-files.txt`.
- Runner writes `diff.patch`.
- Run record stores changed file list and diff path.
- Dashboard can show or link the diff.
- Failed validation still preserves diff and changed files.

Evidence:

- Sample run artifact directory.
- API response for run artifacts.
- Dashboard run detail showing changed files and diff link.

### AC-13: Validation Runs After Codex Completes

Validation is backend-owned and executed only after implementation finishes.

Checks:

- String validation items are executed in the worktree.
- Manual validation items are recorded but not executed as shell commands.
- stdout and stderr are appended to `run.log`.
- `validation.json` records command, exit code, duration, and manual flags.
- Validation failure marks task `failed` and run `failed`.
- Validation success allows self-acceptance evidence to be written.

Evidence:

- Passing validation sample.
- Failing validation sample.
- `validation.json` files for both cases.
- Run events showing validation start and finish.

### AC-14: Self-Acceptance Evidence References Codex Session

Self-acceptance evidence must connect validation results back to the Codex implementation session.

Checks:

- `self-acceptance.md` includes run id.
- `self-acceptance.md` includes Codex session id.
- `self-acceptance.md` includes adapter name.
- `self-acceptance.md` links prompt, transcript/events, changed files, diff, validation, and run log.
- Evidence is copied into `.vibeRig/requirements/<requirement_id>/evidence/<task_id>/` after successful validation.

Evidence:

- `self-acceptance.md` for a successful run.
- Evidence list API response.
- Dashboard evidence panel.

### AC-15: Failure And Blocked States Are Explainable

Failed, blocked, and canceled runs preserve enough information for a user to decide next steps.

Checks:

- Codex failure stores error summary and partial output.
- Input-required state moves the task to `blocked` or records a blocked run state.
- Timeout stores timeout reason and last event timestamp.
- Validation failure stores validation output and diff.
- Cancellation stores cancellation event and partial artifacts.
- Retrying from `failed` or `blocked` requires a reason.

Evidence:

- Simulated failure tests.
- Simulated input-required test.
- Timeout or fake timeout test.
- API response showing error summary and artifacts.

### AC-16: API Surface Supports Run Investigation

The HTTP API exposes all information needed to inspect a run without reading files manually.

Checks:

- `GET /api/runs/:run_id` returns run metadata and implementation status.
- `GET /api/runs/:run_id/events` returns ordered events.
- `GET /api/runs/:run_id/log` returns run log.
- `GET /api/runs/:run_id/diff` returns or links diff.
- `GET /api/runs/:run_id/artifacts` returns prompt, transcript/events, final output, changed files, validation, and evidence paths.
- `POST /api/runs/:run_id/cancel` cancels active runs when possible.

Evidence:

- API test output.
- Dashboard run detail using these endpoints.

### AC-17: MCP Surface Supports Agent Inspection

Agents can inspect runs and Codex sessions through VibeRig MCP tools/resources.

Checks:

- MCP exposes run events.
- MCP exposes run artifacts.
- MCP exposes run diff.
- MCP exposes Codex session lookup by session id.
- MCP exposes Codex sessions for a task.
- MCP exposes Codex transcript.

Evidence:

- Scripted `tools/list`.
- Scripted calls to session and artifact tools.
- Resource reads for run log or transcript.

### AC-18: Dashboard Shows Implementation And Validation Separately

The UI makes the implementation phase distinct from validation and human acceptance.

Checks:

- Task card or detail shows latest run implementation status.
- Task detail shows Codex adapter and session id.
- Task detail links prompt, transcript/events, final message, changed files, diff, validation, and self-acceptance.
- Failed runs show whether failure happened during Codex, validation, cancellation, or reconciliation.
- Dashboard can start from a task and navigate to all Codex sessions for that task.

Evidence:

- Playwright screenshot for successful run.
- Playwright screenshot for failed validation run.
- Playwright screenshot for Codex failure or blocked run.

### AC-19: Reconciliation Preserves Data

Backend restart or runner interruption does not erase active run context.

Checks:

- Incomplete runs remain queryable after backend restart.
- Stale runs are detected.
- Reconciliation marks interrupted runs failed or blocked with a clear event.
- Existing prompt, session, logs, events, and partial diff remain available.

Evidence:

- Restart/reconciliation test.
- Run events showing reconciliation.
- Artifact directory still present after restart.

### AC-20: Existing Native Task Engine Behavior Does Not Regress

Existing project registration, requirement import, board display, manual status transitions, evidence discovery, and dashboard build continue to work.

Checks:

- Existing task engine unit tests pass.
- Dashboard builds.
- Project registration still works for `/Users/jsonlee/Projects/hermes-desktop`.
- Existing REST aliases remain compatible unless intentionally deprecated with migration notes.

Evidence:

- Test command output.
- Dashboard build output.
- Manual smoke test URL for the local service.

## Required Verification Commands

```bash
python3 -B -m py_compile api/server.py tests/test_viberig_task_engine.py
python3 -B -m unittest tests.test_viberig_task_engine
npm --prefix dashboard run build
```

Adapter-specific verification should be separated:

```bash
python3 -B -m unittest tests.test_viberig_codex_runner
VIBERIG_CODEX_ADAPTER=cli python3 -B -m unittest tests.test_viberig_codex_cli_adapter
VIBERIG_CODEX_ADAPTER=mcp python3 -B -m unittest tests.test_viberig_codex_mcp_adapter
VIBERIG_CODEX_ADAPTER=appserver python3 -B -m unittest tests.test_viberig_codex_appserver_adapter
```

Real Codex adapter tests should be opt-in and skipped by default in CI unless credentials and local Codex runtime are explicitly configured.
