# E2E Test Contract

`e2e-contract.json` records the business oracle and executable lifecycle for required API/UI E2E tests. Validate it with `../../pre-development/assets/e2e-contract.schema.json`.

## Lifecycle

```text
AC confirmed
  → E2E contract drafted
  → runnable test written before production implementation
  → RED evidence proves the expected missing behavior
  → oracle/review accepted in the existing planning approval
  → contract revision locked
  → implementation proceeds without weakening the locked test
  → authoritative Issue or Milestone execution produces PASS evidence
  → owner UAT remains a separate TC
```

The requirement Gate approves the business oracle. For L2/L3 E2E, an independent QA or technical owner reviews the runnable test and RED evidence; the result is included in the same planning approval package, not a new approval ceremony. High-consequence money, authorization, core-invariant, irreversible migration, safety or compliance contracts require a human owner reviewer.

## Lock rule

After `status=locked`, implementation Agents may not delete, skip, weaken or silently rewrite the expected outcome, fidelity, environment, scope or test path. A legitimate semantic change increments `contractRevision`, sets the prior lock to `superseded`, invalidates dependent Evidence and returns to contract review. Pure refactoring that preserves the oracle may be reviewed by independent QA and relocked at the new revision.

RED evidence must show that the test fails because the required behavior is absent or incorrect—not because setup, credentials, fixtures or the test itself are broken. A cross-Issue Milestone E2E may be drafted and locked before Issue execution even when its first runnable RED occurs on an integration branch; record that boundary explicitly rather than pretending it ran earlier.

## Ownership and stages

- Product/requirement owner: approves AC and observable E2E oracle.
- Test engineer or implementation Agent: writes the runnable failing test.
- Independent QA/technical owner: checks fidelity, negative paths and RED cause, then locks the revision.
- Issue Agent: runs only `issue_local` E2E assigned to the Issue.
- Integrator/milestone flow: runs cross-Issue E2E at `milestone`.
- Owner: performs UAT as a separate node; automation never marks it passed.

Every E2E contract points to one test file, one authoritative stage, required fidelity, declared environment, invalidation rules, RED Evidence and—after success—PASS Evidence tied to the current revision.
