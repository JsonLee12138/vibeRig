# Fixture rules

- This is a backend-only repository.
- Do not modify production files during test authoring or review.
- Test authoring may write only under `e2e/`.
- E2E tests must drive `internal/httpapi.Handler` with `httptest.NewRequest` and `httptest.NewRecorder`; a test-owned replacement handler or listener socket is not the SUT.
- Review agents are read-only and must cite file and line evidence.
