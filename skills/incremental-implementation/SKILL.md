---
name: incremental-implementation
description: Deliver changes in thin vertical slices. Use when implementing any feature or change touching more than one file, or when you're about to write a large amount of code at once. Do not use for single-file, single-function changes with minimal scope.
---

# Incremental Implementation

Build in thin vertical slices — implement one complete piece, test it, verify it, commit, then expand. Avoid implementing an entire feature in one pass. Each increment leaves the system in a working, testable state.

## Contract

Use this skill for multi-file features, refactors, and large changes.

Do not use for single-file, single-function changes where scope is already minimal.

## The Increment Cycle

```
Implement → Test → Verify → Commit → Next slice
```

1. Implement the smallest complete piece of functionality.
2. Run tests — write one if none exists yet.
3. Confirm the slice works (tests pass, build succeeds).
4. Commit with a descriptive message.
5. Move to the next slice.

## Slicing Strategies

**Vertical slices (preferred):** Build one complete path through the stack (DB + API + UI). Each slice delivers working end-to-end functionality before starting the next.

**Contract-first:** Define the API contract first, then backend and frontend can develop in parallel against it.

**Risk-first:** Tackle the riskiest or most uncertain piece first. If it fails, you discover it before investing in dependent slices.

## Implementation Rules

**Rule 0 — Simplicity first:** Ask "what is the simplest thing that could work?" before writing any code. After writing, review: Can this be fewer lines? Are these abstractions earning their complexity? Would a staff engineer say "why didn't you just..."?

Three similar lines of code is better than a premature abstraction. Implement the naive, obviously-correct version first.

**Rule 0.5 — Scope discipline:** Touch only what the task requires. Do not "clean up" adjacent code, refactor imports in unrelated files, or add features not in the spec. If you notice something worth improving outside scope, note it and ask — don't fix it.

**Rule 1 — One thing at a time:** Each increment changes one logical thing. Don't mix concerns in a single commit.

**Rule 2 — Stay compilable:** After each increment, the project must build and existing tests must pass. Never leave the codebase broken between slices.

**Rule 3 — Feature flags for incomplete work:** If a feature isn't ready for users but you need to merge increments, guard with a feature flag so incomplete work isn't user-visible.

**Rule 4 — Rollback-friendly:** Each increment should be independently revertable. Additive changes (new files, new functions) are easiest to revert. Separate deletions from replacements into distinct commits.

## Delegating to Agents (agent-sop integration)

When directing `agent-sop` to implement incrementally, be explicit about what is in scope and what is not:

```
"Implement Task [N]: [specific goal].
Scope: [DB schema change + API endpoint only].
Do NOT touch [the UI / other modules] — that is the next increment.
After implementing, run [test command] and [build command] and report results."
```

## Increment Checklist

After each increment:

- [ ] Change does one thing and does it completely
- [ ] All existing tests still pass
- [ ] Build succeeds
- [ ] New functionality works as expected
- [ ] Change is committed with a descriptive message

## Red Flags

- More than ~100 lines written without running tests
- Multiple unrelated concerns in a single increment
- "Let me just quickly add this too" scope expansion
- Build or tests broken between increments
- Large uncommitted changes accumulating
- Abstractions built before the third use case demands it
- Running the same build/test command twice without an intervening code change

## Verification

After completing all increments:

- [ ] Each increment was individually tested and committed
- [ ] Full test suite passes
- [ ] Build is clean
- [ ] Feature works end-to-end as specified
- [ ] No uncommitted changes remain
