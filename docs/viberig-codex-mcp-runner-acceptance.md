# VibeRig Codex MCP Runner Acceptance

Date: 2026-05-28

## Scope

These acceptance criteria cover replacing the default real Codex execution path with `tuannvm/codex-mcp-server`.

The goal is durable Codex session traceability across projects and task runs. Real-time dashboard streaming is not required for acceptance.

## Acceptance Rule

A run is accepted only if VibeRig can answer this from persisted data:

```text
Which project/worktree did Codex run in, which Codex thread implemented the task, what prompt was sent, what final response returned, what changed, and how did VibeRig decide the final task status?
```

## AC-1: MCP Adapter Uses Current Codex MCP Protocol

Checks:

- Adapter starts `npx -y codex-mcp-server` or configured equivalent.
- Adapter sends MCP `initialize`.
- Adapter calls `tools/call` with `name: codex`.
- Tool arguments use current protocol keys:
  - `prompt`
  - `sessionId`
  - `workingDirectory`
  - `sandbox`
  - optional `model`
  - optional `reasoningEffort`
  - optional `fullAuto`
- Adapter does not use official `codex mcp-server` keys such as `cwd`, `approval-policy`, or `config` for the Codex CLI MCP wrapper path.

Evidence:

- Unit test with a fake MCP server asserting exact `tools/call` payload.
- Run log showing `codex mcp invocation`.

## AC-2: Worktree Is Passed As `workingDirectory`

Checks:

- For every task run, `workingDirectory` equals the task worktree path.
- `workingDirectory` is absolute.
- `workingDirectory` is not the plugin root.
- `workingDirectory` is not the main project checkout unless the run explicitly uses the main checkout as its worktree.
- Prompt includes the same worktree path for auditability.

Evidence:

- Fake MCP server test captures `arguments.workingDirectory`.
- Run record stores `worktree_path`.
- `codex-prompt.md` includes `worktree_path`.

## AC-3: Multi-Project Support

Checks:

- The same backend process can run tasks for at least two registered projects.
- Each MCP tool call passes that project's task worktree as `workingDirectory`.
- Returned Codex `threadId` values are stored on the correct project/task/run.
- Looking up sessions for project A does not return project B sessions.

Evidence:

- Integration test with two temporary project roots.
- API responses for each project's task sessions.

## AC-4: Codex `threadId` Is Persisted

Checks:

- MCP response `structuredContent.threadId` is stored as `codex_sessions.thread_id`.
- If only `content` is returned, final content is still persisted and the missing `threadId` is treated as adapter failure or degraded mode according to policy.
- Session metadata links:
  - project id;
  - requirement id;
  - task id;
  - run id;
  - adapter;
  - worktree path;
  - prompt path;
  - final path.

Evidence:

- `GET /api/runs/:run_id/codex-session` shows `adapter: codex-cli-mcp` and non-empty `thread_id`.
- SQLite query confirms persisted row after backend restart.

## AC-5: Run API Is Background-Oriented

Checks:

- `POST /api/tasks/:task_id/runs` creates a run and returns without waiting for Codex completion.
- Response includes `run.id`.
- Task moves to `running`.
- Run status moves through `created`, `preflight`, `workspace_ready`, `codex_running`, and a terminal status.
- A long Codex task does not block the HTTP handler thread until completion.

Evidence:

- HTTP test using fake slow MCP server.
- Browser network trace showing quick response.
- Polling `GET /api/runs/:run_id` shows progress.

## AC-6: AI Stages Use VibeRig MCP For State And Review

Checks:

- VibeRig plugin `.codex-plugin/plugin.json` declares `mcpServers: "./.mcp.json"`.
- VibeRig plugin `.mcp.json` exposes `viberig` with `python3 ./api/server.py mcp`.
- Target project initialization does not write `[mcp_servers.viberig]` into business project `.codex/config.toml`.
- The `codex-cli-mcp` provider adapter is not configured as a project MCP server.
- Stage prompts require `viberig.tasks.get` and `viberig.runs.get` before acting.
- Stage prompts require `viberig.runs.append_event` for stage progress.
- Acceptance review requires `viberig.acceptance.update_status` for linked acceptance criteria.
- Acceptance review requires `viberig.reviews.record_manual_review` exactly once.
- Backend runner verifies the DB review result before finishing success.
- Successful implementation, test authoring, automated validation, and AI acceptance review move the task to `accepted`.
- Manual validation items do not make the run fail by themselves.
- Failed MCP response moves task/run to failed or blocked with an error summary.

Evidence:

- Unit tests for success, MCP error, timeout, manual validation, and AI accepted review.
- Run events show `development`, `test_authoring`, `validating`, and `acceptance_review` phases.
- Manual review row has a Codex reviewer name.

## AC-7: Artifacts Are Persisted

Checks:

- `codex-prompt.md` is written before MCP call.
- MCP response is written to `codex-final.md`.
- Raw MCP request/response or normalized events are written to `codex-events.jsonl`.
- Transcript file is created even if it only contains final MCP content.
- Artifact paths are retrievable through HTTP.

Evidence:

- `GET /api/codex-sessions/:session_id/prompt`
- `GET /api/codex-sessions/:session_id/events`
- `GET /api/codex-sessions/:session_id/final`

## AC-8: Follow-Up Session Can Be Designed From Stored Data

Checks:

- Session records contain enough data to resume through the configured provider later.
- The stored keys include VibeRig `codex_session_id` and native Codex `thread_id` when available.
- Provider follow-up design uses:

```json
{
  "sessionId": "<stored codex_session_id>",
  "prompt": "<follow-up prompt>"
}
```

Evidence:

- Design-level test or documented manual test using a stored VibeRig session id or native `threadId` fallback.
- No requirement to ship the reply endpoint in the initial MCP adapter milestone.

## AC-9: CLI Adapter Is Not Used For Real Runs

Checks:

- Dashboard/API task execution does not use `codex exec`.
- `runner.codex.adapter: cli` is not accepted for real runs.
- Any remaining CLI-only code is removed or unreachable from the run API.
- Tests do not require live Codex.
- Fake adapter remains explicit in tests.

Evidence:

- Unit or integration test asserts the run API selects `mcp`.
- Static search or code review confirms no dashboard/API run path invokes `codex exec`.
- Existing fake adapter tests pass.

## AC-10: Dashboard Can Inspect Sessions

Checks:

- After starting a run from dashboard, user can inspect:
  - run id;
  - run status;
  - adapter;
  - Codex session id;
  - Codex `threadId`;
  - worktree path;
  - prompt/final artifacts.
- Dashboard does not need real-time token streaming for acceptance.
- Dashboard can poll run/session endpoints.

Evidence:

- Browser test starts a task run.
- Network trace shows run creation returns quickly.
- Task detail or run log view shows session metadata.

## AC-11: Dashboard Shows Current Running Phase

Checks:

- Task cards in `running` state show the latest run phase, not only generic `running`.
- Run lists show both terminal run status and current `implementation_status`.
- Phases include development, test authoring, validation, self-acceptance, and acceptance review.

Evidence:

- Dashboard production build succeeds.
- Browser/manual check shows a running task phase label.

## Manual Acceptance Script

1. Start VibeRig service.
2. Register or refresh a project.
3. Move a task to `ready`.
4. Start the task run from dashboard.
5. Confirm the HTTP request returns quickly with a `run.id`.
6. Poll `GET /api/runs/:run_id` until `codex_session` exists.
7. Confirm `codex_session.adapter == "codex-cli-mcp"`.
8. Confirm `codex_session.thread_id` is non-empty.
9. Confirm `codex_session.prompt_path` exists.
10. Confirm `run.worktree_path` matches the expected task worktree.
11. Confirm final run status and task status match validation and AI acceptance outcome.

## Deferred Acceptance

These are useful but not required for the first MCP migration:

- Real-time progress notifications from Codex MCP.
- Dashboard button to continue a session through the configured Codex provider.
- Codex Desktop deep link to open the stored `threadId`.
- Shared long-lived MCP server process pool.
