# VibeRig Codex MCP Runner Design

Date: 2026-05-28

## Goal

Use `tuannvm/codex-mcp-server` as the default real Codex execution adapter for VibeRig task runs.

The primary requirement is not real-time log streaming. The primary requirement is durable session traceability:

- each VibeRig run starts Codex against the correct task worktree;
- Codex receives the same project context it would receive when run directly in that directory;
- VibeRig stores the returned Codex `threadId`;
- users can locate the Codex session by project, task, run, and worktree path.

## Current Problem

The previous direct CLI approach ran:

```bash
codex exec --json --cd <task-worktree>
```

This works for implementation, but it is shaped like a one-shot command. It can produce JSONL output and an exit code, but VibeRig has to infer session identity from CLI output. That is not the desired long-term architecture, so the CLI execution path should be removed from real task execution instead of retained as a fallback.

For the dashboard and backend task engine, the better model is:

```text
VibeRig run -> Codex session -> Codex threadId -> optional follow-up turns
```

VibeRig uses an MCP adapter boundary, but the default Codex provider is the
`tuannvm/codex-mcp-server` wrapper. That server exposes MCP tools and executes
Codex through `codex exec` under the hood.

## Codex MCP Capability

`codex-mcp-server` runs as a stdio MCP server.

The tool VibeRig uses is:

- `codex`: starts or resumes a Codex CLI session.

The `codex` tool accepts:

```json
{
  "prompt": "string",
  "sessionId": "string",
  "workingDirectory": "string",
  "sandbox": "read-only | workspace-write | danger-full-access",
  "model": "optional model",
  "reasoningEffort": "optional reasoning effort",
  "fullAuto": false
}
```

The result may include `threadId` in `structuredContent` when enabled, or in
the first content item's `_meta` object. VibeRig must persist whichever native
Codex id is available and always preserve the full MCP response in
`codex-events.jsonl`.

```json
{
  "structuredContent": {
    "threadId": "019bbb20-bff6-7130-83aa-bf45ab33250e"
  },
  "content": [
    {"type": "text", "text": "final response text", "_meta": {"threadId": "019bbb20-bff6-7130-83aa-bf45ab33250e"}}
  ]
}
```

## Project Directory Semantics

The `workingDirectory` argument is the key project isolation boundary.

For each task run, VibeRig must pass the task worktree as `workingDirectory`:

```json
{
  "workingDirectory": "/Users/jsonlee/Projects/hermes-desktop/worktrees/career-ops-p1-T1"
}
```

This should give Codex the same project-local context as running Codex directly in that directory:

```bash
codex exec --cd /Users/jsonlee/Projects/hermes-desktop/worktrees/career-ops-p1-T1
```

Expected project-local context includes:

- repository files;
- git state;
- project-level instructions and rules discovered from the working directory;
- the task worktree as the write boundary.

The MCP server process may be shared across projects. Project identity comes from each tool call's `workingDirectory`, not from the MCP server process start directory.

## Recommended Architecture

```text
Dashboard
  POST /api/tasks/:task_id/runs
  GET /api/runs/:run_id
  GET /api/runs/:run_id/codex-session

VibeRig API
  Creates run row
  Marks task running
  Starts background run worker
  Persists run events, artifacts, Codex session metadata

Run Worker
  Prepares task worktree
  Writes implementation, test-authoring, and acceptance-review prompts
  Calls Codex MCP tool `codex` for each AI stage
  Stores structuredContent.threadId
  Collects diff and validation evidence
  Requires Codex acceptance review to update VibeRig MCP acceptance/review records
  Moves task to accepted, failed, blocked, or canceled

Codex MCP Server
  codex(prompt, sessionId, workingDirectory, sandbox, model, reasoningEffort, fullAuto)
```

## Run Flow

1. Dashboard calls `POST /api/tasks/:task_id/runs`.
2. Backend validates the task is `ready`.
3. Backend creates a `runs` row and `codex_sessions` placeholder.
4. Backend returns immediately with `run_id`.
5. Background worker prepares the worktree.
6. Worker writes the exact prompt to `codex-prompt.md`.
7. Worker calls MCP:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "codex",
      "arguments": {
        "prompt": "<codex-prompt.md>",
        "sessionId": "<viberig-codex-session-id>",
        "workingDirectory": "<task-worktree>",
        "sandbox": "workspace-write",
        "model": "<optional>",
        "reasoningEffort": "<optional>"
      }
  }
}
```

8. Worker stores:

- VibeRig `codex_session_id`;
- Codex `threadId`;
- project id;
- requirement id;
- task id;
- run id;
- worktree path;
- prompt path;
- transcript/final/event artifact paths.

9. Worker collects changed files and diff from the worktree.
10. Worker starts a Codex test-authoring stage so AI can add or update focused tests for the task.
11. Worker runs validation commands from the DB-synced task definition.
12. Worker writes validation and self-acceptance evidence.
13. Worker starts a Codex acceptance-review stage.
14. The acceptance-review stage must use the VibeRig MCP server to update acceptance item status and record an accepted or rejected review.
15. Worker checks the DB review result and updates final task/run status.

## VibeRig MCP Contract Inside Codex

The task markdown files remain import/sync inputs. After sync, the VibeRig backend database is the operational source of truth.

Each Codex stage can use VibeRig's own MCP server from the installed VibeRig plugin. The plugin manifest declares `mcpServers: "./.mcp.json"` and the MCP manifest exposes the backend stdio command:

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

The `codex-cli-mcp` provider adapter is configured in `.vibeRig/config.yaml`, not inside `.codex/config.toml`; the VibeRig backend calls that adapter directly. Target project initialization must not write VibeRig MCP settings into the business project's Codex config.

Every stage prompt tells Codex to use VibeRig MCP for:

- task lookup: `viberig.tasks.get`;
- run lookup/events: `viberig.runs.get`, `viberig.runs.append_event`;
- acceptance updates: `viberig.acceptance.update_status`;
- evidence records: `viberig.evidence.record`;
- AI acceptance review: `viberig.reviews.record_manual_review`.

Codex must not update state by editing `.vibeRig/` files or SQLite files.

## Run Stages

VibeRig exposes the current run phase through `runs.implementation_status`.

Expected stage sequence:

```text
created
preflight
workspace_ready
development
codex_completed
test_authoring
test_authoring_completed
validating
self_acceptance_written
acceptance_review
acceptance_review_completed
success
```

Failure phases include `codex_failed`, `validation_failed`, `acceptance_failed`, and terminal `failed`.

The dashboard should show the current phase for tasks in `running` state and in run lists.

## Session Lookup

VibeRig should support these lookup paths:

- `GET /api/runs/:run_id/codex-session`
- `GET /api/tasks/:task_id/codex-sessions?project_id=...&requirement_id=...`
- `GET /api/codex-sessions/:session_id`
- `GET /api/codex-sessions/:session_id/prompt`
- `GET /api/codex-sessions/:session_id/transcript`
- `GET /api/codex-sessions/:session_id/events`
- `GET /api/codex-sessions/:session_id/final`

The dashboard should show at least:

- adapter: `codex-cli-mcp`;
- VibeRig session id;
- Codex `threadId`;
- run id;
- task id;
- worktree path;
- prompt and final artifact links.

## Continue Session

Add a follow-up endpoint only after the initial MCP adapter is stable:

```text
POST /api/codex-sessions/:session_id/reply
```

Request:

```json
{
  "prompt": "Continue or fix this task..."
}
```

Backend behavior:

1. Load VibeRig `codex_session_id` and native Codex `threadId` from `codex_sessions`.
2. Call the configured provider tool with the VibeRig session id, or fall back to native Codex resume if the provider's in-memory session is gone.
3. Persist the returned content as a new session event or turn artifact.
4. Do not overwrite the original prompt/final files.

## Configuration

Project config should support:

```yaml
runner:
  codex:
    adapter: codex-cli-mcp
    mcp_command: npx -y codex-mcp-server
    mcp_tool: codex
    enable_features:
      - hooks
    sandbox: workspace-write
    full_auto: false
    # Optional. When omitted, VibeRig uses $CODEX_HOME/config.toml model, then gpt-5.5.
    model: null
    mcp_initialize_timeout_ms: 60000
    mcp_tool_timeout_ms: 600000
    turn_timeout_ms: 600000
```

The adapter speaks JSON-line JSON-RPC over stdio to `tuannvm/codex-mcp-server`.
The backend executes the configured `mcp_command` exactly as written.

Environment overrides:

```text
VIBERIG_CODEX_ADAPTER=codex-cli-mcp
VIBERIG_CODEX_MCP_COMMAND="npx -y codex-mcp-server"
VIBERIG_CODEX_MCP_TOOL=codex
VIBERIG_CODEX_MODEL=<optional>
VIBERIG_CODEX_REASONING_EFFORT=<optional>
VIBERIG_CODEX_SANDBOX=workspace-write
VIBERIG_CODEX_FULL_AUTO=false
VIBERIG_CODEX_MCP_INITIALIZE_TIMEOUT_MS=60000
VIBERIG_CODEX_MCP_TOOL_TIMEOUT_MS=600000
VIBERIG_CODEX_TURN_TIMEOUT_MS=600000
```

## Adapter Strategy

Recommended adapter policy:

1. `codex-cli-mcp`: the only real execution path.
2. `fake`: tests and dry-run only.

The current `tuannvm/codex-mcp-server` adapter does not expose Codex CLI feature-flag passthrough. VibeRig records `runner.codex.enable_features` for future adapters, but hooks are actively enabled by ensuring `[features].hooks = true` in the target project `.codex/config.toml` and, when needed, the task worktree config.

The previous `cli` adapter should be removed from dashboard/API task execution. If local diagnostics need direct Codex execution, they should use explicit developer commands outside the VibeRig runner path.

## Differences From Direct Codex

Direct one-shot execution:

```bash
codex exec --json --cd <worktree>
```

- one-shot process;
- easy stdout/stderr capture;
- weaker durable session semantics;
- resume/session identity must be inferred from output.

MCP adapter:

```text
npx -y codex-mcp-server
tools/call codex({ prompt, sessionId, workingDirectory, ... })
```

- MCP wrapper around `codex exec`;
- VibeRig-managed session id plus native `threadId` when available;
- follow-up through the provider session id with native Codex resume as fallback;
- better fit for dashboard session tracking;
- project context still comes from `workingDirectory`.

## Non-Goals

- Real-time token streaming in dashboard.
- Replacing VibeRig's task state machine with Codex state.
- Allowing Codex to update VibeRig task status directly.
- Sharing one Codex thread across unrelated task runs.

## Open Questions

- Whether to run one MCP server process globally or one per run.
- Whether Codex MCP emits useful progress notifications for long-running turns.
- Whether follow-up turns should run in the original worktree or a newly prepared worktree.
- How to expose Codex thread links in Codex Desktop, if the app provides a URI or lookup surface.
