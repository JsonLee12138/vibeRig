---
name: quick
description: Implement a small, already-confirmed single-issue task in place — no branch, no worktree. Trigger after a fix/change direction is explicitly confirmed (e.g. `bugger` produced a confirmed fix, or the user directly confirmed a tiny scoped change). Not for new features, requirement discovery, multi-issue milestone work, or anything needing worktree isolation/a PR — use `task-runner` for those.
---

# Quick（小任务直改）

Use this skill to implement a small, already-confirmed, single-issue task — a confirmed bug fix, a tiny scoped tweak, or a one-off chore — directly in the current workspace.

This replaces the old `bugfix` skill: same in-place, no-branch execution model, generalized from "confirmed bug fix only" to "any small confirmed task." For bugs, this is still Phase 2 of the VibeRig bug flow — use `bugger` first to record the bug, analyze root cause, and get explicit user confirmation, then use this skill to execute the fix. For non-bug tiny tasks, the user's explicit confirmation of scope/approach in the current conversation is sufficient — no separate analysis phase is required.

## Contract

Use this skill only when the change direction has been explicitly confirmed:
- Bug fix: `bugger` has produced a root cause analysis comment in Linear and the user has explicitly confirmed the fix direction.
- Non-bug small task: the user has explicitly confirmed scope and approach in the current conversation.

Do not use for new feature implementation, requirement discovery, multi-issue milestone work, or worktree-isolated execution; use `task-runner` for those.

Stop when the confirmed approach is missing, the issue cannot be resolved in Linear, or the user has not provided explicit confirmation.

## Input Contract

Required:
- Linear issue key (bug issue created by `bugger`, or any other tracked issue).
- Confirmed approach and affected files.

Optional:
- Error messages, stack traces, failing test output (for bug fixes).
- Constraints on what must not change.

## Output Contract

Return:
- Files changed and diff summary.
- Validation results (tests, lint, build).
- Commit hash referencing the Linear issue key.
- Evidence comment posted to Linear.
- Linear issue updated to ready-for-acceptance state.
- Handoff instruction to invoke `accept-issue` for final sign-off.

## Workflow

1. **Branch lock (execute first, no exceptions)**: Modify in place on the current branch and workspace. `git checkout -b`, `git switch -c`, and worktree creation are strictly forbidden regardless of the current branch — including main. This skill never creates branches, worktrees, or PRs.
2. Read `.vibeRig/project.yaml` for output language and Linear context when available.
3. **vb-wiki targeted lookup (exactly once, right after reading the issue, before delegating)**: after reading the issue/confirmed approach, run **exactly one** targeted query against the `vb-wiki` qmd collection keyed off the issue's title/keywords — `npx -y @tobilu/qmd vsearch "<issue title/keywords>" -c vb-wiki`, or the equivalent structured call via the `qmd` MCP `query` tool when running inside an agent session where that's more natural than shelling out. Either form satisfies this step; use whichever fits the calling context.
   - **0 hits** — this includes `~/.vb-wiki` not existing, the collection not being registered, and any qmd error — treat all of these as 0 hits, never as a failure: inject nothing, mention nothing to the user, do not error, proceed to step 4 exactly as if this step were skipped.
   - **≥1 hit** above a reasonable relevance threshold: note the matched page's path/conclusion and actually cite it (path and/or quoted finding) in the delegation brief (step 5) and in the final report when it's relevant to the fix approach — do not just log it silently.
   - This is exactly **one** query per issue, not a query per turn or per `agent-sop` rework round — never re-query mid-task.
   - If the `qmd` MCP server isn't configured/reachable, treat it the same as 0 hits and continue; never block or fail this skill's flow on it.
4. Ask `vb-linear` to mark the issue as in-progress.
5. Write a test proving the change before implementing it:
   - **Bug fix**: write a failing reproduction test that demonstrates the bug as described in the `bugger` root cause analysis (Prove-It Pattern). Run it — it **must fail** first; if it passes immediately, it's not testing the right thing.
   - **Non-bug small task**: write or adjust the test(s) that prove the confirmed change works, following `test-driven-development` practice where applicable.
   - Include this test in the delegation brief.
6. Delegate the change to `agent-sop`:
   - Provide the confirmed approach, affected files, and the test from step 5.
   - If step 3 found a relevant vb-wiki hit, include its path/conclusion in the brief.
   - Constraints: follow local patterns, protect unrelated changes, no Linear/status updates, **modify in place on the current branch — do not create branches or worktrees**.
   - Required artifact: implementation where the test now passes, plus parallel quality review (code review + security + test coverage).
7. Inspect the result and run main-agent validation:
   - Confirm the test passes.
   - Run targeted tests, lint, and build to check for regressions.
   - For bug fixes: verify the fix addresses the root cause, not just the symptom.
8. If validation fails, loop through `agent-sop` rework (max 3 rounds). After 2 identical failures, escalate with failed evidence.
9. Commit the change:
   - Run `git diff --staged --name-only` and confirm only in-scope files are staged.
   - Reference the Linear issue key in the commit message.
10. Ask `vb-linear` to write evidence to Linear:
   - Files changed, test result (before/after), validation result, commit hash.
11. Ask `vb-linear` to update the Linear issue to ready-for-acceptance state.
12. Tell the user that `accept-issue` is required for final sign-off and Linear closure.

## Red Flags

- A branch was created or worktree was added during execution → this skill strictly forbids branch switching; use `task-runner` for worktree-isolated work.
- A bug fix was implemented without `bugger` root cause analysis in Linear → this skill requires a confirmed analysis comment from bugger Phase 1 for bugs.
- No proving test was written before the change — the Prove-It Pattern (or TDD equivalent) was skipped → a change without a test is a guess; the regression is unguarded.
- Reproduction test passed immediately without any code change → the test is not testing the right thing; revise it.
- Commit includes unrelated files → inspect staged diff before committing; include only in-scope changes.
- Fix addresses the symptom but not the root cause (bugs) → ask "why does this happen?" until reaching the actual cause.
- Linear was moved to Done from this skill → only `accept-issue` or `accept-milestone` may set terminal statuses.
- Validation was skipped because the change "looks right" → run targeted tests before committing; a visual check is not evidence.
- The same rework brief was sent to the subagent twice without changing the approach → change the approach or escalate after 2 identical failures.
- The vb-wiki lookup was run more than once for the same issue (e.g. once per rework round) → exactly one query per issue, never a per-turn habit.
- The vb-wiki lookup returned a hit but it never showed up in the delegation brief or final report → a hit must be cited, not just noted internally.
- A missing/unreachable qmd server or missing `~/.vb-wiki` was treated as a blocking error → treat it as a 0-hit no-op and continue.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "Working on main is unsafe, I should branch first" | **This skill strictly forbids creating branches.** Change and commit in place on the current branch. Use `task-runner` if branch isolation is needed. |
| "The task is small, I can skip agent-sop delegation" | Even small changes benefit from bounded delegation and a QA check. The separation catches regressions the implementer is biased to miss. |
| "The branch has some unrelated staged changes — I'll include them to save a commit" | Unrelated changes complicate revert and audit. Stage only the in-scope diff. |
| "Validation passed once, it's fine to commit" | Run the targeted test suite consistently. One pass is not evidence if the test is flaky or the coverage is shallow. |
| "I'll move the issue to Done since the change is verified" | Done is a terminal state that requires explicit user sign-off. Use `accept-issue` for closure. |
| "This is a bit bigger than I thought, but I'm already in here" | If the scope grows past a small, already-confirmed change, stop and route to `task-runner` for worktree-isolated execution instead of expanding scope in place. |

## Verification Checklist

```bash
# Confirm still on the original branch (no branch switch occurred)
git branch --show-current

# Confirm only in-scope files are staged
git diff --staged --name-only

# Confirm Linear issue key is referenced in commit message
git log -1 --pretty="%s" | grep -q "<issue-key>" && echo "ok" || echo "MISSING ISSUE KEY"
```

- [ ] Confirmed approach exists (bugger Phase 1 + user confirmation for bugs; direct user confirmation for other small tasks).
- [ ] Exactly one vb-wiki targeted query ran right after reading the issue; 0 hits were a silent no-op, ≥1 hit was cited in the brief/report.
- [ ] Proving test written and confirmed to fail/demonstrate the gap before the change was implemented.
- [ ] Change delegated to `agent-sop` with a bounded brief including the test and parallel quality review.
- [ ] Test passes after the change.
- [ ] Main-agent validation ran targeted tests — result recorded.
- [ ] Staged diff inspected; only in-scope changes included.
- [ ] Commit references the Linear issue key.
- [ ] Evidence written to Linear comment (including test before/after).
- [ ] Linear issue is in ready-for-acceptance state, not a terminal state.
- [ ] User was informed that `accept-issue` is required for final closure.
