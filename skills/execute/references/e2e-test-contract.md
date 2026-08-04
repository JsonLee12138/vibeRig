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

## Backend API E2E construction

An `api_e2e` test crosses the service's public protocol boundary and observes owned state or externally visible side effects. Calling a controller/handler in-process with mocked repositories is an integration test, not API E2E. Start the SUT through the project's declared runtime (process, container, or emulator), send real HTTP/gRPC/GraphQL/message traffic, and use disposable real instances for owned databases, caches and brokers. An uncontrollable third-party may be replaced only at its system boundary by a declared sandbox or protocol-faithful fake; never replace the SUT or its owned persistence to make E2E convenient.

Build the smallest risk-based suite around an AC or invariant, not one E2E per endpoint and not a duplicate of the unit-test matrix:

1. bootstrap the declared runtime and disposable dependencies, then wait for health/readiness;
2. create isolated data through public setup APIs or versioned fixtures with a unique run namespace;
3. exercise the public protocol with production-equivalent authentication, serialization and middleware;
4. assert the response plus relevant durable state and observable side effects, without coupling to private functions;
5. cover the critical negative boundary for the risk: authentication/authorization, validation, tenant isolation, idempotency, rollback or concurrency;
6. for asynchronous outcomes, poll an observable condition with a deadline and diagnostic output—never use an unexplained fixed sleep;
7. always reset or destroy the namespace and record the exact bootstrap, health, test and reset commands.

The runnable test is the deliverable. A prose procedure or generated pseudocode is insufficient when the project has an executable test framework. Evidence should retain the test report and, when relevant, service logs, protocol traces, database snapshots or message traces. RED review must first prove setup and health succeeded, then show the locked business assertion failing for the expected missing behavior.

Before writing, use the Context Router to inspect the repository's existing E2E framework, configuration, fixture helpers, API contract and declared environment commands. Do not invent generic paths such as `tests/e2e/example.*`, leave placeholders, or describe “the project's command.” A draft may record unresolved grounding, but it cannot become `locked` until the test exists at an exact repository path, the exact command collects that file, and Evidence records the file hash plus collection result. Only then run and review RED.
