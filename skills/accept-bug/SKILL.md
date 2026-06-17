---
name: accept-bug
description: Record explicit human acceptance for a VibeRig bug fix. Use when the user says "bug ok", "fix accepted", "close this bug", "accept bug fix", or "验收通过" for a bug tracked in Linear. No PR is required — the fix is already committed by `bugfix`. Updates Linear status to Done. For requirement/feature acceptance with PR merge and worktree cleanup, use `accept` instead.
---

# Accept Bug

Use this skill to record human acceptance for a completed bug fix.

Bug fix acceptance is simpler than requirement acceptance: the fix was already committed to the branch by `bugfix` — there is no PR to merge and no worktree to clean up. The core job is to confirm the user explicitly accepted the fix, write the acceptance record in Linear, and close the issue.

> **No PR required**: `bugfix` committed the fix directly to the current branch. This skill does not create, review, or merge a PR. If the fix is in a PR, the issue is a requirement/feature — use `accept` instead.

> **Choosing between accept skills**:
> - `accept-bug` — bug fix, commit only, no PR, no worktree. Use this skill.
> - `accept` — requirement or feature, with a PR and a worktree.

## Contract

Use this skill when the user explicitly accepts a bug fix tracked in Linear.

Do not use for requirement or feature acceptance — use `accept` instead.
Do not infer acceptance from passing tests, proof packets, or automated QA results.
Do not create or merge a PR from this skill — bug fixes use commits, not PRs.

## Manual Trigger Only

Trigger only when the user explicitly states acceptance:
- "bug ok", "fix accepted", "close this bug", "accept bug fix", "验收通过"

Do not auto-trigger from `bugfix`, `agent-sop`, or test results.

## Required Linear Tool Mapping

- `_get_issue` — read the bug issue.
- `_list_comments` — read fix evidence and prior analysis.
- `_list_issue_statuses` — map lifecycle intent to actual Linear workflow states.
- `_save_comment` — write the acceptance record.
- `_save_issue` — update issue to Done.

If Linear tools are unavailable, summarize the acceptance record in chat.

## Language Policy

Read `.vibeRig/project.yaml` and use `output.language` for all human-facing Linear content.

- Acceptance comment and final user summary must use `output.language`.
- If `output.language` is missing, infer from the user's current working language and state the fallback.
- Do not translate: stable IDs, file paths, commands, branch names, commit hashes, Linear keys, or existing Linear status names.

## Default Parameter

The skill accepts exactly one of the following as its entry point:

| Parameter form | Example |
|---|---|
| Bug task ID | `VB-55` |
| Bug task title (partial match) | `"login crash on empty password"` |
| Requirement/parent ID | `REQ-003` |
| Requirement/parent title (partial match) | `"auth bugs"` |

When the argument resolves to a **parent issue with bug subtasks**, the skill applies the same acceptance decision to **all subtasks** and then updates the parent issue status to reflect the combined outcome.

## Input Contract

Required:
- **Entry point**: bug task ID, task title, parent/requirement ID, or parent/requirement title (see Default Parameter above).
- Explicit acceptance decision from the current user.

Optional:
- Specific manual checks the user performed.
- Known limitations or residual risks to record.

## Status Mapping

Use `_list_issue_statuses` and choose the closest available team status.

- **Accepted**: Done / Accepted / Completed — only after the user explicitly accepts.
- **Rework needed**: In Progress / Rework / To Do — if the user rejects or requests changes.

Do not invent states that do not exist in the Linear team.

## Workflow

1. Read `.vibeRig/project.yaml` for output language and Linear context when available.
2. Resolve the entry point (bug task ID/title or parent ID/title):
   - use `_get_issue` for a named ID; use `_search` or `_list_issues` for title-based lookup
   - if the resolved issue is a **parent with bug subtasks**, use `_list_issues` (filtered by `parent`) to enumerate all subtasks — these form the acceptance queue
   - if the resolved issue is a single bug task (no children), the queue contains only that one issue
3. Load each issue in the queue and its fix evidence comments with `_get_issue` and `_list_comments`.
4. Confirm the user has explicitly stated acceptance in the current turn.
5. Write the acceptance comment with `_save_comment`:
   - When accepting a single bug: include user's acceptance statement, commit hash from fix evidence, manual checks performed, residual risks.
   - When accepting a parent with subtasks: write one comment on the parent issue listing each subtask and its outcome (commit hash, manual checks, residual risks per subtask).
6. Update **each bug subtask** to Done/Accepted/Completed with `_save_issue`.
7. After all subtasks are updated, update the **parent issue** status with `_save_issue`:
   - All subtasks accepted → Done/Accepted/Completed.
   - Any subtask rejected or blocked → closest non-terminal working state (In Progress / Blocked).
8. Run lightweight insights if the fix reveals a reusable pattern worth capturing (optional, not default — use when the fix uncovers a non-obvious recurring failure mode, not routinely).
9. Report: acceptance recorded, list of subtasks and their final statuses, parent issue status, any insights summary.

## Red Flags

- Acceptance inferred from passing tests or `bugfix` validation, not from explicit user statement → stop; ask for the decision.
- Linear moved to Done before the user explicitly accepted → terminal state requires explicit human confirmation.
- A PR was created or merged from this skill → bug fixes use commits only; PR workflows belong in `accept`.
- `accept` was used instead of `accept-bug` for a bug → use `accept-bug` for bugs; `accept` carries PR merge and worktree cleanup logic that does not apply.
- `insights` was run for every bug fix by default → lightweight insights are optional; use them when the fix reveals a reusable pattern, not routinely.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The fix passed all tests — the bug is effectively accepted" | Automated validation proves the code changed, not that the fix matches user intent. Acceptance requires explicit sign-off from the user. |
| "I need to create a PR to close this bug properly" | Bug fixes committed by `bugfix` go directly to the branch. No PR is required or expected. Creating one adds unnecessary ceremony. |
| "I'll run insights for every bug fix since learning is always good" | Insights add noise when the fix is routine. Reserve them for fixes that reveal a non-obvious pattern worth preserving in a skill. |
| "The fix was already validated by agent-sop, so I can skip reading the evidence" | Read the fix evidence comment before writing the acceptance comment — it is the record that the acceptance references. |

## Verification Checklist

- [ ] User explicitly stated acceptance in the current turn.
- [ ] Bug issue loaded from Linear and fix evidence comments reviewed.
- [ ] Acceptance comment written to Linear (including commit hash from fix evidence).
- [ ] No PR was created or merged — bug fix is commit-only.
- [ ] Linear issue is in a terminal success state (Done/Accepted/Completed).
- [ ] If insights ran, only non-obvious pattern-level learnings were captured (not routine fix details).
- [ ] Human-facing Linear content uses `output.language`.
