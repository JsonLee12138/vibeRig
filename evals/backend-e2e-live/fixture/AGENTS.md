# Fixture repository rules

- The confirmed requirement is in `docs/requirement.md` and the API contract is in `api/openapi.yaml`.
- The only authorized product of this task is `e2e/invitations_test.go`.
- Do not modify `cmd/`, `internal/`, `api/`, `docs/`, `scripts/`, `Makefile`, or `go.mod`.
- Use the existing Go standard-library test stack; do not add dependencies.
- Exercise the running service through HTTP. Do not import or call `internal/invites` from E2E tests.
- Test-only state inspection is available only through the documented `GET /__test/state` boundary.
