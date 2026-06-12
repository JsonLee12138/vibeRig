---
name: bugger
description: Use when the user reports a bug that should be tracked in VibeRig/Linear, finds an issue during review that needs a Linear bug record, or asks to analyze and optionally fix a current-codebase bug while preserving Linear analysis and fix evidence. Do not use for new feature implementation, requirement discovery, or full task execution with worktree isolation; use task-runner for those.
---

# Bugger

Use this skill to run the VibeRig bug flow for the current workspace.

This skill handles the fast path for bug work that must be tracked in Linear: capture or resume the bug issue, analyze root cause, confirm direction with the user, fix through `agent-sop`, and hand off to `human-acceptance`. For complex multi-phase execution with worktree isolation and PR workflow, use `task-runner` instead.

## Contract

Use this skill to record a bug as a Linear issue, analyze its root cause, propose a fix approach, and optionally fix it in the current workspace with a direct commit.

Do not use this skill for new feature implementation, requirement discovery, full task execution with worktree isolation, final human acceptance, or post-acceptance retrospectives. Use `task-runner`, `brainstorm`, `human-acceptance`, or `insights` for those phases.

Stop and report when the Linear project/team cannot be resolved, the bug description is too vague to analyze, the fix requires worktree isolation, or the user does not confirm the proposed fix direction.

## Input Contract

Required:

- Bug description from the user: what went wrong, expected behavior, actual behavior, steps to reproduce, or any observable symptoms.
- Target project or workspace.

Optional:

- Linear issue key if the bug is already recorded.
- Screenshots, logs, error messages, or CI output.
- Related code files, branches, or prior proof packets.

If the bug description is too vague to form a hypothesis, ask for the minimum additional detail needed to proceed.

## Output Contract

Return and write to Linear:

- **Flow 1** (record + analyze): Linear issue key, root cause analysis, proposed fix approach, and confirmation from the user.
- **Flow 2** (fix + commit): files changed, commit hash, validation result, fix evidence written to Linear, issue status updated for acceptance, and handoff to `human-acceptance`.

Do not claim a bug is fixed unless the main agent has verified the change and the user has confirmed the fix direction.

## Required Linear Tool Mapping

Use the `linear` skill/plugin with these concrete Linear app tools:

- `_get_issue` to read existing bug issues or related issues.
- `_list_comments` to read prior analysis or proof packets.
- `_list_issue_statuses` to map bug lifecycle intent to the team's actual Linear workflow states.
- `_save_comment` to write root cause analysis and fix approach.
- `_save_issue` to create or update the bug issue.

If Linear tools are unavailable, summarize the bug record in chat and stop before pretending Linear was updated.

## Workflow

### Phase 1: Record And Analyze

1. Read `.vibeRig/project.yaml` for Linear project/team context when available.
2. Resolve the team's bug workflow states before creating or updating the issue:
   - use `_list_issue_statuses` to map the team's actual equivalents for triage/backlog, in-progress, and ready-for-acceptance
   - if the team uses different names, record the mapped status names and use them consistently in the rest of the flow
3. Choose the issue path:
   - if the user provided a Linear issue key, use `_get_issue` to load it and `_list_comments` to review prior analysis or proof packets
   - if no issue key exists, use `_save_issue` to create the bug with title, description, labels, expected vs actual behavior, reproduction steps, and affected files or modules
   - ensure the issue is in the mapped triage or backlog equivalent while analysis is pending
4. Delegate root cause analysis to a subagent:
   - provide the bug description, affected files, error messages, and relevant code context
   - require: root cause hypothesis, affected code locations, and a proposed fix approach
   - the subagent must not modify files or update Linear
5. Present the analysis to the user:
   - root cause hypothesis
   - affected files and code locations
   - proposed fix approach
   - ask: "Does this direction look right? Any additions or corrections?"
6. Wait for user confirmation before proceeding.
7. On confirmation, write the analysis to the Linear issue:
   - use `_save_comment` with the root cause, fix approach, and affected files
   - this creates a durable record of the analysis
8. Ask the user: "Do you want to fix this now?"
9. If the user declines, stop. The bug is recorded and analyzed. The user can invoke `bugger` again later or use `task-runner` for a more complex fix flow.
10. If the user confirms, proceed to Phase 2.

### Phase 2: Fix And Commit

1. Decide the commit strategy based on the current branch:
   - **On a task branch or worktree**: fix, commit, and the user can later submit a PR through `task-runner` or manually.
   - **On `main`**: fix and commit directly. Do not create a new branch unless the user explicitly asks.
2. Mark the bug issue as actively being fixed:
   - use `_save_issue` to move the issue to the mapped in-progress equivalent before code changes begin
3. Delegate the fix to `agent-sop`:
   - provide the confirmed root cause, fix approach, and affected files
   - agent-sop handles the multi-phase execution: test decision, implementation, verification
   - agent-sop must follow local patterns and protect unrelated changes
4. Inspect the result and run validation:
   - targeted tests, lint, build, or manual checks as appropriate
   - verify the fix addresses the root cause without regressions
5. Commit the changes:
   - commit message should reference the Linear issue key and a brief description of the fix
   - do not include unrelated changes in the commit
6. Write the fix evidence back to Linear:
   - use `_save_comment` to record the fix summary, files changed, validation result, and commit hash
   - use `_save_issue` to move the issue to the mapped ready-for-acceptance equivalent
7. Hand off to `human-acceptance` for final sign-off:
   - the bug issue is recorded in Linear with analysis and fix evidence
   - human-acceptance handles the acceptance decision, Linear status update, and any post-acceptance learning

## Comment Template

### Root Cause Analysis Comment

```markdown
## Bug Analysis

**Root Cause**: <hypothesis or confirmed cause>

**Affected Files**:
- <file_path>:<line_range> — <what's wrong>

**Proposed Fix**: <approach description>

**Status**: Awaiting user confirmation
```

### Fix Comment

```markdown
## Bug Fix

**Fix Applied**: <brief description of what was changed>

**Files Changed**:
- <file_path> — <what was changed>

**Validation**:
- <test/lint/build command> — <pass/fail>

**Commit**: <commit hash or message>
**Status**: Ready for human acceptance
```

## Delegation

When delegating to `agent-sop`, provide:

- Bug description and root cause from Phase 1.
- Confirmed fix approach from the user.
- Affected files and modules.
- Constraints: follow local patterns, protect unrelated changes, no context-mode inside subagent.
- Expected artifact: the fix implementation with validation evidence.

When delegating root cause analysis, provide:

- Bug description, symptoms, and reproduction steps.
- Affected code files and modules.
- Error messages, logs, or CI output when available.
- Constraints: analyze only, do not modify files.
- Expected artifact: root cause hypothesis, affected code locations, proposed fix approach.

## Validation

Before reporting completion, verify:

- The bug was recorded as a Linear issue with a valid status.
- The team-specific equivalents for triage/backlog, in-progress, and ready-for-acceptance were resolved before status changes.
- Root cause analysis was written to a Linear comment before the fix started.
- The user confirmed the fix direction before implementation.
- The fix was delegated to `agent-sop` and validated by the main agent.
- The commit includes only bug-related changes and references the Linear issue.
- Fix evidence was written back to Linear after the commit.
- The bug issue status reflects the current state using the mapped workflow states.
- The user was informed that `human-acceptance` is required for final sign-off.

## Common Mistakes

- Skipping user confirmation on the fix direction and implementing a wrong fix.
- Committing unrelated changes along with the bug fix.
- Updating Linear status to done without going through `human-acceptance`.
- Creating a duplicate Linear issue when the user already supplied a valid issue key.
- Creating a new branch on `main` without the user explicitly asking.
- Changing issue statuses without first mapping the team's actual workflow states.
- Writing the analysis comment after the fix instead of before.
