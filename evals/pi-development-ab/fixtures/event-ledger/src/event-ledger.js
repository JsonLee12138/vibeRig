export class EventConflictError extends Error {
  constructor(message = 'event id conflict') {
    super(message);
    this.name = 'EventConflictError';
    this.code = 'EVENT_ID_CONFLICT';
  }
}

export class EventValidationError extends Error {
  constructor(message = 'invalid event') {
    super(message);
    this.name = 'EventValidationError';
    this.code = 'EVENT_VALIDATION_ERROR';
  }
}

export function recordEvent(state, event) {
  const key = event.eventId;
  if (state.has(key))
    return { duplicate: true, record: state.get(key) };

  const record = {
    tenantId: event.tenantId,
    eventId: event.eventId,
    payload: event.payload,
    receivedAt: new Date(event.receivedAt).toISOString(),
  };
  state.set(key, record);
  return { duplicate: false, record };
}
