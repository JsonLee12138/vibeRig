# Tenant-scoped event ledger

Implement `recordEvent(state, event)` in `src/event-ledger.js`.

Contract:

- `state` is a `Map`.
- `event` contains non-blank string `tenantId`, non-blank string `eventId`, JSON-compatible `payload`, and a valid `receivedAt` date value.
- Identity is the pair `(tenantId, eventId)`. The same `eventId` in different tenants is not a duplicate.
- The first accepted event is stored as an immutable snapshot. Later mutation of the input object or payload must not change the stored record.
- Replaying the same identity with a JSON-equivalent payload is idempotent, even when object key order differs. Return the original record and `duplicate: true`; do not change state.
- Replaying the same identity with a different payload throws `EventConflictError` with code `EVENT_ID_CONFLICT`; do not change state.
- Invalid state or input throws `EventValidationError` with code `EVENT_VALIDATION_ERROR`; do not change state.
- A newly stored record returns `{ duplicate: false, record }`.
- `record.receivedAt` is normalized to an ISO string.

Do not add dependencies.
