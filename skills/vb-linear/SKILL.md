---
name: vb-linear
description: Shared Linear access reference for VibeRig skills. Consult whenever a VibeRig skill needs to read or write Linear (issues, comments, statuses, labels, projects, teams, documents, milestones, status updates). Not a standalone user-facing workflow.
---

# vb-linear

Shared reference other VibeRig skills point to for Linear access. This skill is not a workflow entry point on its own — it centralizes tool selection and rules that would otherwise be duplicated (and drift) across every Linear-touching skill. Target ids (team/project) and output language for every Linear operation come from `.vibeRig/project.yaml`.

## MCP Server

VibeRig ships its own Linear MCP server declaration at the plugin root: `.mcp.json` (Claude Code), `.codex.mcp.json` (Codex), `mcp.json` (Cursor). The server key is **`vb-linear`**, pointing at Linear's official hosted MCP server (`https://mcp.linear.app/mcp`). No separate Linear account setup is required ahead of time — `vb-init` verifies login with a read-only probe before it registers a Project, and triggers the OAuth flow on the spot if the probe shows the host isn't logged in yet.

Hosts frequently also expose a Linear-capable tool from somewhere else — a platform-native connector, a user-level global MCP entry, another installed plugin. These can look identical (same tool names, same capability) but are **not** this server: they may be logged into a different Linear account/workspace, and they sit outside this plugin's config so future changes here won't reach them.

- Only use tools that resolve to the `vb-linear` server declared in this plugin's own mcp config. Fully-qualified tool names carry the server identity (e.g. `mcp__vb-linear__get_issue`); when a host doesn't qualify names and more than one Linear-capable source is present, do not guess — tell the user there are multiple Linear sources available and ask which to use.
- If Linear tools are unavailable entirely, summarize the intended record in chat and stop — never claim Linear was updated when it wasn't.

## Capability Map

Callers ask for a capability; this is what it resolves to.

| Capability | Resolves to | Notes |
|---|---|---|
| Read an issue | `get_issue` | Title, description, status, labels, assignee, comments. |
| Find an issue/project by free text | `search` | Use when no exact id/key is known. |
| Enumerate issues | `list_issues` | Filter by `parent` (sub-issues of a requirement), team, project, or status. |
| Resolve a team's workflow states | `list_issue_statuses` | Required before any status change — see Status Mapping Rule. |
| Reuse or create a label | `list_issue_labels` / `create_issue_label` | Check existing labels before creating new ones. |
| Read prior comments | `list_comments` | Prior analysis, proof packets, acceptance records. |
| Create or update an issue | `save_issue` | Title, description, status, labels, `parentId`, `project`, `team`, `blockedBy`/`blocks`. |
| Write a comment | `save_comment` | Analysis, proof packet, acceptance record, plan-sync summary. |
| Resolve a team | `list_teams` / `get_team` | Typically during `vb-init`. |
| Find or create the registered project | `list_projects` / `save_project` | Search before creating. |
| Find or create the Project Document | `list_documents` / `save_document` | Typically during `vb-init`. |
| Read or create a milestone | `list_milestones` / `get_milestone` / `save_milestone` | `split-milestones` creates (check for duplicates first); `task-runner` / `accept-milestone` read. Milestone description holds only a Document link + local contract path + AC-ids — never the full document text. |
| Read or write a status update (Project Update) | `get_status_updates` / `save_status_update` | `accept-milestone` writes health/progress after milestone acceptance. |

## VibeRig Event Record Hosts

VibeRig event records must use one real, searchable host for their entire lifecycle:

- Issue / sub-issue acceptance → that Issue's comments (`list_comments` / `save_comment`).
- Milestone acceptance, Milestone delivery, requirement aggregation, and PRD/requirement finalization → the registered Linear Project's Project Updates (`get_status_updates` / `save_status_update`). Milestones do not have a comment capability.

Put `<!-- VibeRig-Event: <event-id> -->` in every event record, plus a typed marker `<!-- VibeRig-Record: <kind>:<event-id> -->`. Use `kind: acceptance` for the single acceptance record, `retrospective` for the single insights record, `delivery-intent` for the pre-merge write-ahead record, `delivery` for the canonical pending delivery record, and `phase` for append-only state overlays. For acceptance, retrospective, delivery-intent, or delivery, zero exact typed-marker matches permits one write, one structurally valid match is adopted, and multiple/malformed/conflicting matches fail closed; never append a second canonical record. Retrospective adoption ignores other legitimate kinds; phase recovery selects the newest structurally valid typed phase record while preserving earlier references. Search/write only within the mapped host and registered project. Never write acceptance or delivery intent to one host and later search another. Callers refer to the result generically as a `linear_record`; an Issue result may additionally expose `comment_id`, while a Project Update exposes `status_update_id`.

## Status Mapping Rule

Resolve the team's actual workflow states before any status change.

- Never invent a status name that doesn't exist in the team's workflow.
- If no matching status exists for the intended lifecycle state, leave the current status unchanged and record the intended state in a comment instead.
- Callers own their own specific lifecycle → status table (for example, `accept-milestone`'s Full/Partial/Blocked acceptance mapping). This skill only provides the resolution method, not the specific mapping — that mapping is skill-specific.

## Language Policy

Read `.vibeRig/project.yaml` `output.language` and use it for all human-facing Linear content: issue titles, descriptions, comments, and plan-sync summaries.

- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `vb-init`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, AC IDs, schema field names, code symbols, log excerpts, or existing external labels/status names.
- If source material (requirement docs, error output, user-provided acceptance text) is in a different language, write new human-facing Linear text in `output.language` and preserve exact technical identifiers.

## Ownership Invariant

Only the main agent reads and writes Linear. Subagents must not update Linear status, write Linear comments, or make final acceptance calls — they return phase evidence and a verdict only. The main agent is responsible for all Linear writes after a subagent's work completes.

## Red Flags

- A caller names a specific Linear tool instead of describing the capability it needs → route it through this skill's Capability Map instead.
- A skill requests a status change without resolving workflow states first → resolve states first, every time.
- A skill creates an issue without checking for an existing match first → duplicate issues corrupt the plan; check before creating.
- A subagent's output implies a Linear write happened → subagents return evidence only; the calling skill's main agent performs the write.
- A skill claims a Linear update succeeded when tools were unavailable → summarize in chat and say so explicitly instead.
- More than one Linear-capable tool source is present and the caller can't tell which is the `vb-linear` server → stop and ask the user, don't guess.
