---
name: test-driven-development
description: 在 execute Goal Loop 中用测试驱动新逻辑、行为变化和 Bug 修复，并为缺少配置或依赖的测试自动选择 fake、stub、ephemeral dependency 或 sandbox。文档、纯静态内容或无行为配置不使用。
---

# Test-Driven Development

Write a failing test before writing the code that makes it pass. For bug fixes, reproduce the bug with a test before attempting the fix. Tests are proof — "seems right" is not done.

## Contract

Use this skill for new behavior implementation, behavior changes, and bug fix validation.

Do not use for documentation-only, trivial config changes, or static content. 问题建模由 `intake` 完成，实现与验证由 `execute` 持有；本 skill 只提供测试策略。

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

This is the default for `execute`. If a deterministic automated reproduction is impossible, capture the highest-fidelity failing evidence available and explain the boundary; silently skipping proof is not allowed.
See `references/testing-patterns.md` for code examples.

## Test Decision (for agent-sop step 2)

**Require tests:**
- New behavior, bug fixes, shared/reused logic
- Parsing, data transformation, security-sensitive flows
- Any change that could break existing behavior

**Allow not adding a new automated test:**
- Documentation-only or static content changes
- Trivial config or copy changes
- A better verification path exists (type-checking, manual demo)

Record the decision and reason. "Looks right" is not evidence.

Unavailable test infrastructure is not a skip reason. Read `../execute/references/test-environment-broker.md` and automatically resolve fixtures, fake values, protocol stubs, disposable dependencies, emulators, or sandboxes. Ask the user only when the TC requires a real environment that cannot be safely simulated.

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
- **Use sufficient fidelity** — use real dependency when fast/deterministic; fake > stub > mock for simple boundaries; use ephemeral real dependencies for database, migration, concurrency, queue, cache, and protocol semantics that mocks cannot prove.
- **One concept per test** — descriptive names, Arrange-Act-Assert structure.

For detailed code examples and anti-patterns, see `references/testing-patterns.md`.

## Red Flags

- Code written without a corresponding test
- Bug fixes without a reproduction test (Prove-It Pattern skipped)
- Tests that pass on the first run without any implementation — they may not test what you think
- Test names that don't describe expected behavior (`it('works')`)
- Skipping tests to make the suite pass
- Running the same test command twice without an intervening code change
- Asking the user for test-only secrets that can be generated or simulated
- Claiming a mock pass satisfies a sandbox/real TC

## Verification

After completing any implementation:

- [ ] Every new behavior has a corresponding test
- [ ] All tests pass (run the project's test command)
- [ ] Bug fixes include a reproduction test that failed before the fix
- [ ] Test names describe the behavior being verified
- [ ] No tests were skipped or disabled
- [ ] Missing configuration was resolved automatically when mockable
- [ ] Evidence records environment fidelity and uncovered real-world differences
