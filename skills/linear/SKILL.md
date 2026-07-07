---
name: linear
description: Shared Linear access reference for VibeRig skills. Use whenever a VibeRig skill needs to read or write Linear (issues, comments, statuses, labels, projects, teams, documents) — for the concrete tool mapping, status-mapping rule, human-facing language policy, subagent-ownership invariant, and the fallback behavior when Linear tools are unavailable. Not a standalone user-facing workflow; other skills (`accept`, `accept-bug`, `bugger`, `bugfix`, `write-plan`, `task-runner`, `agent-sop`, `blocker-resume`, `vb-init`, `insights`, `vb-learn`, `brainstorm`) reference this skill instead of restating these rules.
---

# Linear

Shared reference other VibeRig skills point to for Linear access. This skill is not a workflow entry point on its own — it centralizes rules that would otherwise be duplicated across every Linear-touching skill.

## MCP Server

VibeRig ships its own Linear MCP server declaration at the plugin root (`.mcp.json` for Codex/Claude, `mcp.json` for Cursor), pointing at Linear's official hosted MCP server (`https://mcp.linear.app/mcp`). The host must complete Linear's OAuth flow once before the tools below are available. Do not assume a separately installed Linear connector — the bundled config is the source of truth for which server is used.

## Tool Mapping

| Tool | Use for |
|---|---|
| `_get_issue` | Read a single issue (title, description, status, labels, assignee, comments). |
| `_search` | Find an issue/project by free-text when no exact id/key is known. |
| `_list_issues` | Enumerate issues, e.g. filtered by `parent` (sub-issues of a requirement) or by team/project/status. |
| `_list_issue_statuses` | Resolve the team's actual workflow states before any status change. |
| `_list_issue_labels` / `_create_issue_label` | Reuse or create VibeRig labels; check existing labels before creating new ones. |
| `_list_comments` | Read prior analysis, proof packets, or acceptance records on an issue. |
| `_save_issue` | Create or update an issue (title, description, status, labels, `parentId`, `project`, `team`, `blockedBy`/`blocks`). |
| `_save_comment` | Write a comment (analysis, proof packet, acceptance record, plan-sync summary). |
| `_list_teams` / `_get_team` | Resolve the target Linear team, typically during `vb-init`. |
| `_list_projects` / `_save_project` | Find or create the Linear project registered in `.vibeRig/project.yaml`. |
| `_list_documents` / `_save_document` | Find or create the Linear Project Document, typically during `vb-init`. |

If Linear tools are unavailable, summarize the intended record in chat and stop — never claim Linear was updated when it wasn't.

## Status Mapping Rule

Use `_list_issue_statuses` to resolve the team's actual states before any status change.

- Never invent a status name that doesn't exist in the team's workflow.
- If no matching status exists for the intended lifecycle state, leave the current status unchanged and record the intended state in a comment instead.
- Callers own their own specific lifecycle → status table (for example, `accept`'s Full/Partial/Blocked acceptance mapping). This skill only provides the resolution method, not the specific mapping — that mapping is skill-specific.

## Language Policy

Read `.vibeRig/project.yaml` `output.language` and use it for all human-facing Linear content: issue titles, descriptions, comments, and plan-sync summaries.

- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `vb-init`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, AC IDs, schema field names, code symbols, log excerpts, or existing external labels/status names.
- If source material (requirement docs, error output, user-provided acceptance text) is in a different language, write new human-facing Linear text in `output.language` and preserve exact technical identifiers.

## Ownership Invariant

Only the main agent reads and writes Linear. Subagents must not update Linear status, write Linear comments, or make final acceptance calls — they return phase evidence and a verdict only. The main agent is responsible for all `_save_issue`/`_save_comment` calls after a subagent's work completes.

## Red Flags

- A skill calls Linear tools without first resolving `_list_issue_statuses` for a status change → resolve states first, every time.
- A skill creates an issue without checking `_list_issues`/`_search` for an existing match → duplicate issues corrupt the plan; check before creating.
- A subagent's output implies a Linear write happened → subagents return evidence only; the calling skill's main agent performs the write.
- A skill claims a Linear update succeeded when tools were unavailable → summarize in chat and say so explicitly instead.
