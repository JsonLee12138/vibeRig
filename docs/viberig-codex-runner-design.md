# VibeRig Codex Runner Backend Design

## Goal

VibeRig should use the dashboard as a control and visibility surface only. The actual task implementation flow is owned by the backend runner and executed by Codex inside an isolated worktree.

The runner should follow the Symphony model:

1. The backend owns task selection, state transitions, concurrency, logs, and evidence.
2. A per-task runner prepares an isolated workspace.
3. Codex is started with task context and workspace policy.
4. Codex performs implementation work through one or more turns.
5. The backend records Codex events, output, changed files, and validation evidence.
6. The backend moves completed automatic chains to `human_review`; only human review can move a task to `accepted`.

## References

- `openai/symphony`
  - Orchestrator polls eligible issues and dispatches an `AgentRunner`.
  - `AgentRunner` prepares workspace, builds prompt, starts Codex AppServer, manages turns, and forwards events.
  - Codex AppServer protocol uses JSON-RPC over stdio with `initialize`, `thread/start`, and `turn/start`.
  - `WORKFLOW.md` defines Codex command, approval policy, sandbox, timeouts, and prompt template.
- `tuannvm/codex-mcp-server`
  - Wraps Codex CLI as MCP tools.
  - Main tool is `codex`, with `prompt`, `sessionId`, `model`, `reasoningEffort`, `sandbox`, `fullAuto`, and `workingDirectory`.
  - Supports session resume through Codex conversation ids.
  - Supports progress notifications when the MCP client supplies a progress token.

## Architecture

```text
Dashboard
  Read-only control UI
  Shows board, task detail, run logs, Codex events, validation, evidence, diff

VibeRig API
  Owns projects, requirements, tasks, runs, run events, evidence, review state
  Exposes HTTP for dashboard
  Exposes MCP tools/resources for agents and external automation

VibeRig Orchestrator
  Selects ready tasks
  Enforces dependency and concurrency rules
  Dispatches one task runner per run
  Reconciles stuck or interrupted runs

VibeRig Task Runner
  Prepares git worktree
  Builds Codex prompt
  Starts Codex through the selected adapter
  Streams events/logs
  Collects diff and changed files
  Runs validation commands
  Writes evidence

Codex Adapter
  AppServer adapter for Symphony-style direct JSON-RPC
  MCP adapter for codex-mcp-server compatibility
  CLI adapter as a minimal fallback
```

## Backend State Machine

Task state remains VibeRig-owned:

```text
draft -> ready
ready -> running
running -> human_review
running -> failed
running -> blocked
running -> canceled
human_review -> accepted
human_review -> ready
failed -> ready
blocked -> ready
```

Run state should be more detailed than task state:

```text
created
preflight
workspace_ready
codex_starting
codex_running
codex_completed
codex_failed
validating
validation_failed
self_acceptance_written
success
failed
canceled
```

The dashboard should not directly infer implementation progress from task status. It should read run state and run events.

## Run Flow

```text
POST /api/tasks/:task_id/runs
  -> validate task is ready
  -> validate dependencies are accepted or waived
  -> create run row
  -> task ready -> running
  -> create run directory under ~/.viberig/runs/<run_id>/
  -> create or reuse git worktree
  -> sync or verify requirement files in worktree
  -> build implementation prompt
  -> start Codex implementation phase
  -> persist Codex events and transcript
  -> collect changed files and git diff
  -> run validation commands
  -> write validation.json, changed-files.txt, self-acceptance.md, run.log
  -> if Codex and validation pass: task running -> human_review, run -> success
  -> if Codex fails, validation fails, or timeout: task running -> failed, run -> failed
  -> if Codex needs external input: task running -> blocked, run -> failed or blocked
```

## Codex Connection Options

### Option A: Direct Codex AppServer Adapter

This is closest to Symphony.

Process:

1. Start configured command, default `codex app-server`.
2. Speak JSON-RPC over stdio.
3. Send `initialize`.
4. Send initialized notification.
5. Send `thread/start` with:
   - `cwd`: task worktree
   - `approvalPolicy`
   - `sandbox`
   - `dynamicTools`
6. Send `turn/start` with:
   - implementation prompt
   - `cwd`
   - `sandboxPolicy`
   - per-turn timeout
7. Read event stream until turn completion, failure, input required, or timeout.

Pros:

- Best match for Symphony.
- Event-level observability.
- Can expose VibeRig dynamic tools to Codex.
- Better long-running turn control.

Cons:

- More backend code.
- AppServer protocol is experimental and may change.

### Option B: MCP Adapter Through `codex-mcp-server`

Process:

1. Start `codex-mcp-server` as a child process or require an external configured MCP endpoint.
2. Call MCP `tools/call` for the `codex` tool.
3. Pass:
   - `prompt`
   - `sessionId`: VibeRig run id or stable Codex session id
   - `workingDirectory`: task worktree
   - `model`
   - `reasoningEffort`
   - `sandbox`
   - `fullAuto`
4. Capture returned response and progress notifications.
5. Persist output into run events.

Pros:

- Faster integration.
- Session handling and Codex CLI resume are already wrapped.
- Keeps Codex invocation behind a standard MCP tool boundary.

Cons:

- Less control than direct AppServer.
- In-memory session storage in that server is not enough for durable VibeRig runs.
- Backend still needs to persist session ids, transcript, events, and run state.

### Option C: Direct Codex CLI Adapter

Process:

1. Run `codex exec --json --cd <worktree> --sandbox workspace-write --ask-for-approval never`.
2. Feed the generated prompt through stdin.
3. Capture JSONL events, stdout, stderr, and exit code.

Pros:

- Smallest implementation.
- Useful as fallback and local smoke test.

Cons:

- Weaker session/turn model.
- Less close to Symphony.
- Harder to support dynamic tools cleanly.

## Recommended Adapter Strategy

Implement an adapter interface first:

```text
CodexAdapter.start_run(run_context) -> CodexResult
```

Initial concrete adapters:

1. `appserver`
   - Preferred default once stable.
   - Mirrors Symphony architecture.
2. `mcp`
   - Uses `codex-mcp-server`.
   - Good bridge when direct AppServer details change.
3. `cli`
   - Fallback for development and CI smoke tests.

Backend config should choose the adapter:

```yaml
runner:
  codex:
    adapter: appserver
    command: codex app-server
    model: gpt-5-codex
    reasoning_effort: high
    approval_policy: never
    sandbox: workspace-write
    turn_timeout_ms: 3600000
    stall_timeout_ms: 300000
```

## Prompt Contract

The backend builds the prompt. Codex should not need to infer VibeRig state from the UI.

Prompt input:

- Project root and worktree path.
- Requirement id.
- Task id, title, type, priority.
- Task scope.
- Dependencies and their statuses.
- Acceptance criteria linked to the task.
- Validation commands.
- Source files:
  - `.vibeRig/requirements/<requirement_id>/tasks.yaml`
  - `.vibeRig/requirements/<requirement_id>/acceptance.md`
  - `.vibeRig/requirements/<requirement_id>/roadmap.md`
  - optional `spec.md`, `research.md`, `requirement.md`
- Rules:
  - Implement only this task.
  - Keep changes scoped to the worktree.
  - Do not mark acceptance manually.
  - Leave validation to the runner unless the prompt explicitly asks for exploratory tests.
  - Write a concise final implementation summary.

## Run Artifacts

Runtime artifacts stay outside Git:

```text
~/.viberig/runs/<run_id>/
  run.sqlite
  run.log
  codex-prompt.md
  codex-events.jsonl
  codex-final.md
  changed-files.txt
  diff.patch
  validation.json
  self-acceptance.md
```

Accepted evidence can be copied into the project:

```text
.vibeRig/requirements/<requirement_id>/evidence/<task_id>/
  self-acceptance.md
  validation.json
  run.log
  changed-files.txt
```

## Database Additions

Extend `runs`:

```text
implementation_status text
codex_adapter text
codex_session_id text
codex_thread_id text
codex_conversation_id text
codex_exit_code integer
codex_usage_json text
changed_files_json text
diff_path text
```

Add or reuse `run_events` with these event types:

```text
runner.started
runner.preflight_started
runner.workspace_ready
codex.prompt_created
codex.session_started
codex.turn_started
codex.progress
codex.tool_call
codex.approval
codex.input_required
codex.turn_completed
codex.failed
diff.collected
validation.started
validation.finished
evidence.written
runner.finished
```

## HTTP API

Keep dashboard APIs read-oriented:

```text
POST /api/tasks/:task_id/runs
GET  /api/tasks/:task_id/runs
GET  /api/runs/:run_id
GET  /api/runs/:run_id/events
GET  /api/runs/:run_id/log
GET  /api/runs/:run_id/diff
GET  /api/runs/:run_id/artifacts
POST /api/runs/:run_id/cancel
```

The dashboard Run button only creates a run. It does not run validation itself and does not decide task success.

## MCP Tools

Expose VibeRig tools for Codex and external automation:

```text
viberig.tasks.get
viberig.tasks.update_status
viberig.runs.create
viberig.runs.append_event
viberig.runs.finish
viberig.runs.get_log
viberig.runs.get_events
viberig.runs.get_artifacts
viberig.acceptance.list
viberig.evidence.record
```

For the AppServer adapter, these can become Codex dynamic tools later.

For the MCP adapter, the backend still calls `codex-mcp-server`; Codex itself can also be configured with the VibeRig MCP server if needed.

## Error Flow

Codex failure:

```text
codex_running -> codex_failed
task running -> failed
run failed
write codex error and partial output
preserve worktree for inspection
```

Codex input required:

```text
codex_running -> blocked
task running -> blocked
run blocked or failed
write required input message
preserve worktree and session id for resume
```

Validation failure:

```text
codex_completed -> validating -> validation_failed
task running -> failed
run failed
write validation.json and run.log
preserve diff and changed files
```

Success:

```text
codex_completed -> validating -> self_acceptance_written
task running -> human_review
run success
wait for human approval before accepted transition
```

## Implementation Phases

### Phase 1: Backend Runner Shape

- Split current `execute_ready_task()` into phases:
  - `create_run_context`
  - `prepare_task_worktree`
  - `build_codex_prompt`
  - `run_codex_implementation`
  - `collect_git_diff`
  - `run_validation`
  - `write_evidence`
  - `finish_task_run`
- Add run events and artifact APIs.
- Keep validation behavior but run it only after Codex implementation completes.

### Phase 2: Codex CLI Adapter

- Add a minimal `codex exec --json` adapter behind the adapter interface.
- Persist prompt, JSONL events, final message, exit code, and changed files.
- Use this for local validation.

### Phase 3: MCP Adapter

- Add a backend MCP client that can call `codex-mcp-server`.
- Persist returned session id / native Codex conversation id when available.
- Support resume by run id.

### Phase 4: AppServer Adapter

- Implement Symphony-style JSON-RPC AppServer client.
- Add thread and turn tracking.
- Add timeout and stall detection.
- Add dynamic VibeRig tools.

### Phase 5: Orchestrator

- Add queue and concurrency control.
- Add reconciliation for stale `running` runs.
- Add cancellation.
- Add retry from `failed` or `blocked` back to `ready`.

## Immediate Change Required

The current backend must stop treating `POST /api/tasks/:task_id/runs` as validation-only execution.

The next implementation should change the run order from:

```text
create run -> prepare worktree -> run validation -> write evidence -> status transition
```

to:

```text
create run -> prepare worktree -> Codex implementation -> collect diff -> run validation -> write evidence -> status transition
```
