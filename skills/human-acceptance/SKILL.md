---
name: human-acceptance
description: Record explicit human acceptance or rejection for VibeRig Linear work. On full acceptance, merge the linked PR, finalize Linear status, and run post-acceptance learning. Use only when the user explicitly asks to perform or record human acceptance, such as "人工验收通过", "record human acceptance", "accept AC-001", or "reject this VibeRig issue". Never auto-trigger this skill from task-runner, agent-sop, or insights.
---

# Human Acceptance

Use this skill only when the current user explicitly asks to record human acceptance or rejection for VibeRig Linear work.

This skill is the human sign-off gate. Automated validation, subagent QA, code review, and proof packets can prepare an issue for acceptance, but they must not replace this skill.

For fully accepted PR-backed work, this skill is also the only VibeRig workflow step that may merge the PR, move the Linear issue to Done, archive the accepted requirement docs, and remove the task worktree.

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
- Treat the merge into the target base branch, normally `main`, as the gate before any terminal Linear status update.
- If required checks, conflicts, missing auth, missing PR URL, or branch protection prevent merge, do not move the issue to a terminal status and do not run insights. Record the acceptance decision and merge blocker in Linear, move the issue to the closest blocked/waiting/rework state, and stop.
- After a successful merge, write the human acceptance comment and move the Linear issue to `Done`, `Accepted`, `Completed`, or the team's closest terminal success status before running insights.
- Remove the task worktree only after the terminal Linear status update succeeds, and only when the recorded path is under the configured worktrees root, defaulting to the project's `.worktrees/` directory.
- Before cleanup, run `git status --short` in the worktree. If uncommitted or untracked files remain, do not force-remove the worktree unless the user explicitly authorizes discarding them.
- Prefer `git worktree remove <path>` with the verified task worktree path for cleanup. Delete the local task branch only after the PR is merged and the worktree is removed. Do not delete the remote branch unless the provider merge operation already did it or the user explicitly asks.
- Never clean the current main workspace from this skill.

On partial acceptance, rejection, or blocked acceptance, do not merge the PR and do not clean the worktree unless the user explicitly asks for a separate cleanup action.

## Requirement Document Archival

On full acceptance only, archive the accepted requirement docs after insights has read them and before task worktree cleanup.

- Resolve the requirement id and source docs directory from the Linear issue, Proof Packet, and `.vibeRig/project.yaml` docs root.
- Default active docs root: `.vibeRig/requirements/`.
- Default archive root: `.vibeRig/archive/requirements/`.
- Move the accepted requirement directory from `.vibeRig/requirements/{requirement-id}/` to `.vibeRig/archive/requirements/{requirement-id}/`.
- If the archive target already exists, append an acceptance-date or issue-key suffix instead of overwriting existing archived docs.
- Archive only docs tied to the accepted issue or requirement. Do not archive unrelated active requirements.
- Preserve stable ids, source docs, acceptance evidence, and diagrams when moving the directory.
- Record the archive source, destination, and any blocker in the Linear acceptance comment or follow-up comment.
- If the docs directory is missing, ambiguous, dirty in a way that would overwrite user changes, or cannot be safely moved, skip archival, record the blocker, and continue reporting the accepted work.
- If archiving creates repository changes, commit or PR them only when the target project's policy allows post-acceptance documentation archival changes from this workflow. Otherwise leave a clear follow-up note and do not pretend the archive was persisted.

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
- Linear status update result.
- Post-acceptance insights result, SkillOS-lite curation proposals, and any skill-builder update result or pending confirmation.
- Requirement docs archive result or blocker.
- Worktree cleanup result or blocker.

Do not claim full acceptance is complete unless code has reached the target base branch when a PR is required, the Linear comment was written, the issue moved to a valid terminal success status before insights ran, and requirement docs archival either succeeded or was explicitly skipped with a recorded reason.

## Language Policy

Read `.vibeRig/project.yaml` and use `output.language` for human acceptance records.

- The Linear human acceptance/rejection comment, blocked acceptance note, merge blocker note, docs archival note, insights handoff summary, and final user-facing summary must use `output.language`.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing Linear status names.
- If the user provides acceptance text in another language, preserve exact quoted user wording when needed as evidence, then summarize the record in `output.language`.

## Status Mapping

Use `_list_issue_statuses` and choose the closest available team status.

- Full acceptance: move to `Done`, `Accepted`, `Completed`, or the team's closest terminal success status.
- Partial acceptance or rework required: move to `In Progress`, `Rework`, `To Do`, or the closest non-terminal working status.
- Blocked human acceptance: move to `Blocked` or the closest blocked/waiting status.
- Full acceptance with required PR merge failure: do not move to terminal success; use `Blocked`, `In Review`, `Rework`, or the closest non-terminal state and record the merge blocker.

Do not invent workflow states that do not exist in the Linear team. If no close status exists, leave the status unchanged and record the intended lifecycle state in the comment.

## Workflow

1. Read `.vibeRig/project.yaml` for Linear project/team context and output language when available.
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
4. If the issue is fully accepted and a PR is required or present, run a merge preflight before any merge attempt:
   - **CI status**: check required status checks on the PR. If any required check is failing, pending, or missing, stop before merge. Record the failing check(s) in Linear and move the issue to the closest blocked/rework state.
   - **Conflicts**: check whether the PR branch has merge conflicts with the target base branch. If conflicts exist, stop before merge and record a rework blocker.
   - **Approvals**: when the target branch has branch protection requiring PR review approvals, confirm the PR has the required approvals. If approvals are missing, stop before merge and record the blocker.
   - Only when all three checks pass should the merge proceed. If any check fails, record the acceptance decision together with the merge blocker in Linear via `_save_comment`, update the issue status to a non-terminal blocked/rework state via `_save_issue`, and stop before attempting the merge, running insights, or cleaning the worktree.
5. Write one Linear comment with `_save_comment`, including acceptance, merge result, and any blocker details.
6. Update the Linear issue with `_save_issue` according to the Status Mapping. Only use a terminal success state after any required PR merge succeeds.
7. If the issue is fully accepted, any required PR merge succeeded, and Linear is already in the terminal success state, run the post-acceptance insights flow:
   - use `insights` to generate conservative learning candidates and SkillOS-lite curation proposals from the accepted issue, proof packet, and source docs
   - write the retrospective or learning candidates as a Linear comment when useful
   - for every confirmed or explicitly pre-authorized `skill_update` or SkillOS-lite `insert`/`update`/`deprecate` proposal, invoke `skill-builder` and let it update the corresponding `skills/*/SKILL.md`
8. Archive the accepted requirement docs using the Requirement Document Archival policy. If archival is blocked, record the source, intended destination, and blocker.
9. If the merge and terminal Linear status update succeeded and the work used a project-local task worktree, clean up the worktree after confirming it is safe to remove.
10. Report the acceptance decision, PR merge result, status update, insights result, any skill-builder updates or pending confirmations, requirement docs archive result, and worktree cleanup result.

## Comment Template

Render this template in `.vibeRig/project.yaml` `output.language`; the English headings below are structural examples, not required literal text.

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

## PR And Linear
- PR: <merged | not merged | not required | blocked: reason>
- Linear status: <done | accepted | completed | unchanged | blocked: reason>

## Follow-up
- Insights: <generated | skipped with reason>
- Skill updates: <applied through skill-builder | proposed | none>
- Skill curation proposals: <insert/update/deprecate/noop | none>
- Requirement docs archive: <moved source -> destination | skipped | blocked: reason>
- Worktree cleanup: <removed | skipped | blocked: reason>
```

## Validation

Before final reporting, verify:

- The acceptance decision came explicitly from the current user or a quoted user instruction.
- The AC ids in the comment match the issue/proof packet.
- Linear issue status was mapped from `_list_issue_statuses`; no invented status was used.
- The human acceptance or rejection record was written in `output.language` when configured.
- Required PR merge succeeded before any terminal success status.
- Merge preflight (CI status, conflicts, approvals) was checked before the merge attempt; if any check failed, the issue was moved to a non-terminal state and merge was skipped.
- Insights ran only after any required PR merge succeeded and the Linear issue reached a terminal success status.
- Any accepted skill update or SkillOS-lite curation proposal was applied through `skill-builder`, not by hand inside `human-acceptance` or `insights`.
- Requirement docs archival ran after insights, or was skipped with a recorded reason.
- Archived docs moved only the accepted requirement directory and did not overwrite unrelated docs.
- Worktree cleanup only touched a safe task worktree and was skipped when uncommitted files remained.
- `insights` ran or was skipped with a reason after full acceptance.

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
