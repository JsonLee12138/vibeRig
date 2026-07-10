---
name: test-driven-development
description: Drive implementation and bug fixes with tests. Use when implementing any logic, changing existing behavior, or fixing bugs (Prove-It Pattern). Do not use for configuration-only changes, documentation updates, or static content with no behavioral impact.
---

# Test-Driven Development

Write a failing test before writing the code that makes it pass. For bug fixes, reproduce the bug with a test before attempting the fix. Tests are proof — "seems right" is not done.

## Contract

Use this skill for new behavior implementation, behavior changes, and bug fix validation.

Do not use for documentation-only, trivial config changes, or static content. For bug tracking and root cause analysis, use `bugger` first; for fix implementation with the Prove-It Pattern, use `quick`.

## The TDD Cycle

```
RED → GREEN → REFACTOR → (repeat)
```

1. **RED** — Write a test that fails. A test that passes immediately proves nothing.
2. **GREEN** — Write the minimum code to make it pass. No over-engineering.
3. **REFACTOR** — Clean up the implementation. Tests must stay green after every change.

## The Prove-It Pattern (Bug Fixes)

Do not start a bug fix by touching production code. Start by writing a reproduction test:

```
Bug arrives
 → Write a test that demonstrates the bug
 → Test FAILS (confirms the bug exists)
 → Implement the fix
 → Test PASSES (proves the fix works)
 → Run full suite (no regressions)
```

This is required by `quick`. A fix without a reproduction test is a guess.
See `references/testing-patterns.md` for code examples.

## Test Decision (for agent-sop step 2)

**Require tests:**
- New behavior, bug fixes, shared/reused logic
- Parsing, data transformation, security-sensitive flows
- Any change that could break existing behavior

**Allow skipping:**
- Documentation-only or static content changes
- Trivial config or copy changes
- Unavailable test infrastructure
- A better verification path exists (type-checking, manual demo)

Record the decision and reason. "Looks right" is not evidence.

## Test Pyramid

```
E2E (~5%)          — Full user flows, real browser
Integration (~15%) — Component interactions, API boundaries
Unit (~80%)        — Pure logic, isolated, milliseconds each
```

Invest most tests at the unit level. Fast, reliable, easy to debug.

## Writing Good Tests

- **Test state, not interactions** — assert on outcomes, not which internal methods were called.
- **DAMP over DRY** — each test tells a complete story without tracing shared helpers.
- **Prefer real implementations over mocks** — use real dep when fast/deterministic; fake > stub > mock; mock only at external boundaries where real deps are slow or non-deterministic.
- **One concept per test** — descriptive names, Arrange-Act-Assert structure.

For detailed code examples and anti-patterns, see `references/testing-patterns.md`.

## Red Flags

- Code written without a corresponding test
- Bug fixes without a reproduction test (Prove-It Pattern skipped)
- Tests that pass on the first run without any implementation — they may not test what you think
- Test names that don't describe expected behavior (`it('works')`)
- Skipping tests to make the suite pass
- Running the same test command twice without an intervening code change

## Verification

After completing any implementation:

- [ ] Every new behavior has a corresponding test
- [ ] All tests pass (run the project's test command)
- [ ] Bug fixes include a reproduction test that failed before the fix
- [ ] Test names describe the behavior being verified
- [ ] No tests were skipped or disabled
