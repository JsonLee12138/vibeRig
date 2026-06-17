---
name: accept
description: Record explicit human acceptance for a VibeRig requirement or feature. Use when the user says "accept", "验收通过", "all ACs accepted", or "done" for a requirement-backed Linear issue with a PR. Merges the linked PR, moves the issue to Done, archives requirement docs, runs post-acceptance insights, and cleans the task worktree. For bug fix acceptance (no PR, no worktree), use `accept-bug` instead.
---

# Accept

Use this skill to record human acceptance for a completed VibeRig requirement or feature.

This skill is the final gate for requirement/feature work backed by a PR and a task worktree. It merges the PR, marks the Linear issue Done, archives requirement docs, runs post-acceptance insights, and cleans the worktree.

> **Choosing between accept skills**:
> - `accept` — requirement or feature work, with a PR and a worktree. Handles merge, archival, and cleanup.
> - `accept-bug` — bug fix work only, with a commit but no PR and no worktree. Lightweight flow.
>
> When in doubt, check whether the issue has a PR. If it does, use this skill. If it only has a commit, use `accept-bug`.

## Contract

Use this skill when the user explicitly accepts all or part of a requirement-backed Linear issue.

Do not infer acceptance from passing tests, proof packets, QA approval, or code review results. Human acceptance must be an explicit statement from the current user in the current turn.

Do not use for bug fix acceptance — use `accept-bug` instead.

## Manual Trigger Only

- Trigger only when the user explicitly states acceptance: "accept", "验收通过", "all ACs accepted", "done", "merge it".
- Do not auto-trigger from `task-runner`, `agent-sop`, `insights`, or code review results.
- If the acceptance decision is missing, ask for it. Do not guess.

## Required Linear Tool Mapping

- `_get_issue` — read the target issue.
- `_list_comments` — read proof packets, QA notes, and prior acceptance comments.
- `_list_issue_statuses` — map VibeRig lifecycle to actual Linear workflow states.
- `_save_comment` — write the human acceptance record.
- `_save_issue` — update issue status after acceptance.

If Linear tools are unavailable, summarize the acceptance record in chat and stop before pretending Linear was updated.

## Language Policy

Read `.vibeRig/project.yaml` and use `output.language` for all human-facing Linear content.

- Acceptance comment, merge note, blocker note, archival note, insights summary, and final user summary must use `output.language`.
- If `output.language` is missing, infer from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- Do not translate: stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, AC IDs, schema field names, code symbols, or existing Linear status names.
- If the user provides acceptance text in another language, preserve exact quoted wording as evidence, then summarize the record in `output.language`.

## Default Parameter

The skill accepts exactly one of the following as its entry point:

| Parameter form | Example |
|---|---|
| Task ID | `VB-42` |
| Task title (partial match) | `"implement login flow"` |
| Requirement ID | `REQ-007` |
| Requirement title (partial match) | `"user authentication"` |

When the argument resolves to a **requirement** (parent issue with subtasks), the skill applies the same acceptance decision to **all subtasks** in addition to the parent issue. List each subtask and its resulting status in the acceptance comment.

## Input Contract

Required:
- **Entry point**: task ID, task title, requirement ID, or requirement title (see Default Parameter above).
- Acceptance decision: accepted, partially accepted, rejected, or blocked.
- Accepted AC ids and rejected/unverified AC ids.

Optional:
- Manual check notes.
- Residual risks the human accepts.
- PR URL when not already in the Proof Packet.

If the user says "all ACs accepted", treat all AC ids from the issue/proof packet as accepted, but list them explicitly in the comment.

## Status Mapping

Use `_list_issue_statuses` and choose the closest available team status.

- **Full acceptance**: Done / Accepted / Completed (only after PR merge succeeds).
- **Partial acceptance or rework required**: In Progress / Rework / To Do, or the closest non-terminal working state.
- **Blocked acceptance**: Blocked or the closest blocked/waiting state.
- **Full acceptance with merge failure**: do not use a terminal state; use Blocked / In Review / Rework, and record the merge blocker.

Do not invent states that do not exist in the Linear team. If no close status exists, leave the status unchanged and record the intended lifecycle state in the comment.

## Workflow

1. Read `.vibeRig/project.yaml` for output language and Linear context.
2. Resolve the entry point (task ID/title or requirement ID/title):
   - use `_get_issue` for a named ID; use `_search` or `_list_issues` for title-based lookup
   - if the resolved issue is a **requirement/parent issue**, use `_list_issues` (filtered by `parent`) to enumerate all subtasks — these form the acceptance queue
   - if the resolved issue is a single task (no children), the queue contains only that one issue
3. Read the target issue(s), comments, and Proof Packets. Resolve PR URL, branch, commit, base branch, workspace path, and validation status for each task in the queue.
4. Confirm the human decision covers relevant AC ids.
5. Run merge preflight for each task with a PR (full acceptance only):
   - **CI status**: all required checks must pass. If any required check is failing, pending, or missing, stop before merge.
   - **Conflicts**: PR branch must have no merge conflicts with the target base branch.
   - **Approvals**: PR must have required review approvals when branch protection is active.
   - If any check fails, record the blocker in Linear and stop; do not move that task (or the parent) to a terminal state.
6. Write the Linear acceptance comment with `_save_comment` (using [acceptance-comment-template.md](./assets/acceptance-comment-template.md)) before any status update.
   - When the entry point is a requirement, write one comment on the parent issue listing all subtask outcomes.
7. Update Linear status for **each subtask** in the queue with `_save_issue` according to Status Mapping. Only use a terminal success state after PR merge succeeds for that task.
8. After all subtasks are updated, update the **parent requirement issue** status with `_save_issue`:
   - Full acceptance of all subtasks → same terminal success state (Done/Accepted/Completed).
   - Any subtask partial/blocked/rejected → closest non-terminal working state (In Progress / Blocked).
9. On full acceptance and successful PR merge: run `insights` → `skill-builder` for confirmed proposals. Write retrospective as a Linear comment.
10. Archive requirement docs: move `.vibeRig/requirements/{id}/` to `.vibeRig/archive/requirements/{id}/`. Record source, destination, and any blocker.
11. Clean each task worktree (for worktree-mode tasks):
    - **Confirm all commits are pushed**: run `git -C <worktree-path> log --oneline origin/<branch>..<branch>`. If any unpushed commits are listed, do NOT remove the worktree — push them first or ask the user.
    - **Confirm clean state**: run `git -C <worktree-path> status --short`. If uncommitted or untracked files remain, do not remove unless the user explicitly authorizes discarding them.
    - Only when both checks pass: run `git worktree remove <path>` with the verified task worktree path.
    - Remove the local task branch only after the PR is merged and the worktree is removed.
12. Report: acceptance decision, list of subtasks and their outcomes, PR merge results, status updates, insights summary, archival result, cleanup result.

## Red Flags

- Acceptance was inferred from passing tests or proof packet, not from explicit user statement → stop; only explicit user statements count.
- PR was merged before merge preflight (CI, conflicts, approvals) passed → preflight must complete before any merge.
- Linear was moved to Done before the PR merge succeeded → revert to a non-terminal blocked state.
- Worktree was removed without checking for unpushed commits → run `git log --oneline origin/<branch>..<branch>` first; unpushed commits mean work would be lost.
- Worktree was removed without `git status --short` confirmation of clean state → always verify both pushed and clean before removal.
- `insights` ran before the terminal Linear status was set → insights must follow the terminal update.
- `accept` was used for a bug fix → use `accept-bug` for bugs; this skill is for requirement/feature work with PRs and worktrees.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "Tests passed and QA approved — that's effectively accepted" | Human acceptance is explicit from the current user. Automation prepares the work; it cannot replace the decision. |
| "I'll merge first and check CI after" | Merging before CI passes can land broken code on the base branch. The merge preflight exists to prevent exactly this. |
| "The worktree is probably clean since the task is done" | Run `git status --short` — "probably" is not evidence. Any uncommitted files must be resolved before cleanup. |
| "The PR was merged so commits must already be pushed" | The worktree branch is separate from the merged PR branch. Verify with `git log --oneline origin/<branch>..<branch>` — unpushed commits in the worktree would be silently discarded on removal. |
| "I'll move to Done and run insights, then write the comment" | The acceptance comment must be written before the terminal status update so the record exists if insights fails. |

## Verification Checklist

```bash
# Verify all commits in worktree are pushed (must be empty output)
git -C <worktree-path> log --oneline origin/<branch>..<branch>

# Verify worktree is clean before removal (must be empty output)
git -C <worktree-path> status --short

# Verify PR merged
gh pr view <PR-URL> --json mergedAt,state | grep -q '"mergedAt"' && echo "merged" || echo "not merged"
```

- [ ] Acceptance decision is explicit from the current user in the current turn.
- [ ] Merge preflight (CI, conflicts, approvals) passed before any merge attempt.
- [ ] Acceptance comment written to Linear (using template) before the terminal status update.
- [ ] PR merge succeeded before the issue moved to a terminal state.
- [ ] `insights` ran only after PR merge and terminal Linear status were confirmed.
- [ ] Requirement docs archived from active to archive directory.
- [ ] All worktree commits confirmed pushed (`git log --oneline origin/<branch>..<branch>` = empty).
- [ ] Worktree clean state confirmed (`git status --short` = empty) before removal.
- [ ] Worktree removed only after both pushed and clean checks passed.
- [ ] Human-facing Linear content uses `output.language`.

## Hard Rules

- Do not mark an issue accepted or done without an explicit human acceptance decision.
- Do not call implementation subagents from this skill.
- Do not perform new development work in this skill.
- Do not merge PRs for partial, rejected, blocked, or unverified acceptance.
- Do not remove worktrees outside the configured project `.worktrees/` directory.
- Do not archive active requirement docs for partial, rejected, blocked, or unverified acceptance.
- Do not overwrite existing archived requirement docs.
- Before running insights, read the Linear acceptance comment, proof packet comments, review notes, and linked PR/validation evidence.
- Do not update skills from weak evidence, failed work, or unaccepted work.
