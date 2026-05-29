# VibeRig API

The VibeRig backend is a local-only control service for the global VibeRig
panel. It registers projects, exposes planning state, records task evidence,
exports handoff formats, and runs local task execution flows.

The service is intentionally separate from `scripts/`: scripts are setup and
debug helpers, while `api/server.py` is the long-running backend.

## Runtime

Default URL:

```text
http://127.0.0.1:49160
```

Local state:

```text
~/.viberig/
  projects.json
  viberig.sqlite
  runtime/
    daemon.json
  runs/
    <run_id>/
      codex-prompt.md
      codex-events.jsonl
      codex-transcript.md
      codex-final.md
      changed-files.txt
      diff.patch
      validation.json
      run.log
  logs/
```

Business code and task workspaces stay in each project's `worktrees/`
directory. Runtime logs and daemon state stay under `~/.viberig/`.

## Codex Runner Configuration

The backend owns task execution. A task run writes a prompt, creates a Codex
session record, runs the configured adapter inside the task worktree, captures
diffs, then executes validation.

Configuration may come from `.vibeRig/config.yaml` under
`runner.codex.*` or from environment variables:

```text
VIBERIG_CODEX_ADAPTER=codex-cli-mcp|fake
VIBERIG_CODEX_BASE_REF=origin/main
VIBERIG_CODEX_REQUIRE_FETCH_BEFORE_WORKTREE=true
VIBERIG_CODEX_MODEL=<model>
VIBERIG_CODEX_REASONING_EFFORT=medium
VIBERIG_CODEX_SANDBOX=workspace-write
VIBERIG_CODEX_FULL_AUTO=false
VIBERIG_CODEX_TURN_TIMEOUT_MS=600000
VIBERIG_CODEX_MCP_INITIALIZE_TIMEOUT_MS=60000
VIBERIG_CODEX_MCP_TOOL_TIMEOUT_MS=600000
VIBERIG_CODEX_MCP_COMMAND=npx -y codex-mcp-server
VIBERIG_CODEX_MCP_TOOL=codex
```

`codex-cli-mcp` is the default real task execution path. It starts the
`tuannvm/codex-mcp-server` Codex CLI wrapper and calls its `codex` tool with
the VibeRig session id as `sessionId` and the task worktree as
`workingDirectory`. The adapter speaks JSON-line JSON-RPC over stdio and
executes the configured `mcp_command` exactly as written. If no project or
environment model is configured, VibeRig uses the user's `$CODEX_HOME/config.toml`
`model`; if that is unavailable, it falls back to `gpt-5.5`. `fake` is
intended only for local tests and dry runs. The
previous direct `codex exec` CLI adapter is rejected for dashboard/API task
runs.

The VibeRig plugin declares its own MCP server through
`.codex-plugin/plugin.json` and `./.mcp.json`, so target project init does not
need to edit `.codex/config.toml` for VibeRig. Spawned Codex sessions can use
the plugin-provided `viberig` MCP server to read task state and record run
events:

```json
{
  "mcpServers": {
    "viberig": {
      "command": "python3",
      "args": ["./api/server.py", "mcp"],
      "cwd": "."
    }
  }
}
```

For Git projects, task worktrees are created from `runner.codex.base_ref`
(`origin/main` by default) after fetching that ref. Codex receives task input
from the backend prompt and must not modify `.vibeRig/`; the backend rejects a
run if the worktree contains `.vibeRig` changes after Codex finishes.

## Authentication

The backend binds to `127.0.0.1` and currently has no HTTP authentication. Do
not expose it on a public interface.

External integration credentials are not required for the core local task and
acceptance flow.

## Health And State

### `GET /api/health`

Returns service liveness.

```json
{"ok": true}
```

### `GET /api/state`

Returns daemon state, registered projects, and panel URL.

### `GET /api/projects`

Lists registered projects.

### `POST /api/projects/register`

Registers or updates a project.

Request:

```json
{
  "project_root": "/path/to/project",
  "project_name": "project-a",
  "plugin_root": "/path/to/plugins/vibe-rig"
}
```

### `POST /api/projects/refresh`

Refreshes imported project requirement/task state from project files.

Request:

```json
{"project_id": "project-a-abc123"}
```

### `POST /api/requirements/refresh`

Refreshes one imported requirement from its project files. Use this after
editing a selected `.vibeRig/requirements/<requirement_id>/tasks.yaml`,
`acceptance.md`, or `roadmap.md` without rescanning every requirement in the
project.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1"
}
```

Path alias:

```text
POST /api/projects/<project_id>/requirements/<requirement_id>/refresh
```

Task status is preserved when the same task id is re-imported. The importer
computes a stable definition hash from each task payload; if the definition
changes after a task has left `draft`, the task keeps its status and is marked
with `definition_stale: true` until it is reopened and rerun.

## Requirements And Board

### `POST /api/requirements/import`

Imports a requirement folder into the global service database.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_path": "/path/to/project/.vibeRig/requirements/REQ-1"
}
```

### `GET /api/requirements?project_id=<id>`

Lists imported requirements for a project.

### `GET /api/requirement?project_id=<id>&requirement_id=<requirement_id>`

Returns one requirement with tasks, acceptance items, evidence, runs, and
activity.

### `GET /api/board?project_id=<id>&requirement_id=<requirement_id>`

Returns board-oriented task columns and requirement summaries.

## Tasks And Acceptance

### `GET /api/tasks/get?project_id=<id>&requirement_id=<requirement_id>&task_id=<id>`

Returns a task payload.

### `GET /api/tasks/<task_id>/codex-sessions?project_id=<id>&requirement_id=<requirement_id>`

Returns Codex sessions for a task.

### `POST /api/tasks/update_status`

Updates task status.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_id": "task-id",
  "status": "running",
  "reason": "optional reason for ready/canceled transitions"
}
```

### `POST /api/tasks/move`

Moves a task to a different status and optional position.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_id": "task-id",
  "status": "human_review"
}
```

### `POST /api/tasks/update_order`

Persists task ordering inside a column.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_ids": ["task-a", "task-b"]
}
```

Supported task states are `draft`, `ready`, `running`, `self_accepted`,
`human_review`, `accepted`, `blocked`, `failed`, and `canceled`.
New automatic runs write self-acceptance as evidence and move completed work to
`human_review`; `self_accepted` is retained for historical compatibility.

### `GET /api/acceptance/list?project_id=<id>&requirement_id=<requirement_id>`

Lists acceptance checks for a task.

### `POST /api/acceptance/update_status`

Updates an acceptance item.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "acceptance_id": "acceptance-id",
  "status": "passed"
}
```

## Evidence And Reviews

### `GET /api/evidence/list?project_id=<id>&requirement_id=<requirement_id>&task_id=<id>`

Lists evidence attached to a task.

### `POST /api/evidence/record`

Records evidence for a task.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_id": "task-id",
  "kind": "test",
  "summary": "Unit tests passed",
  "path": "reports/test.txt"
}
```

### `POST /api/evidence/discover`

Discovers evidence from known project output paths.

Request:

```json
{"project_id": "project-a-abc123", "requirement_id": "REQ-1"}
```

### `POST /api/reviews/record_manual_review`

Records manual review outcome for a task.
Accepted manual reviews move `human_review` tasks to `accepted`. Rejected
manual reviews move the task back to `ready` for rework and require a reason in
`notes`.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_id": "task-id",
  "reviewer": "jsonlee",
  "result": "accepted",
  "notes": "Accepted"
}
```

## Runs

### `POST /api/runs/create`

Creates an execution run record.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_id": "task-id"
}
```

### `POST /api/runs/append_event`

Appends an event to a run log.

### `POST /api/runs/finish`

Marks a run as finished.

### `POST /api/runs/execute_ready_task`

Runs the Codex task execution flow for a ready task.

Request:

```json
{
  "project_id": "project-a-abc123",
  "requirement_id": "REQ-1",
  "task_id": "task-id"
}
```

### `POST /api/tasks/<task_id>/runs`

Alias used by the dashboard to start the backend-controlled run flow.

### `GET /api/runs/get_log?run_id=<id>`

Returns run log text.

### `GET /api/runs/<run_id>`

Returns run metadata, latest Codex session, and artifact paths.

### `GET /api/runs/<run_id>/events`

Returns ordered run events.

### `GET /api/runs/<run_id>/log`

Returns run log text.

### `GET /api/runs/<run_id>/diff`

Returns `diff.patch` content when present.

### `GET /api/runs/<run_id>/artifacts`

Returns prompt, transcript/events, final output, changed files, diff,
validation, and run log paths.

### `GET /api/runs/<run_id>/codex-session`

Returns the run's latest Codex session.

### `POST /api/runs/<run_id>/cancel`

Marks an active run canceled when possible and records a cancellation event.

Request:

```json
{"reason": "user canceled"}
```

## Codex Sessions

### `GET /api/codex-sessions/<session_id>`

Returns Codex session metadata.

### `GET /api/codex-sessions/<session_id>/prompt`

Returns the persisted prompt.

### `GET /api/codex-sessions/<session_id>/transcript`

Returns the captured transcript.

### `GET /api/codex-sessions/<session_id>/events`

Returns the raw or normalized Codex event stream.

### `GET /api/codex-sessions/<session_id>/final`

Returns the final Codex output.

## Exports

### `POST /api/exports/linear`

Exports task data to Linear-ready child issue markdown.

### `POST /api/exports/obsidian`

Exports requirement data to Obsidian-ready markdown.

### `POST /api/exports/lark`

Exports requirement data to Lark-ready markdown.

## Events

### `GET /api/events/stream`

Server-sent event stream for dashboard updates.

## Panel

### `GET /`

Serves the global VibeRig panel. If the dashboard frontend has been built, the
backend serves the built assets; otherwise it falls back to the inline dashboard.

## Internal CLI

`api/server.py` also exposes internal commands used by `init-viberig` and
debugging workflows:

```text
serve
ensure
register
status
stop
requirements
board
task-get
task-status
evidence-list
evidence-discover
manual-review
run-create
run-execute
run-log
run-events
run-artifacts
run-diff
codex-session
export
mcp
```

Normal users should use the panel. Skills and scripts may call these commands
when implementing initialization, diagnostics, and automated validation.
