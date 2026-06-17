---
name: code-simplification
description: Use when the user asks to simplify, reduce complexity, or improve readability of existing code without changing behavior. Triggers on "simplify", "too complex", "hard to read", "reduce nesting", "clean up", "make clearer", or "refactor for clarity". Not for bug fixes, feature additions, or performance tuning.
status: active
---

# Code Simplification

Systematically refactor code for clarity and maintainability. The fundamental test: **would a new team member understand this faster?** Behavior must be preserved exactly.

## Contract

Use this skill to improve the readability and structure of code that works but is harder to read, maintain, or extend than it should be.

Do not use this skill for:
- Bug fixes — use `bugfix` instead.
- Feature work or behavior changes — any change that alters outputs, errors, or side effects is out of scope.
- Performance optimization — a separate concern with different tradeoffs.
- Unsolicited drive-by cleanup of files unrelated to the user's stated scope.

Stop and report when the code's intent is unclear and simplification would require guessing at behavior (Chesterton's Fence applies).

## Input Contract

Required:
- The file(s) or function(s) to simplify.
- Confirmation that behavior must be preserved (assumed if not stated otherwise).

Optional:
- Specific patterns to target (nesting, naming, duplication, function length).
- Existing tests or commands to verify behavior before and after.

## Output Contract

Return:
- Files changed and a summary of each simplification applied.
- The test or verification command run and its pass/fail result.
- Any patterns intentionally left unchanged and why.

Do not claim completion unless at least one verification step (existing tests, build, type-check, or manual diff review) confirms behavior is unchanged.

## Foundational Principles

1. **Preserve behavior exactly** — outputs, errors, side effects, and edge cases remain unchanged.
2. **Follow project conventions** — match existing patterns; do not impose external style preferences.
3. **Prefer clarity over cleverness** — explicit code beats compact code requiring mental parsing.
4. **Apply incrementally** — one change, verify, then continue; do not batch unverified simplifications.
5. **Scope to what was asked** — focus on the stated files; avoid unscoped opportunistic cleanups.

## Workflow

1. **Understand first (Chesterton's Fence).**
   - Read the target code and any callers or tests before changing anything.
   - Identify why the code is structured as it is. If the reason is unknown, note it before proceeding.
2. **Identify opportunities.**
   - Scan for signals from the Key Patterns list below.
   - Rank by impact: structural complexity > naming > duplication.
3. **Apply incrementally.**
   - Make one logical change at a time.
   - Run the verification command after each change, not at the end.
4. **Verify results.**
   - Confirm the simplified version is genuinely clearer, not just shorter.
   - Run existing tests or build. If none exist, do a manual diff review and document the gap.

## Key Patterns

| Signal | Threshold | Approach |
|---|---|---|
| Deep nesting | 3+ levels | Extract early returns or named helpers |
| Long function | 50+ lines | Split into focused, named sub-functions |
| Nested ternaries | 2+ levels | Replace with if/else or named variables |
| Generic names | `data`, `temp`, `val`, `item` | Rename to domain-specific terms |
| Duplicated logic | 2+ copies | Extract to a shared helper |
| Comment explaining what | Any | Rename the thing so the comment is unnecessary |

## Critical Boundaries

Do not simplify:
- Code that is already clean — unnecessary churn creates noise in diffs.
- Code you do not fully understand — misread intent leads to silent behavior changes.
- Performance-critical sections without explicit profiling evidence that the change is safe.
- Multiple patterns in one commit without testing each — batch simplifications mask which change broke behavior.

## Validation

```bash
# Run existing tests to confirm behavior is unchanged
# Replace with the actual test command for this project
npm test 2>&1 | tail -10        # Node projects
python -m pytest -x 2>&1 | tail -10  # Python projects
go test ./... 2>&1 | tail -10   # Go projects
```

- [ ] At least one verification step ran and passed (tests, build, type-check, or lint).
- [ ] No behavior-altering changes are present in the diff.
- [ ] Each simplification is a distinct, reviewable unit (not one giant commit).
- [ ] Patterns intentionally left unchanged are noted with a reason.
