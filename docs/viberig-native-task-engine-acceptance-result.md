# VibeRig Native Task Engine Acceptance Result

Date: 2026-05-28

## Scope Accepted In This Pass

- Local SQLite control database at `~/.viberig/viberig.sqlite`.
- Project registration mirrored into SQLite with project status, config path, and timestamps.
- Requirement import from `.vibeRig/requirements/<id>/tasks.yaml`.
- Roadmap import from `roadmap.md`.
- Source hashes for `tasks.yaml`, `roadmap.md`, and `acceptance.md`.
- Task board read model grouped by status columns.
- Task dependency guard for moving tasks to `ready`.
- Blocked or failed tasks require a reason before returning to `ready`.
- Canceled tasks require an explicit reason.
- Self-acceptance evidence guard for moving tasks to `self_accepted`.
- Manual review guard for moving tasks to `accepted`.
- HTTP endpoints for project, requirement, board, task detail, task status/order, acceptance, evidence, review, run, export, and event stream operations.
- CLI commands for refresh, requirements, board, task detail, task status, evidence, runs, and exports.
- MCP stdio JSON-RPC entrypoint exposing the planned VibeRig tools and resources.
- Dashboard project selector, requirement selector, kanban columns, native drag/drop, task detail drawer, evidence, manual review, run log, and export controls.
- Evidence discovery from `.vibeRig/requirements/<id>/evidence/<task_id>/`.
- Optional local runner that creates run rows, run logs, run SQLite files, validation evidence, self-acceptance files, and task status updates.
- Optional Linear markdown dry-run export, Obsidian dashboard export, and Lark JSON report export.

## Validation Commands

```sh
python3 -m py_compile api/server.py tests/test_viberig_task_engine.py
python3 -m unittest tests.test_viberig_task_engine
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' | PYTHONDONTWRITEBYTECODE=1 python3 api/server.py mcp
PYTHONDONTWRITEBYTECODE=1 python3 api/server.py --help
```

Result: PASS

## Automated Scenarios

The tests create temporary VibeRig projects with one requirement and two tasks:

- Imports `tasks.yaml` and `acceptance.md`.
- Imports `roadmap.md` and source revision hashes.
- Confirms both tasks and acceptance items appear on the board.
- Confirms re-import preserves existing task state.
- Confirms a dependent task cannot move to `ready` before its dependency is accepted.
- Records self-acceptance evidence.
- Confirms a task cannot move to `accepted` without an accepted manual review.
- Records an accepted manual review.
- Confirms the dependent task can then move to `ready`.
- Discovers evidence files from the requirement evidence directory.
- Renders task detail, evidence, activity, and review state.
- Runs a ready task through the optional local runner and confirms generated evidence.
- Confirms MCP tool/resource calls return board state.
- Confirms HTTP board and event stream endpoints return consistent state.
- Confirms export outputs can be generated from local state.

## Residual Notes

- The dashboard is implemented as the native local panel served by the Python service. It uses service-backed selectors, native drag/drop, and detail controls rather than adding a separate frontend build pipeline.
- Linear, Obsidian, Lark, and external integrations remain optional integrations. The accepted core workflow does not require credentials for any external system.
