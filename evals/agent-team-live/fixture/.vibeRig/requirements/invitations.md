# Invitation administration

Risk: L2 because this changes a public HTTP contract and authorization boundary. The migration is additive and reversible.

- AC-1: an authenticated administrator can create an invitation through `POST /v1/invitations`.
- AC-2: a non-administrator receives 403 and no invitation is persisted.
- AC-3: the service exposes a health endpoint and the Runbook covers rollback of the additive migration.
- Required TC: a real HTTP E2E test must cover success, durable state, and authorization denial.
