# VibeRig Dashboard Frontend Plan

## Scope

This plan covers only the VibeRig dashboard/frontend work. The backend task engine, global SQLite runtime store, MCP service, HTTP bridge, import logic, runner, and export commands are treated as already available service capabilities.

The goal is to turn the current service-backed local panel into a focused task operating surface:

```text
Project selector -> Requirement selector -> Task kanban -> Task detail -> Acceptance review -> Run evidence
```

## Product Goals

- Make every registered project visible from a single local dashboard.
- Let the user choose a project before entering a requirement-specific task board.
- Show roadmap, task state, acceptance state, run state, and human review state without opening raw files.
- Make manual status movement and human acceptance fast and explicit.
- Keep the UI dense, operational, and repeatable rather than marketing-style.
- Use backend APIs/MCP-backed service methods for all writes. The frontend must not write files or SQLite directly.

## Non-Goals

- Do not implement backend schema, MCP tools, runner, or import logic in this plan.
- Do not add Linear, Lark, Obsidian, or external automation workflow screens.
- Do not build a graph-first interface as the primary dashboard.
- Do not make drag/drop the only way to change state; every drag action needs an equivalent explicit action.

## Frontend Architecture

Recommended first-class frontend stack:

```text
React
TypeScript
dnd-kit
CSS modules or scoped plain CSS
Service-backed HTTP/SSE client
```

The current Python-served dashboard can remain as a baseline, but the target dashboard should be organized as frontend modules rather than a large inline HTML string.

Suggested structure:

```text
dashboard/
  src/
    app/
      DashboardApp.tsx
      api.ts
      events.ts
      types.ts
    projects/
      ProjectSelector.tsx
      ProjectSummary.tsx
    requirements/
      RequirementSelector.tsx
      RequirementHeader.tsx
    board/
      TaskBoard.tsx
      TaskColumn.tsx
      TaskCard.tsx
      boardRules.ts
    task-detail/
      TaskDrawer.tsx
      TaskSummary.tsx
      ScopePanel.tsx
      DependencyPanel.tsx
      ActivityTimeline.tsx
    acceptance/
      AcceptanceMatrix.tsx
      AcceptanceChecklist.tsx
      ManualReviewForm.tsx
    runs/
      RunList.tsx
      RunLogViewer.tsx
      EvidenceList.tsx
    shared/
      EmptyState.tsx
      StatusBadge.tsx
      ToolbarButton.tsx
      ConfirmDialog.tsx
```

## Service Contract

The frontend consumes the existing HTTP bridge only. The service remains the owner of validation rules and persistence.

Required reads:

```text
GET /api/projects
GET /api/projects/:project_id/requirements
GET /api/projects/:project_id/board
GET /api/tasks/:task_id
GET /api/tasks/:task_id/acceptance
GET /api/tasks/:task_id/runs
GET /api/tasks/:task_id/evidence
GET /api/runs/:run_id/log
GET /api/events/stream
```

Required writes:

```text
POST  /api/projects/register
POST  /api/projects/:project_id/refresh
PATCH /api/tasks/:task_id/status
PATCH /api/tasks/:task_id/order
PATCH /api/acceptance/:acceptance_id/status
POST  /api/tasks/:task_id/runs
POST  /api/tasks/:task_id/manual-review
```

All frontend mutations should use optimistic UI only after the service accepts the transition rules. If the service rejects a move, the board must revert to the server state and show the rejection reason.

## Main Screens

### 1. Project Selection

Purpose: choose the active project before showing any task board.

Required UI:

- Registered project list.
- Project status indicator.
- Project root path.
- Last refresh/import time.
- Requirement count.
- Running/blocked/failed task counts.
- Register project action.
- Refresh project action.

Acceptance:

- User can see all projects registered in the global VibeRig database.
- Selecting a project loads its requirements.
- Refreshing a project updates requirement/task counts without leaving the page.

### 2. Requirement Selection

Purpose: choose which requirement board to operate.

Required UI:

- Requirement list grouped by status.
- Requirement title and id.
- Imported source revision/hash status.
- Task count and accepted count.
- Failed/blocked count.
- Last import time.

Acceptance:

- User can switch requirements without losing the selected project.
- The active requirement is reflected in the URL/query state.
- Empty project state explains that no requirements have been imported.

### 3. Task Kanban

Purpose: operate task state.

Columns:

```text
Backlog
Ready
Running
Self Accepted
Human Review
Accepted
Blocked
Failed
```

Card fields:

- Task id.
- Task title.
- Roadmap item.
- Dependency count.
- Acceptance progress.
- Latest run status.
- Human review status.
- Blocked/failed reason when present.

Interactions:

- Drag card between valid columns.
- Reorder cards within a column.
- Open task detail drawer.
- Use explicit status action menu on each card.
- Refresh board.

Acceptance:

- Drag/drop calls the service and respects backend transition rules.
- Invalid moves are rejected and visually reverted.
- Board updates from `GET /api/events/stream` while a run changes state.
- The board remains usable on narrow screens by stacking columns or switching to a compact list mode.

### 4. Task Detail Drawer

Purpose: inspect and operate one task without navigating away from the board.

Sections:

- Summary.
- Scope include/exclude.
- Dependencies.
- Validation commands.
- Acceptance checklist.
- Run history.
- Evidence files.
- Activity timeline.

Acceptance:

- Selecting a card opens the drawer.
- Drawer deep-linking works via URL query state.
- Dependencies link to their task cards/details.
- Validation commands and evidence are visible without opening local files manually.

### 5. Acceptance Matrix

Purpose: make self-acceptance and human acceptance visible.

Required UI:

- Acceptance criteria linked to the selected task.
- Result state: Not Run, Pass, Fail, Partial, Blocked.
- Evidence link or preview.
- Reviewer and review result.
- Residual risk notes.

Acceptance:

- User can see which criteria block `accepted`.
- Human review cannot submit an accepted result without required evidence unless the service allows an explicit override.
- Review submission writes through the service and updates board state.

### 6. Run Log And Evidence

Purpose: see whether a task actually executed.

Required UI:

- Run list with status, start/end time, exit code.
- Live run log viewer.
- Validation result summary.
- Changed files list.
- Self-acceptance markdown preview.
- Evidence file open/copy path action.

Acceptance:

- Logs stream or refresh without reloading the whole dashboard.
- Failed runs preserve logs and evidence.
- Successful runs show the evidence needed for review.

## Interaction Rules

- Every state-changing action must have a service-backed result.
- Drag/drop should never silently mutate local state.
- Status buttons should be available for keyboard/mouse users who do not use drag/drop.
- Long-running actions should show pending state at card and drawer level.
- Error messages should identify the failed transition and the service reason.
- The UI should not expose raw SQLite paths.
- Local file paths may be shown for evidence and project roots.

## Visual Design Direction

The dashboard is an operational tool. It should be dense, calm, and scan-friendly.

Guidelines:

- Use compact columns and cards.
- Keep cards at 8px radius or less.
- Avoid nested cards.
- Use badges for statuses and results.
- Use icons for actions like refresh, open, run, review, and more options.
- Avoid large hero areas, decorative gradients, and explanatory feature text.
- Make acceptance progress and blocked/failed state visually prominent.

Suggested layout:

```text
Top bar:
  Project selector | Requirement selector | Refresh | Register project

Main:
  Kanban columns

Right drawer:
  Task detail, acceptance, runs, evidence, review
```

## Frontend Task Breakdown

### FE-1: Frontend Project Scaffold

Goal: create a maintainable dashboard frontend structure.

Tasks:

- Add a dashboard source directory.
- Add TypeScript types for project, requirement, task, acceptance, run, evidence, and activity.
- Add an API client wrapping the service HTTP endpoints.
- Add an event client for `GET /api/events/stream`.
- Add loading, error, and empty state primitives.

Validation:

- Frontend can fetch project list.
- TypeScript catches missing service fields.
- Event stream reconnects after transient disconnects.

### FE-2: Project And Requirement Navigation

Goal: make project selection the first dashboard step.

Tasks:

- Build `ProjectSelector`.
- Build `RequirementSelector`.
- Add URL query state for selected project and requirement.
- Add project refresh action.
- Add empty states for no projects and no imported requirements.

Validation:

- Selecting a project loads requirements.
- Selecting a requirement loads the board.
- Page reload preserves current project/requirement from URL.

### FE-3: Kanban Board

Goal: make task state visible and operable.

Tasks:

- Build `TaskBoard`, `TaskColumn`, and `TaskCard`.
- Add status columns.
- Add card sorting by service-provided order.
- Add `dnd-kit` drag/drop.
- Add explicit card status menu.
- Add invalid move handling.

Validation:

- Cards render in the correct columns.
- Reordering persists through the service.
- Moving cards between columns respects service transition rules.
- Invalid moves revert cleanly with an error message.

### FE-4: Task Detail Drawer

Goal: show the full task contract from the board.

Tasks:

- Build drawer shell.
- Render task summary, scope, dependencies, validation commands, and activity.
- Link dependencies to other tasks.
- Add drawer URL query state.

Validation:

- Clicking a card opens detail.
- Drawer data refreshes after board updates.
- Deep links open the expected task.

### FE-5: Acceptance And Review UI

Goal: make acceptance status and human review explicit.

Tasks:

- Build acceptance matrix.
- Build evidence-linked checklist.
- Build manual review form.
- Show backend guardrail failures.
- Update task state after review submission.

Validation:

- Acceptance criteria display correctly for each task.
- Review submission records reviewer/result/notes.
- Accepted state requires service-approved review.

### FE-6: Run And Evidence UI

Goal: make execution visible.

Tasks:

- Build run history.
- Build live run log viewer.
- Build evidence list and preview.
- Add changed files display.
- Add run trigger action if the backend exposes it.

Validation:

- Running tasks update from the event stream.
- Failed and successful runs show logs.
- Evidence is visible from the task drawer.

### FE-7: Responsive And Accessibility Pass

Goal: make the dashboard usable across desktop and smaller windows.

Tasks:

- Add responsive column layout.
- Add compact list fallback for narrow widths.
- Add keyboard reachable status actions.
- Add focus management for the drawer.
- Add readable contrast for status badges.

Validation:

- No text overlaps in common desktop and mobile widths.
- Drag/drop alternatives are available via buttons/menus.
- Drawer focus returns to the selected card when closed.

## Frontend Acceptance Checklist

- Project selector appears before a board is shown.
- Requirement selector is scoped to the active project.
- Board shows all task states and counts.
- Task cards show acceptance progress and latest run status.
- Drag/drop and explicit status actions both work.
- Invalid transitions are rejected with service reasons.
- Task detail shows scope, dependencies, acceptance, runs, evidence, and activity.
- Human review can be completed from the dashboard.
- Live run changes update without a full page reload.
- Dashboard does not write files or SQLite directly.

## Delivery Order

```text
FE-1 scaffold
FE-2 project/requirement navigation
FE-3 kanban board
FE-4 task drawer
FE-5 acceptance/review
FE-6 runs/evidence
FE-7 responsive/accessibility
```

This plan intentionally starts with the project selector and board because those are the user-facing control plane. Runner automation and external integrations can stay behind the service while the dashboard becomes the main workflow surface.

## Completion Status

Completed on 2026-05-28.

- FE-1 complete: added `dashboard/` Vite + React + TypeScript scaffold, service API client, SSE client, typed project/requirement/task/acceptance/run/evidence/activity models, and shared UI primitives.
- FE-2 complete: added project selector, requirement selector, URL query state, project refresh/register actions, and empty states.
- FE-3 complete: added dnd-kit powered kanban columns, task cards, explicit status controls, run action, service-backed ordering controls, and rejection/error rollback through server reload.
- FE-4 complete: added task detail drawer with summary, scope, dependencies, validation commands, activity timeline, and task deep links.
- FE-5 complete: added acceptance matrix, checklist status update, manual review form, evidence selection, and backend guardrail error display.
- FE-6 complete: added run history, polling run log viewer, evidence list with copy-path action, evidence discovery, and run trigger integration.
- FE-7 complete: added responsive board/drawer layout, narrow-width stacking, keyboard reachable buttons/selects, and status badge contrast classes.
- Service integration complete: `api/server.py` now serves `dashboard/dist` when built, keeps the existing inline dashboard as fallback, and exposes REST-style aliases matching this plan while preserving the existing HTTP bridge.

Validation accepted:

```text
python3 -B -m py_compile api/server.py tests/test_viberig_task_engine.py
python3 -B -m unittest tests.test_viberig_task_engine
npm --prefix dashboard run typecheck
npm --prefix dashboard run build
```
