# Tenant-scoped event ledger

Implement `recordEvent(state, event)` in `src/event-ledger.js`.

Contract:

- `state` is a `Map`.
- `event` contains non-blank string `tenantId`, non-blank string `eventId`,
  JSON-compatible `payload`, and `receivedAt` as a valid date string, finite
  epoch number, or valid `Date`. Reject booleans, arrays, symbols, and arbitrary
  coercible objects even if `new Date(value)` would accept them.
- Identity is the pair `(tenantId, eventId)`. The same `eventId` in different tenants is not a duplicate.
- The first accepted event is stored as a deeply immutable snapshot. Later
  mutation of the input object, payload, or returned record must not change the
  stored record. A replay returns the same stable immutable record.
- Replaying the same identity with a JSON-equivalent payload is idempotent, even when object key order differs. Return the original record and `duplicate: true`; do not change state.
- Replaying the same identity with a different payload throws `EventConflictError` with code `EVENT_ID_CONFLICT`; do not change state.
- Invalid state or input throws `EventValidationError` with code `EVENT_VALIDATION_ERROR`; do not change state.
- A newly stored record returns `{ duplicate: false, record }`.
- `record.receivedAt` is normalized to an ISO string.

Do not add dependencies.
