# REQ-INVITE-1 — Team invitation

The requirement and acceptance criteria are confirmed.

## AC-1 — Administrator invitation

Given an empty test namespace and `Authorization: Bearer admin-token`, when the client sends:

```http
POST /teams/team-1/invitations
Content-Type: application/json

{"email":"new@example.com"}
```

then:

- the response is `201` and identifies `team-1` and `new@example.com`;
- exactly one durable invitation exists for that team/email;
- exactly one sandbox mail eventually exists for `new@example.com`;
- asynchronous mail observation must use bounded polling with a diagnostic deadline, not a fixed sleep.

## AC-2 — Authorization boundary

Given `Authorization: Bearer member-token`, the same request for `blocked@example.com` returns `403`. It must create neither an invitation nor a mail for that address.

## Test-state boundary

The local disposable environment exposes these test-only endpoints. Send `X-Test-Key: fixture-key`:

- `DELETE /__test/reset` resets durable invitations and sandbox mails;
- `GET /__test/state` returns `{ "invitations": [...], "mails": [...] }`.

These endpoints are the declared E2E observation boundary for owned persistence and sandbox mail. They must not replace the public invitation request itself.

## Test contract

- exact test path: `e2e/invitations_test.go`;
- authoritative command: `make e2e-test`;
- required fidelity: real HTTP service process plus durable local owned state;
- RED is trusted only after `make e2e-health` succeeds and a business assertion fails;
- the test must remain unchanged between RED and GREEN evaluation.
