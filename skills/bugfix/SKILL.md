---
name: bugfix
description: Implement a confirmed bug fix in the current workspace. Use after `bugger` has analyzed the root cause and the user has explicitly confirmed the fix direction. Executes the fix through agent-sop, commits, records evidence in Linear, and hands off to `accept-issue` for final sign-off.
---

# Bug Fix

Use this skill to implement a confirmed bug fix.

This skill is Phase 2 of the VibeRig bug flow. Use `bugger` first to record the bug in Linear, analyze the root cause, and get explicit user confirmation. Then use this skill to execute the fix.

## Contract

Use this skill only when `bugger` has produced a root cause analysis comment in Linear and the user has explicitly confirmed the fix direction.

Do not use without prior `bugger` output and user confirmation. Do not use for new feature implementation, requirement discovery, or worktree-isolated execution; use `task-runner` for those.

Stop when the confirmed fix approach is missing, the bug issue cannot be resolved in Linear, or the user has not provided explicit confirmation.

## Input Contract

Required:
- Linear bug issue key (created by `bugger`).
- Root cause and confirmed fix approach from `bugger`.
- Affected files.

Optional:
- Error messages, stack traces, failing test output.
- Constraints on what must not change.

## Output Contract

Return:
- Files changed and diff summary.
- Validation results (tests, lint, build).
- Commit hash referencing the Linear issue key.
- Fix evidence comment posted to Linear.
- Linear issue updated to ready-for-acceptance state.
- Handoff instruction to invoke `accept-issue` for final sign-off.

## Workflow

1. **Branch lock (execute first, no exceptions)**: Modify in place on the current branch and workspace. `git checkout -b`, `git switch -c`, and worktree creation are strictly forbidden regardless of the current branch — including main. This skill never creates branches or PRs.
2. Read `.vibeRig/project.yaml` for output language and Linear context when available.
3. Mark the bug issue as in-progress with `_save_issue`.
4. Write a failing reproduction test before implementing the fix (Prove-It Pattern):
   - Write a test that demonstrates the bug as described in the `bugger` root cause analysis.
   - Run the test — it **must fail** (this confirms the bug is captured and the test is valid).
   - If the test passes immediately, the test is not testing the right thing — revise it before proceeding.
   - Include this reproduction test in the fix delegation brief.
5. Delegate the fix to `agent-sop`:
   - Provide confirmed root cause, fix approach, affected files, and the reproduction test from step 4.
   - Constraints: follow local patterns, protect unrelated changes, no Linear/status updates, **modify in place on the current branch — do not create branches or worktrees**.
   - Required artifact: fix implementation where the reproduction test now passes, plus parallel quality review (code review + security + test coverage).
6. Inspect the result and run main-agent validation:
   - Confirm the reproduction test passes.
   - Run targeted tests, lint, and build to check for regressions.
   - Verify the fix addresses the root cause, not just the symptom.
7. If validation fails, loop through `agent-sop` rework (max 3 rounds). After 2 identical failures, escalate with failed evidence.
8. Commit the fix:
   - Run `git diff --staged --name-only` and confirm only bug-related files are staged.
   - Reference the Linear issue key in the commit message.
9. Write fix evidence to Linear with `_save_comment`:
   - Files changed, reproduction test result (before/after), validation result, commit hash.
10. Update Linear issue to ready-for-acceptance state with `_save_issue`.
11. Tell the user that `accept-issue` is required for final sign-off and Linear closure.

## Red Flags

- A branch was created or worktree was added during execution → this skill strictly forbids branch switching; use `task-runner` for worktree-isolated work.
- Fix was implemented without `bugger` root cause analysis in Linear → this skill requires a confirmed analysis comment from bugger Phase 1.
- No reproduction test was written before the fix — the Prove-It Pattern was skipped → a fix without a failing test is a guess; the regression is unguarded.
- Reproduction test passed immediately without any code change → the test is not testing the right thing; revise it.
- Commit includes unrelated files → inspect staged diff before committing; include only bug-related changes.
- Fix addresses the symptom but not the root cause → ask "why does this happen?" until reaching the actual cause.
- Linear was moved to Done from this skill → only `accept-issue` or `accept-milestone` may set terminal statuses.
- Validation was skipped because the fix "looks right" → run targeted tests before committing; a visual check is not evidence.
- The same rework brief was sent to the subagent twice without changing the approach → change the approach or escalate after 2 identical failures.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "Fixing on main is unsafe, I should branch first" | **This skill strictly forbids creating branches.** Fix and commit in place on the current branch. Use `task-runner` if branch isolation is needed. |
| "The fix is small, I can skip agent-sop delegation" | Even small fixes benefit from bounded delegation and a QA check. The separation catches regressions the implementer is biased to miss. |
| "The branch has some unrelated staged changes — I'll include them to save a commit" | Unrelated changes in a bug-fix commit complicate revert and audit. Stage only the bug diff. |
| "Validation passed once, it's fine to commit" | Run the targeted test suite consistently. One pass is not evidence if the test is flaky or the coverage is shallow. |
| "I'll move the issue to Done since the fix is verified" | Done is a terminal state that requires explicit user sign-off. Use `accept-issue` for closure. |

## Verification Checklist

```bash
# Confirm still on the original branch (no branch switch occurred)
git branch --show-current

# Confirm only bug-related files are staged
git diff --staged --name-only

# Confirm Linear issue key is referenced in commit message
git log -1 --pretty="%s" | grep -q "<issue-key>" && echo "ok" || echo "MISSING ISSUE KEY"
```

- [ ] Root cause and fix direction confirmed by `bugger` Phase 1 and user.
- [ ] Reproduction test written and confirmed to fail before the fix was implemented.
- [ ] Fix delegated to `agent-sop` with a bounded brief including the reproduction test and parallel quality review.
- [ ] Reproduction test passes after the fix.
- [ ] Main-agent validation ran targeted tests — result recorded.
- [ ] Staged diff inspected; only bug-related changes included.
- [ ] Commit references the Linear issue key.
- [ ] Fix evidence written to Linear comment (including reproduction test before/after).
- [ ] Linear issue is in ready-for-acceptance state, not a terminal state.
- [ ] User was informed that `accept-issue` is required for final closure.
