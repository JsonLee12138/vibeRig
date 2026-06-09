---
name: human-acceptance
description: Record explicit human acceptance or rejection for VibeRig Linear work. On full acceptance, merge the linked PR and clean up the task worktree. Use only when the user explicitly asks to perform or record human acceptance, such as "人工验收通过", "record human acceptance", "accept AC-001", or "reject this VibeRig issue". Never auto-trigger this skill from task-runner, agent-sop, or insights.
---

# Human Acceptance

Use this skill only when the current user explicitly asks to record human acceptance or rejection for VibeRig Linear work.

This skill is the human sign-off gate. Automated validation, subagent QA, code review, and proof packets can prepare an issue for acceptance, but they must not replace this skill.

For fully accepted PR-backed work, this skill is also the only VibeRig workflow step that may merge the PR and remove the task worktree.

## Contract

Use this skill to record an explicit human acceptance, partial acceptance, rejection, or blocked acceptance decision for VibeRig Linear work.

Do not use this skill for automated validation, implementation, QA, code review, planning, or retrospective generation by itself. It may call `insights` only after explicit acceptance is recorded.

Stop before updating Linear, merging a PR, or cleaning a worktree when the user's acceptance decision is missing, the issue cannot be resolved, the PR cannot be verified, or cleanup safety cannot be proven.

## Manual Trigger Only

- Do not use this skill automatically after `task-runner`, `agent-sop`, `write-plan`, or `insights`.
- Do not infer human acceptance from passing tests, successful builds, QA approval, or a completed proof packet.
- If the user has not explicitly provided an acceptance decision, ask for the missing decision instead of updating Linear.
- The accepted/rejected decision must come from the human user in the current turn or an explicit quoted instruction from the user.
- Do not merge a PR or clean a worktree unless the current user explicitly accepts all required ACs or explicitly accepts the stated residual risks.

## Required Linear Tool Mapping

Use the `linear` skill/plugin with these concrete Linear app tools:

- `_get_issue` to read the target issue.
- `_list_comments` to read proof packets, QA notes, and prior acceptance comments.
- `_list_issue_statuses` to map VibeRig lifecycle intent to the team's actual Linear workflow states.
- `_save_comment` to write the human acceptance or rejection record.
- `_save_issue` to update issue status, labels, or relations after the acceptance decision.

If Linear tools are unavailable, summarize the acceptance record in chat and stop before pretending Linear was updated.

## Git And PR Requirements

Read the latest Proof Packet to resolve:

- PR URL and provider.
- Branch, commit, and base branch.
- Workspace mode and path.
- Whether the workspace path is inside the project worktrees root.
- Validation and CI/check status referenced by the proof.

On full acceptance:

- Merge the linked PR through the project's provider. For GitHub projects, use the GitHub plugin or `gh` CLI when authenticated.
- Use the target project's normal merge method when discoverable. If the method is unknown, use the provider default and record it in the acceptance comment.
- If required checks, conflicts, missing auth, missing PR URL, or branch protection prevent merge, do not move the issue to a terminal status. Record the acceptance decision and merge blocker in Linear, move the issue to the closest blocked/waiting/rework state, and stop.
- After a successful merge, remove the task worktree only when the recorded path is under the configured worktrees root, defaulting to the project's `.worktrees/` directory.
- Before cleanup, run `git status --short` in the worktree. If uncommitted or untracked files remain, do not force-remove the worktree unless the user explicitly authorizes discarding them.
- Prefer `git worktree remove` with the verified task worktree path for cleanup. Delete the local task branch only after the PR is merged and the worktree is removed. Do not delete the remote branch unless the provider merge operation already did it or the user explicitly asks.
- Never clean the current main workspace from this skill.

On partial acceptance, rejection, or blocked acceptance, do not merge the PR and do not clean the worktree unless the user explicitly asks for a separate cleanup action.

## Input Contract

Resolve from the user's request or ask one concise blocking question:

- Linear issue key or URL.
- Acceptance decision: accepted, partially accepted, rejected, or blocked.
- Accepted AC ids and rejected/unverified AC ids.
- Manual check notes, if any.
- Residual risks the human accepts or rejects.
- PR URL when the latest Proof Packet does not contain one.

If the user says all acceptance criteria passed, treat all AC ids referenced by the issue/proof packet as accepted, but list them explicitly in the comment.

## Output Contract

Return and, when tools are available, write to Linear:

- Acceptance decision and AC coverage.
- Manual checks and risk decision.
- PR merge result or blocker.
- Worktree cleanup result or blocker.
- Linear status update result.
- Post-acceptance insights result and any pending skill-update confirmation.

Do not claim full acceptance is complete unless the Linear comment was written, required PR merge succeeded or was not required, and the issue moved to a valid terminal success status.

## Status Mapping

Use `_list_issue_statuses` and choose the closest available team status.

- Full acceptance: move to `Done`, `Accepted`, `Completed`, or the team's closest terminal success status.
- Partial acceptance or rework required: move to `In Progress`, `Rework`, `To Do`, or the closest non-terminal working status.
- Blocked human acceptance: move to `Blocked` or the closest blocked/waiting status.
- Full acceptance with required PR merge failure: do not move to terminal success; use `Blocked`, `In Review`, `Rework`, or the closest non-terminal state and record the merge blocker.

Do not invent workflow states that do not exist in the Linear team. If no close status exists, leave the status unchanged and record the intended lifecycle state in the comment.

## Workflow

1. Read `.vibeRig/project.yaml` for Linear project/team context when available.
2. Read the target Linear issue and comments:
   - source docs and AC references
   - latest Proof Packet comment
   - PR URL, branch, commit, base branch, and workspace path
   - QA/reviewer handoff notes
   - unresolved risks and manual checks
3. Confirm the human decision covers the relevant AC ids:
   - accepted AC ids
   - rejected or unverified AC ids
   - explicit risk acceptance, if any
4. If the issue is fully accepted and a PR is required or present, merge the PR before terminal status update.
5. If the merge succeeds and the work used a project-local task worktree, clean up the worktree after confirming it is safe to remove.
6. Write one Linear comment with `_save_comment`, including acceptance, merge, cleanup, and blocker details.
7. Update the Linear issue with `_save_issue` according to the Status Mapping. Only use a terminal success state after any required PR merge succeeds.
8. If the issue is fully accepted and any required PR merge succeeded, run the post-acceptance insights flow:
   - use `insights` to generate conservative learning candidates from the accepted issue, proof packet, and source docs
   - write the retrospective or learning candidates as a Linear comment when useful
   - update VibeRig skills only when the user explicitly confirms the concrete `skill_update` candidate or the current acceptance request explicitly authorizes applying that exact update
9. Report the acceptance decision, PR merge result, worktree cleanup result, status update, insights result, and any skill updates or pending confirmations.

## Comment Template

```markdown
## Human Acceptance

Decision: <accepted | partially accepted | rejected | blocked>
Accepted by: <user-provided name or current user>

## AC Coverage
- Accepted: AC-...
- Rejected/unverified: AC-...

## Manual Checks
- <check/result>

## Risk Decision
- <accepted residual risks or rejection reasons>

## PR And Cleanup
- PR: <merged | not merged | not required | blocked: reason>
- Worktree cleanup: <removed | skipped | blocked: reason>

## Follow-up
- Insights: <generated | skipped with reason>
- Skill updates: <applied | proposed | none>
```

## Validation

Before final reporting, verify:

- The acceptance decision came explicitly from the current user or a quoted user instruction.
- The AC ids in the comment match the issue/proof packet.
- Linear issue status was mapped from `_list_issue_statuses`; no invented status was used.
- Required PR merge succeeded before any terminal success status.
- Worktree cleanup only touched a safe task worktree and was skipped when uncommitted files remained.
- `insights` ran or was skipped with a reason after full acceptance.

## Hard Rules

- Do not mark an issue accepted or done without an explicit human acceptance decision.
- Do not call implementation subagents from this skill.
- Do not perform new development work in this skill.
- Do not merge PRs for partial, rejected, blocked, or unverified acceptance.
- Do not remove worktrees outside the configured project `.worktrees/` directory.
- Do not use context-mode inside subagents. The main agent may use context-mode to summarize large evidence before writing the acceptance comment.
- Do not update skills from weak evidence, failed work, or unaccepted work.
