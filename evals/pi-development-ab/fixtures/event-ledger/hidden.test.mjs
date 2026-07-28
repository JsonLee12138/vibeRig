import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EventConflictError,
  EventValidationError,
  recordEvent,
} from './src/event-ledger.js';

const event = (overrides = {}) => ({
  tenantId: 'tenant-a',
  eventId: 'evt-1',
  payload: { user: { id: 7 }, roles: ['admin'] },
  receivedAt: '2026-07-28T00:00:00+08:00',
  ...overrides,
});

test('stores a normalized event and reports a new record', () => {
  const state = new Map();
  const result = recordEvent(state, event());
  assert.equal(result.duplicate, false);
  assert.equal(result.record.receivedAt, '2026-07-27T16:00:00.000Z');
  assert.equal(state.size, 1);
});

test('scopes identity by tenant', () => {
  const state = new Map();
  recordEvent(state, event());
  const second = recordEvent(state, event({ tenantId: 'tenant-b' }));
  assert.equal(second.duplicate, false);
  assert.equal(state.size, 2);
});

test('treats reordered JSON object keys as an idempotent replay', () => {
  const state = new Map();
  const first = recordEvent(state, event({ payload: { a: 1, nested: { x: 2, y: 3 } } }));
  const second = recordEvent(state, event({ payload: { nested: { y: 3, x: 2 }, a: 1 } }));
  assert.equal(second.duplicate, true);
  assert.strictEqual(second.record, first.record);
  assert.equal(state.size, 1);
});

test('rejects a conflicting replay without mutating state', () => {
  const state = new Map();
  const first = recordEvent(state, event());
  const sizeBeforeConflict = state.size;
  assert.throws(
    () => recordEvent(state, event({ payload: { user: { id: 8 } } })),
    error => error instanceof EventConflictError && error.code === 'EVENT_ID_CONFLICT',
  );
  assert.equal(state.size, sizeBeforeConflict);
  const replay = recordEvent(state, event());
  assert.equal(replay.duplicate, true);
  assert.strictEqual(replay.record, first.record);
});

test('stores an immutable snapshot of nested payload data', () => {
  const state = new Map();
  const input = event();
  const result = recordEvent(state, input);
  input.payload.user.id = 99;
  input.payload.roles.push('owner');
  input.tenantId = 'changed';
  assert.deepEqual(result.record.payload, { user: { id: 7 }, roles: ['admin'] });
  assert.equal(result.record.tenantId, 'tenant-a');
});

test('validates state and required identifiers without side effects', () => {
  const state = new Map();
  for (const invalid of [
    event({ tenantId: '' }),
    event({ tenantId: '   ' }),
    event({ eventId: '' }),
    event({ eventId: 42 }),
  ]) {
    assert.throws(
      () => recordEvent(state, invalid),
      error => error instanceof EventValidationError && error.code === 'EVENT_VALIDATION_ERROR',
    );
  }
  assert.throws(
    () => recordEvent({}, event()),
    error => error instanceof EventValidationError && error.code === 'EVENT_VALIDATION_ERROR',
  );
  assert.equal(state.size, 0);
});

test('rejects invalid dates and non-JSON payloads without side effects', () => {
  const state = new Map();
  assert.throws(
    () => recordEvent(state, event({ receivedAt: 'not-a-date' })),
    error => error instanceof EventValidationError,
  );
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => recordEvent(state, event({ payload: cyclic })),
    error => error instanceof EventValidationError,
  );
  assert.equal(state.size, 0);
});
