# VibeRig Native Task Engine Design

## Background

VibeRig currently produces strong local requirement artifacts:

- `requirement.md`
- `research.md`
- `spec.md`
- `roadmap.md`
- `acceptance.md`
- `plan.md`
- `tasks.yaml`

The current external issue-runner route has a structural gap: local requirement and acceptance files are the real source of truth, but execution depends on external Linear issue discovery and external integrations runner state. When Linear state, project slug, issue metadata, or runner connectivity is wrong, the user cannot clearly see whether a task is queued, running, blocked, self-accepted, or waiting for manual acceptance.

The proposed direction is to make VibeRig itself the local task and acceptance control plane. External systems such as Linear, Obsidian, Lark, GitHub Issues, or external integrations are not part of the default path. They can exist later as one-way export or read-only mirror integrations, but the core workflow must not depend on them.

## Goals

- Show roadmap, tasks, task state, acceptance criteria, and execution evidence in one local dashboard.
- Keep requirement and task definition files readable and versionable.
- Store frequently changing runtime state in SQLite rather than rewriting Markdown.
- Support manual task state transitions first, then add local runner automation.
- Make self-acceptance and human acceptance explicit and visible.
- Keep future Linear, Obsidian, Lark, GitHub Issues, or external integrations support outside the core path as optional export/mirror integrations.

## Non-Goals

- Do not rebuild a full project management suite.
- Do not make Linear, Lark, Obsidian, or external integrations required for core execution.
- Do not store long logs or runtime noise directly in `tasks.yaml`.
- Do not require graph visualization as the primary UI. A kanban-style board is the first-class workflow.

## Recommended Architecture

```text
VibeRig Dashboard
  React UI
  Project selector
  Kanban board
  Task details
  Acceptance review
  Run logs

VibeRig Service
  MCP server for agents and CLI
  HTTP/WebSocket bridge for the browser dashboard
  Reads requirement artifacts
  Owns global SQLite runtime state
  Serves dashboard data

VibeRig Runner
  Optional local executor
  Creates worktrees
  Starts Codex tasks
  Captures logs
  Writes evidence

Optional export/mirror integrations
  Linear issue mirror
  Obsidian read-only view
  Lark team report
  External automation bridge
```

The core invariant:

```text
Markdown/YAML = source-of-truth definitions
Global SQLite = runtime state and board state
evidence files = human-readable execution proof
external tools = optional mirrors, never the default state owner
```

## File Layout

```text
~/.viberig/
  viberig.sqlite
  projects.json
  logs/
  runs/
  exports/
    linear/
    obsidian/
    lark/

<project-root>/
  .vibeRig/
    config.yaml
    requirements/
      <requirement_id>/
        requirement.md
        research.md
        spec.md
        roadmap.md
        acceptance.md
        plan.md
        tasks.yaml
        evidence/
          <task_id>/
            self-acceptance.md
            validation.json
            run.log
            changed-files.txt
            human-review.md
```

`~/.viberig/viberig.sqlite` is the global runtime database for every local project. It is not part of any project repository and should never be synchronized through Git. Project `.vibeRig/` directories keep source artifacts and accepted evidence only. External export metadata lives under `~/.viberig/exports/` and is optional.

## Data Model

Minimum SQLite tables:

```sql
projects (
  id text primary key,
  name text not null,
  root text not null unique,
  config_path text,
  status text not null,
  created_at text not null,
  updated_at text not null
);

requirements (
  id text primary key,
  project_id text not null,
  title text not null,
  path text not null,
  status text not null,
  created_at text not null,
  updated_at text not null
);

roadmap_items (
  id text primary key,
  project_id text not null,
  requirement_id text not null,
  title text not null,
  description text,
  order_index integer not null,
  status text not null
);

tasks (
  id text primary key,
  project_id text not null,
  requirement_id text not null,
  roadmap_item_id text,
  title text not null,
  description text,
  status text not null,
  priority integer,
  branch text,
  worktree_path text,
  order_index integer not null,
  created_at text not null,
  updated_at text not null
);

task_dependencies (
  project_id text not null,
  task_id text not null,
  depends_on_task_id text not null,
  primary key (task_id, depends_on_task_id)
);

acceptance_items (
  id text primary key,
  project_id text not null,
  requirement_id text not null,
  title text not null,
  description text,
  source_ref text,
  status text not null
);

task_acceptance_links (
  project_id text not null,
  task_id text not null,
  acceptance_item_id text not null,
  primary key (task_id, acceptance_item_id)
);

runs (
  id text primary key,
  project_id text not null,
  task_id text not null,
  status text not null,
  worktree_path text,
  started_at text,
  finished_at text,
  log_path text,
  command text,
  exit_code integer
);

evidence (
  id text primary key,
  project_id text not null,
  task_id text not null,
  acceptance_item_id text,
  result text not null,
  path text not null,
  created_at text not null
);

manual_reviews (
  id text primary key,
  project_id text not null,
  task_id text not null,
  reviewer text,
  result text not null,
  notes text,
  created_at text not null
);

activity_events (
  id text primary key,
  project_id text,
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  payload_json text,
  created_at text not null
);
```

## Task States

Initial status model:

```text
draft
ready
running
self_accepted
human_review
accepted
blocked
failed
canceled
```

Suggested transitions:

```text
draft -> ready
ready -> running
running -> self_accepted
self_accepted -> human_review
human_review -> accepted

ready -> blocked
running -> failed
failed -> ready
blocked -> ready
```

Rules:

- A task cannot move to `ready` if required dependencies are not `accepted` or explicitly waived.
- A task cannot move to `self_accepted` unless validation evidence exists.
- A task cannot move to `accepted` unless manual review passes or the task is explicitly marked as auto-acceptable.
- Any transition should write an `activity_events` record.

## Frontend Design

The first UI should be a kanban-style task board, not a graph-first view.

Recommended stack:

- React for the dashboard.
- `dnd-kit` for sortable multi-column drag and drop.
- VibeRig service-backed API for state.
- WebSocket or server-sent events for live runner updates.

`dnd-kit` is preferred over `interact.js` for the core kanban because it is React-oriented and has sortable list primitives. `interact.js` remains useful for future freeform layout, resizable panels, or advanced drag/drop zones.

Avoid the deprecated `react-beautiful-dnd` path. Atlassian has archived it and moved toward newer drag/drop approaches.

Dashboard hierarchy:

```text
Project Selector
  -> Requirement Selector
    -> Task Kanban
      -> Task Detail Drawer
      -> Acceptance Review Panel
      -> Run Log Panel
```

The project selector is first-class. VibeRig is a global local service, so the dashboard should not assume one active project. Each project owns its own requirement documents and evidence files, while the global SQLite database owns runtime state for all projects.

Board columns:

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

Task card content:

```text
Task id
Task title
Roadmap item
Dependency count
Acceptance progress
Latest run status
Manual review status
```

Task detail drawer:

```text
Summary
Scope include/exclude
Dependencies
Acceptance checklist
Validation commands
Runs
Evidence files
Manual review controls
Activity history
```

## Service Interface

The primary interface should be MCP. The browser dashboard can use a thin HTTP/WebSocket bridge that calls the same service methods internally.

Recommended backend language:

- Python for the first implementation.
- Reason: VibeRig already uses Python scripts, Python has strong SQLite support, and MCP server implementation is straightforward.
- Revisit TypeScript only if the dashboard and service need to share a large validation/schema layer.

MCP tools:

```text
viberig.projects.list
viberig.projects.register
viberig.projects.refresh

viberig.requirements.list
viberig.requirements.import
viberig.requirements.get

viberig.board.get
viberig.tasks.get
viberig.tasks.move
viberig.tasks.update_status
viberig.tasks.update_order

viberig.acceptance.list
viberig.acceptance.update_status

viberig.runs.create
viberig.runs.append_event
viberig.runs.finish
viberig.runs.get_log

viberig.evidence.list
viberig.evidence.record
viberig.reviews.record_manual_review
```

MCP resources:

```text
viberig://projects
viberig://projects/{project_id}
viberig://projects/{project_id}/requirements
viberig://requirements/{requirement_id}
viberig://requirements/{requirement_id}/board
viberig://tasks/{task_id}
viberig://tasks/{task_id}/acceptance
viberig://tasks/{task_id}/runs
viberig://runs/{run_id}/log
```

HTTP/WebSocket bridge for the dashboard:

```text
GET    /api/projects
POST   /api/projects/register
POST   /api/projects/:project_id/refresh

GET    /api/projects/:project_id/requirements
POST   /api/projects/:project_id/requirements/:id/import

GET    /api/projects/:project_id/board
GET    /api/tasks/:task_id
PATCH  /api/tasks/:task_id/status
PATCH  /api/tasks/:task_id/order

GET    /api/tasks/:task_id/acceptance
PATCH  /api/acceptance/:acceptance_id/status

GET    /api/tasks/:task_id/runs
POST   /api/tasks/:task_id/runs
GET    /api/runs/:run_id/log

GET    /api/tasks/:task_id/evidence
POST   /api/tasks/:task_id/manual-review

GET    /api/events/stream
```

The import tool parses `tasks.yaml`, `roadmap.md`, and `acceptance.md`, then upserts stable records into the global SQLite database. It should preserve runtime state when source files change.

## Import Rules

The parser should treat `tasks.yaml` as the canonical task definition.

On import:

- Create missing task records.
- Update title, scope, validation, roadmap mapping, and acceptance links.
- Preserve existing runtime status unless the task definition was deleted or materially changed.
- Mark deleted tasks as `canceled` or `archived` rather than immediately dropping rows.
- Compute file hashes for `tasks.yaml`, `acceptance.md`, and `roadmap.md`.

Recommended source revision table:

```sql
source_revisions (
  id text primary key,
  project_id text not null,
  requirement_id text not null,
  source_path text not null,
  git_commit text,
  sha256 text not null,
  captured_at text not null
);
```

## SQLite Ownership

SQLite is local runtime state. It should not be synchronized through Git and should not be edited directly from worktrees.

There are two database roles:

```text
Global control database
  Path: ~/.viberig/viberig.sqlite
  Owner: VibeRig service
  Scope: all registered local projects
  Purpose: project registry, board state, task state, run records, acceptance status, review status, activity events
  Git: ignored

Worktree run database
  Path: ~/.viberig/runs/<run_id>/run.sqlite
  Owner: the local runner process for that worktree
  Purpose: temporary run logs, command events, self-acceptance draft, offline buffering
  Git: ignored
```

Normal operation:

```text
Dashboard -> HTTP bridge -> VibeRig service -> global control database
CLI/Agent -> MCP -> VibeRig service -> global control database
Runner -> MCP or HTTP -> VibeRig service -> global control database
Runner -> evidence files -> Git worktree
```

The worktree should not open or mutate the global database. It reports status through MCP or the local HTTP bridge using `VIBERIG_SERVICE_URL`, `VIBERIG_PROJECT_ID`, `VIBERIG_RUN_ID`, and `VIBERIG_TASK_ID`.

Fallback operation:

```text
Runner cannot reach API
  -> write ~/.viberig/runs/<run_id>/run.sqlite
  -> write ~/.viberig/runs/<run_id>/outbox.jsonl
  -> continue collecting evidence

Runner finishes or API returns
  -> import outbox into control database
  -> copy or commit evidence files as configured
```

This avoids database merge conflicts. Git carries source documents and code. SQLite state is propagated only through the VibeRig service or explicit run import.

## Worktree Data Model

Worktrees should rely on Git for source context. The runner must not create a separate copied context snapshot by default.

Before starting a task, the runner should:

- Fetch and resolve the configured base ref, `origin/main` by default.
- Record the base ref and base Git commit SHA in the control database.
- Create the worktree from that base ref.
- Pass task, acceptance, and validation context through the backend-generated prompt instead of copying untracked `.vibeRig` files into the worktree.

The worktree is a code execution space. VibeRig task state remains in the backend database:

```text
worktrees/<requirement_id>-<task_id>/
  <project code files>
        roadmap.md
        acceptance.md
        tasks.yaml
```

The worktree writes runtime output separately:

```text
~/.viberig/
  runs/
    <run_id>/
      run.sqlite
      outbox.jsonl
      self-acceptance.md
      validation.json
      changed-files.txt
      run.log
```

`~/.viberig/runs/` is outside Git. Accepted evidence can be copied into the canonical requirement evidence folder when the run is collected:

```text
<project-root>/.vibeRig/requirements/<requirement_id>/evidence/<task_id>/
```

If the project wants evidence committed with code, the runner can commit the canonical evidence files. Runtime SQLite files remain ignored.

## Runner Design

The runner should be optional in version one. Manual status movement is enough to validate the model and UI.

When enabled, runner flow:

```text
1. Pick a ready task.
2. Check dependencies.
3. Fetch `origin/main` and create or reuse worktree from that base.
4. Verify Codex has not changed `.vibeRig/` after implementation.
5. Create a run record in the control database.
6. Start Codex with the task id, requirement id, and local file paths.
7. Stream logs into the worktree run directory and the API.
8. Run validation commands.
9. Write self-acceptance evidence.
10. Collect run output into the control database.
11. Move task to self_accepted or failed.
```

This avoids the Spec Kit-style worktree data problem by making Git the only mechanism for source context. Runtime state is not carried by Git; it flows through the VibeRig service or the worktree run outbox.

## Acceptance Flow

Self-acceptance is mandatory before human acceptance.

Self-acceptance output:

```text
evidence/<task_id>/self-acceptance.md
evidence/<task_id>/validation.json
evidence/<task_id>/run.log
evidence/<task_id>/changed-files.txt
```

`self-acceptance.md` should include:

```markdown
# Self Acceptance: <task_id>

## Acceptance Matrix

| Acceptance | Result | Evidence |
| --- | --- | --- |
| AC-1 | PASS | ... |
| AC-2 | FAIL | ... |

## Commands Run

- npm test
- npm run lint

## Residual Risk

...
```

Human review should write:

```text
evidence/<task_id>/human-review.md
```

Human review fields:

- reviewer
- result
- notes
- reviewed evidence
- accepted residual risks

## Optional Export And Mirror Integrations

External integrations are outside the default workflow. They should be one-way exports or read-only mirrors unless there is a specific reason to support import.

### Linear Mirror

Purpose:

- Publish task cards to Linear issues.
- Reflect VibeRig status into Linear comments or labels.
- Keep Linear as a collaboration surface, not source of truth.

Potential use of `linearstories`:

- Render VibeRig task contracts into Markdown stories.
- Use `linearstories import --dry-run` for preview.
- Use `linearstories import` only when the user explicitly wants a Linear mirror.
- Store Linear IDs under `.vibeRig/exports/linear/`.

### Obsidian Export

Purpose:

- Export human-readable task and acceptance dashboards.
- Support local review and notes.

It should not own execution state.

### Lark Report

Purpose:

- Publish selected tasks and acceptance status to Lark/Feishu for team visibility.
- Keep local VibeRig database as source of truth.

### External Automation Bridge

Purpose:

- Keep compatibility with existing external automation workflows.
- Allow external integrations to consume exported tasks if needed.

This should become optional after the native runner is stable.

## Library Recommendations

Primary recommendation:

- `dnd-kit` for kanban drag/drop.
- Global SQLite under `~/.viberig/viberig.sqlite` for runtime state.
- Python for the first VibeRig MCP service.
- React for dashboard UI.

Secondary options:

- `interact.js` for advanced freeform dragging/resizing.
- `linearstories` for optional Linear issue mirrors.
- Obsidian Tasks or Dataview for optional local Markdown views.
- Lark CLI/OpenAPI for optional team reports.

Avoid:

- `react-beautiful-dnd` as a new dependency because it is deprecated.
- Treating Linear or Lark as the primary task database.
- Rewriting task runtime state directly into Markdown on every transition.

## Milestones

### M1: Local Board Foundation

- Parse current `tasks.yaml`.
- Create `~/.viberig/viberig.sqlite`.
- Implement project registry.
- Implement MCP tools/resources and a browser HTTP bridge.
- Add project selector.
- Show kanban columns and task cards.
- Support manual drag/drop status updates.
- Show task detail drawer and acceptance checklist.

### M2: Evidence And Review

- Add evidence file discovery.
- Add manual review form.
- Add acceptance matrix UI.
- Add activity history.
- Add source hash tracking.

### M3: Local Runner

- Add task run creation.
- Create or reuse Git worktree.
- Verify committed requirement files are visible in the worktree.
- Start Codex or a placeholder command.
- Stream logs.
- Write validation result and self-acceptance evidence.
- Move task to `self_accepted` or `failed`.

### M4: Optional Export/Mirror Integrations

- Add Linear mirror metadata.
- Add optional `linearstories` export.
- Add Obsidian export.
- Add Lark report export if needed.
- Keep external integrations compatibility only as a bridge.

## Open Questions

- Which evidence files should be committed to Git by default?
- Which statuses should be user-customizable?
- Should manual review be required for all tasks or only tasks with high-risk acceptance criteria?
- Should the runner be single-task by default, with explicit opt-in for parallelism?

## Recommendation

Build the native VibeRig task engine in this order:

```text
Global SQLite -> MCP service -> project selector -> React kanban -> acceptance/evidence UI -> local runner -> optional exports
```

This solves the current visibility problem first. It also removes the fragile dependency on external automation connectivity while keeping those systems available as optional integrations later.
