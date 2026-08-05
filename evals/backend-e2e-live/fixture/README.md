# Invitation API E2E fixture

This is a deliberately small backend repository used to author a real API E2E test before completing production behavior.

Commands:

```bash
make e2e-up
make e2e-health
make e2e-test
make e2e-reset
```

`make e2e-up` starts a real HTTP service process with durable file-backed owned state. `make e2e-test` runs `go test ./e2e -count=1` against `BASE_URL` (default `http://127.0.0.1:18080`). The sandbox mail delivery is observable through the test-state endpoint documented in `docs/requirement.md`.

Production behavior is intentionally incomplete. A failing business assertion is a valid RED. Setup failures, connection failures, test compilation failures, skipped tests, weakening the confirmed oracle, or modifying production code are not valid RED evidence.
