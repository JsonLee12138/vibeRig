import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

export const planningStates = [
  'requirement_baselined',
  'drafting',
  'linear_draft_visible',
  'pending_confirmation',
  'approved',
  'rejected',
  'not_required',
] as const;

export const executionStates = [
  'not_started',
  'ready',
  'executing',
  'technically_ready',
  'blocked',
] as const;

export const acceptanceStates = [
  'not_requested',
  'pending',
  'accepted',
  'rejected',
] as const;

export const deliveryStates = [
  'none',
  'committed',
  'pr_ready',
  'delivery_pending',
  'merged',
  'released',
] as const;

export const linearSyncStates = [
  'synced',
  'pending',
  'unavailable',
  'conflict',
] as const;

export const deliveryTargets = [
  'none',
  'committed',
  'pr_ready',
  'merged',
  'released',
] as const;

export const workflowTransitionTypes = [
  'planning.baselined',
  'planning.publish',
  'planning.request_confirmation',
  'planning.approved',
  'planning.rejected',
  'planning.revise',
  'planning.not_required',
  'execution.ready',
  'execution.started',
  'execution.blocked',
  'execution.technical_ready',
  'acceptance.requested',
  'acceptance.accepted',
  'acceptance.rejected',
  'delivery.committed',
  'delivery.pr_ready',
  'delivery.pending',
  'delivery.merged',
  'delivery.released',
] as const;

export type PlanningState = typeof planningStates[number];
export type ExecutionState = typeof executionStates[number];
export type AcceptanceState = typeof acceptanceStates[number];
export type DeliveryState = typeof deliveryStates[number];
export type LinearSyncState = typeof linearSyncStates[number];
export type DeliveryTarget = typeof deliveryTargets[number];
export type WorkflowTransitionType = typeof workflowTransitionTypes[number];
export type WorkflowActor = 'ai' | 'human' | 'system' | 'external';
export type GoalState = 'active' | 'target_reached';
export type LinearAckResult = 'synced' | 'unavailable' | 'conflict';

interface InitializedPayload {
  deliveryTarget: DeliveryTarget;
  initialPlanning: PlanningState;
  linearRef: string | null;
}

interface TransitionPayload {
  note?: string;
}

type WorkflowEventType = 'workflow.initialized' | WorkflowTransitionType;

export interface WorkflowEvent {
  version: 1;
  id: string;
  workItemId: string;
  type: WorkflowEventType;
  actor: WorkflowActor;
  at: string;
  payload: InitializedPayload | TransitionPayload;
}

export interface LinearOutboxRequest {
  version: 1;
  kind: 'request';
  id: string;
  sourceEventId: string;
  workItemId: string;
  operation: 'upsert_work_item' | 'set_status';
  payload: {
    semanticStatus: string;
    linearRef: string | null;
    requiresHumanConfirmation?: boolean;
  };
  createdAt: string;
}

export interface LinearOutboxAck {
  version: 1;
  kind: 'ack';
  id: string;
  outboxId: string;
  result: LinearAckResult;
  externalRef: string | null;
  message: string | null;
  at: string;
}

export type LinearOutboxRecord = LinearOutboxRequest | LinearOutboxAck;

export interface LinearOutboxItem {
  request: LinearOutboxRequest;
  attempts: LinearOutboxAck[];
  synced: boolean;
}

export interface WorkflowSnapshot {
  version: 1;
  workItemId: string;
  revision: number;
  planningState: PlanningState;
  executionState: ExecutionState;
  acceptanceState: AcceptanceState;
  deliveryState: DeliveryState;
  linearSync: LinearSyncState;
  linearRef: string | null;
  requiredDeliveryTarget: DeliveryTarget;
  updatedAt: string;
  goalState: GoalState;
  linearDoneEligible: boolean;
  pendingLinearOperations: number;
  eventCount: number;
  lastEventId: string;
}

export interface WorkflowState {
  version: 1;
  workItemId: string;
  revision: number;
  planningState: PlanningState;
  executionState: ExecutionState;
  acceptanceState: AcceptanceState;
  deliveryState: DeliveryState;
  requiredDeliveryTarget: DeliveryTarget;
  linearSync: LinearSyncState;
  updatedAt: string;
}

export interface InitializeWorkflowOptions {
  cwd?: string;
  workItemId: string;
  eventId?: string;
  deliveryTarget?: DeliveryTarget;
  planning?: PlanningState;
  linearRef?: string | null;
}

export interface TransitionWorkflowOptions {
  cwd?: string;
  workItemId: string;
  type: WorkflowTransitionType;
  actor: WorkflowActor;
  eventId?: string;
  note?: string;
}

export interface ReadWorkflowOptions {
  cwd?: string;
  workItemId: string;
}

export interface ListLinearOutboxOptions extends ReadWorkflowOptions {
  pendingOnly?: boolean;
}

export interface AckLinearOutboxOptions extends ReadWorkflowOptions {
  outboxId: string;
  result: LinearAckResult;
  ackId?: string;
  externalRef?: string | null;
  message?: string | null;
}

const workItemIdPattern = /^[A-Z0-9][\w-]{0,127}$/i;
const idPattern = /^[A-Z0-9][\w.:-]{0,191}$/i;
const staleLockMs = 30_000;
const lockTimeoutMs = 5_000;

function assertOneOf<T extends string>(value: string, values: readonly T[], name: string): asserts value is T {
  if (!values.includes(value as T))
    throw new Error(`${name} must be one of: ${values.join(', ')}`);
}

function assertWorkItemId(workItemId: string): void {
  if (!workItemIdPattern.test(workItemId))
    throw new Error('workItemId must match /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/');
}

function assertRecordId(id: string, name: string): void {
  if (!idPattern.test(id))
    throw new Error(`${name} must match /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/`);
}

function paths(cwd: string | undefined, workItemId: string) {
  assertWorkItemId(workItemId);
  const root = resolve(cwd ?? '.', '.vibeRig', 'runs', workItemId);
  return {
    root,
    journal: resolve(root, 'events.jsonl'),
    outbox: resolve(root, 'linear-outbox.jsonl'),
    lock: resolve(root, '.workflow.lock'),
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameIntent(left: WorkflowEvent, right: WorkflowEvent): boolean {
  return left.id === right.id
    && left.workItemId === right.workItemId
    && left.type === right.type
    && left.actor === right.actor
    && canonical(left.payload) === canonical(right.payload);
}

function outboxIdFor(event: WorkflowEvent): string {
  const digest = createHash('sha256')
    .update(`${event.workItemId}\0${event.id}\0${event.type}`)
    .digest('hex')
    .slice(0, 24);
  return `linear-${digest}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

async function withRunLock<T>(root: string, lockPath: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), 'utf8');
      await handle.close();
      break;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
        throw error;

      try {
        const lockStat = await stat(lockPath);
        if (Date.now() - lockStat.mtimeMs > staleLockMs) {
          await unlink(lockPath);
          continue;
        }
      }
      catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT')
          continue;
        throw statError;
      }

      if (Date.now() - startedAt >= lockTimeoutMs)
        throw new Error(`workflow lock timed out after ${lockTimeoutMs}ms: ${lockPath}`);
      await sleep(25);
    }
  }

  try {
    return await operation();
  }
  finally {
    await unlink(lockPath).catch(() => undefined);
  }
}

async function readJsonLines<T>(path: string): Promise<T[]> {
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return [];
    throw error;
  }

  const records: T[] = [];
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line)
      continue;
    try {
      records.push(JSON.parse(line) as T);
    }
    catch (error) {
      throw new Error(`invalid JSONL at ${path}:${index + 1}: ${(error as Error).message}`);
    }
  }
  return records;
}

async function appendJsonLine(path: string, record: unknown): Promise<void> {
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}

function requireState(actual: string, expected: readonly string[], eventType: string): void {
  if (!expected.includes(actual))
    throw new Error(`${eventType} is invalid from ${actual}; expected ${expected.join(' or ')}`);
}

function assertHuman(event: WorkflowEvent): void {
  if (event.actor !== 'human')
    throw new Error(`${event.type} requires actor=human; AI execution cannot cross a human gate`);
}

function baseState(event: WorkflowEvent): WorkflowSnapshot {
  if (event.type !== 'workflow.initialized')
    throw new Error('first workflow event must be workflow.initialized');
  if (event.actor !== 'system')
    throw new Error('workflow.initialized requires actor=system');

  const payload = event.payload as InitializedPayload;
  assertOneOf(payload.deliveryTarget, deliveryTargets, 'deliveryTarget');
  assertOneOf(payload.initialPlanning, planningStates, 'initialPlanning');
  if (payload.initialPlanning === 'linear_draft_visible' && !payload.linearRef)
    throw new Error('linear_draft_visible requires a linearRef');

  return {
    version: 1,
    workItemId: event.workItemId,
    revision: 0,
    planningState: payload.initialPlanning,
    executionState: 'not_started',
    acceptanceState: 'not_requested',
    deliveryState: 'none',
    linearSync: payload.linearRef ? 'synced' : 'unavailable',
    linearRef: payload.linearRef,
    requiredDeliveryTarget: payload.deliveryTarget,
    updatedAt: event.at,
    goalState: 'active',
    linearDoneEligible: false,
    pendingLinearOperations: 0,
    eventCount: 1,
    lastEventId: event.id,
  };
}

function applyEvent(state: WorkflowSnapshot, event: WorkflowEvent): WorkflowSnapshot {
  if (event.workItemId !== state.workItemId)
    throw new Error(`event ${event.id} belongs to ${event.workItemId}, expected ${state.workItemId}`);
  if (event.type === 'workflow.initialized')
    throw new Error('workflow.initialized may only be the first event');
  assertOneOf(event.type, workflowTransitionTypes, 'event type');
  assertOneOf(event.actor, ['ai', 'human', 'system', 'external'] as const, 'event actor');

  const next = {
    ...state,
    revision: state.revision + 1,
    updatedAt: event.at,
    eventCount: state.eventCount + 1,
    lastEventId: event.id,
  };

  switch (event.type) {
    case 'planning.baselined':
      requireState(state.planningState, ['drafting', 'rejected'], event.type);
      next.planningState = 'requirement_baselined';
      break;
    case 'planning.publish':
      requireState(state.planningState, ['drafting', 'requirement_baselined', 'rejected'], event.type);
      break;
    case 'planning.request_confirmation':
      requireState(state.planningState, ['linear_draft_visible'], event.type);
      next.planningState = 'pending_confirmation';
      break;
    case 'planning.approved':
      assertHuman(event);
      requireState(state.planningState, ['pending_confirmation'], event.type);
      next.planningState = 'approved';
      break;
    case 'planning.rejected':
      assertHuman(event);
      requireState(state.planningState, ['pending_confirmation'], event.type);
      next.planningState = 'rejected';
      break;
    case 'planning.revise':
      requireState(state.planningState, ['rejected', 'linear_draft_visible'], event.type);
      next.planningState = 'drafting';
      break;
    case 'planning.not_required':
      requireState(state.planningState, ['drafting'], event.type);
      next.planningState = 'not_required';
      break;
    case 'execution.ready':
      requireState(state.planningState, ['requirement_baselined', 'approved', 'not_required'], event.type);
      requireState(state.executionState, ['not_started', 'blocked'], event.type);
      next.executionState = 'ready';
      break;
    case 'execution.started':
      requireState(state.executionState, ['ready'], event.type);
      next.executionState = 'executing';
      break;
    case 'execution.blocked':
      requireState(state.executionState, ['ready', 'executing'], event.type);
      next.executionState = 'blocked';
      break;
    case 'execution.technical_ready':
      requireState(state.executionState, ['executing'], event.type);
      next.executionState = 'technically_ready';
      break;
    case 'acceptance.requested':
      requireState(state.executionState, ['technically_ready'], event.type);
      requireState(state.acceptanceState, ['not_requested', 'rejected'], event.type);
      next.acceptanceState = 'pending';
      break;
    case 'acceptance.accepted':
      assertHuman(event);
      requireState(state.acceptanceState, ['pending'], event.type);
      next.acceptanceState = 'accepted';
      break;
    case 'acceptance.rejected':
      assertHuman(event);
      requireState(state.acceptanceState, ['pending'], event.type);
      next.acceptanceState = 'rejected';
      next.executionState = 'ready';
      next.deliveryState = 'none';
      break;
    case 'delivery.committed':
      requireState(state.executionState, ['technically_ready'], event.type);
      requireState(state.deliveryState, ['none'], event.type);
      next.deliveryState = 'committed';
      break;
    case 'delivery.pr_ready':
      requireState(state.deliveryState, ['committed'], event.type);
      next.deliveryState = 'pr_ready';
      break;
    case 'delivery.pending':
      requireState(state.acceptanceState, ['accepted'], event.type);
      requireState(state.deliveryState, ['pr_ready'], event.type);
      next.deliveryState = 'delivery_pending';
      break;
    case 'delivery.merged':
      requireState(state.deliveryState, ['pr_ready', 'delivery_pending'], event.type);
      next.deliveryState = 'merged';
      break;
    case 'delivery.released':
      requireState(state.deliveryState, ['merged'], event.type);
      next.deliveryState = 'released';
      break;
  }

  next.goalState = goalState(next);
  next.linearDoneEligible = linearDoneEligible(next);
  return next;
}

function deliveryRank(delivery: DeliveryState): number {
  switch (delivery) {
    case 'none': return 0;
    case 'committed': return 1;
    case 'pr_ready':
    case 'delivery_pending': return 2;
    case 'merged': return 3;
    case 'released': return 4;
  }
}

function targetRank(target: DeliveryTarget): number {
  return deliveryTargets.indexOf(target);
}

function goalState(state: WorkflowSnapshot): GoalState {
  return state.executionState === 'technically_ready' ? 'target_reached' : 'active';
}

function linearDoneEligible(state: WorkflowSnapshot): boolean {
  return doneRequirementsReached(state) && state.linearSync !== 'conflict';
}

function doneRequirementsReached(state: WorkflowSnapshot): boolean {
  const humanAccepted = state.acceptanceState === 'accepted';
  const deliveryReached = deliveryRank(state.deliveryState) >= targetRank(state.requiredDeliveryTarget);
  return humanAccepted && deliveryReached;
}

function reduceEvents(events: WorkflowEvent[], records: LinearOutboxRecord[] = []): WorkflowSnapshot {
  if (events.length === 0)
    throw new Error('workflow is not initialized');

  const seenIds = new Set<string>();
  for (const event of events) {
    assertRecordId(event.id, 'event id');
    if (seenIds.has(event.id))
      throw new Error(`duplicate event id in journal: ${event.id}`);
    seenIds.add(event.id);
  }

  let state = baseState(events[0]);
  for (let index = 1; index < events.length; index += 1) {
    state = projectOutbox(state, events.slice(0, index), records);
    const event = events[index];
    state = applyEvent(state, event);
  }
  return state;
}

function ackAttempts(records: LinearOutboxRecord[], outboxId: string): LinearOutboxAck[] {
  return records.filter((record): record is LinearOutboxAck =>
    record.kind === 'ack' && record.outboxId === outboxId);
}

function syncedAck(records: LinearOutboxRecord[], outboxId: string): LinearOutboxAck | undefined {
  return ackAttempts(records, outboxId).reverse().find(attempt => attempt.result === 'synced');
}

function projectOutbox(
  state: WorkflowSnapshot,
  events: WorkflowEvent[],
  records: LinearOutboxRecord[],
): WorkflowSnapshot {
  const requests = records.filter((record): record is LinearOutboxRequest => record.kind === 'request');
  const acknowledgements = records.filter((record): record is LinearOutboxAck => record.kind === 'ack');
  const latestAckAt = acknowledgements.at(-1)?.at;
  const unresolved = requests.filter(request => !syncedAck(records, request.id));
  let linearRef = state.linearRef;

  for (const request of requests) {
    const ack = syncedAck(records, request.id);
    if (ack?.externalRef)
      linearRef = ack.externalRef;
  }

  const latestPublish = [...events].reverse().find(event => event.type === 'planning.publish');
  let planningState = state.planningState;
  if (
    latestPublish
    && ['drafting', 'requirement_baselined', 'rejected'].includes(planningState)
    && syncedAck(records, outboxIdFor(latestPublish))
  ) {
    planningState = 'linear_draft_visible';
  }

  let linearSync: LinearSyncState;
  if (unresolved.length === 0) {
    linearSync = linearRef || requests.length > 0 ? 'synced' : 'unavailable';
  }
  else {
    const unresolvedIds = new Set(unresolved.map(request => request.id));
    const latestAttempt = records
      .filter((record): record is LinearOutboxAck =>
        record.kind === 'ack' && unresolvedIds.has(record.outboxId))
      .at(-1);
    linearSync = latestAttempt?.result === 'conflict'
      ? 'conflict'
      : latestAttempt?.result === 'unavailable'
        ? 'unavailable'
        : 'pending';
  }

  return {
    ...state,
    revision: state.eventCount - 1 + acknowledgements.length,
    planningState,
    linearSync,
    linearRef,
    updatedAt: latestAckAt && latestAckAt > state.updatedAt ? latestAckAt : state.updatedAt,
    pendingLinearOperations: unresolved.length,
    goalState: goalState({ ...state, planningState, linearRef }),
    linearDoneEligible: linearDoneEligible({ ...state, planningState, linearRef, linearSync }),
  };
}

function outboxRequestFor(event: WorkflowEvent, state: WorkflowSnapshot): LinearOutboxRequest | null {
  let operation: LinearOutboxRequest['operation'] = 'set_status';
  let semanticStatus: string | null = null;
  let requiresHumanConfirmation: boolean | undefined;

  switch (event.type) {
    case 'planning.publish':
      operation = 'upsert_work_item';
      semanticStatus = 'awaiting_confirmation';
      requiresHumanConfirmation = true;
      break;
    case 'planning.approved':
      semanticStatus = 'ready_for_development';
      break;
    case 'planning.rejected':
      semanticStatus = 'rejected';
      break;
    case 'execution.started':
      semanticStatus = 'in_progress';
      break;
    case 'execution.blocked':
      semanticStatus = 'blocked';
      break;
    case 'execution.technical_ready':
      semanticStatus = 'in_review';
      break;
    case 'acceptance.requested':
      semanticStatus = 'pending_acceptance';
      break;
    case 'acceptance.rejected':
      semanticStatus = 'in_progress';
      break;
    case 'acceptance.accepted':
      semanticStatus = doneRequirementsReached(state) ? 'completed' : 'accepted';
      break;
    case 'delivery.pending':
      semanticStatus = 'ready_to_deliver';
      break;
    case 'delivery.committed':
    case 'delivery.pr_ready':
    case 'delivery.merged':
    case 'delivery.released':
      if (doneRequirementsReached(state))
        semanticStatus = 'completed';
      break;
  }

  if (!semanticStatus)
    return null;

  return {
    version: 1,
    kind: 'request',
    id: outboxIdFor(event),
    sourceEventId: event.id,
    workItemId: event.workItemId,
    operation,
    payload: {
      semanticStatus,
      linearRef: state.linearRef,
      ...(requiresHumanConfirmation === undefined ? {} : { requiresHumanConfirmation }),
    },
    createdAt: event.at,
  };
}

async function ensureOutboxRequest(
  outboxPath: string,
  event: WorkflowEvent,
  state: WorkflowSnapshot,
  records?: LinearOutboxRecord[],
): Promise<void> {
  const expected = outboxRequestFor(event, state);
  if (!expected)
    return;

  const current = records ?? await readJsonLines<LinearOutboxRecord>(outboxPath);
  const existing = current.find(record => record.kind === 'request' && record.id === expected.id);
  if (existing) {
    if (canonical(existing) !== canonical(expected))
      throw new Error(`outbox id collision with different payload: ${expected.id}`);
    return;
  }
  await appendJsonLine(outboxPath, expected);
}

async function snapshotFromFiles(journalPath: string, outboxPath: string): Promise<WorkflowSnapshot> {
  const [events, records] = await Promise.all([
    readJsonLines<WorkflowEvent>(journalPath),
    readJsonLines<LinearOutboxRecord>(outboxPath),
  ]);
  return projectOutbox(reduceEvents(events, records), events, records);
}

export async function initializeWorkflow(options: InitializeWorkflowOptions): Promise<WorkflowSnapshot> {
  const runPaths = paths(options.cwd, options.workItemId);
  const deliveryTarget = options.deliveryTarget ?? 'none';
  const initialPlanning = options.planning
    ?? (options.linearRef ? 'linear_draft_visible' : 'drafting');
  assertOneOf(deliveryTarget, deliveryTargets, 'deliveryTarget');
  assertOneOf(initialPlanning, planningStates, 'planning');
  if (initialPlanning === 'linear_draft_visible' && !options.linearRef)
    throw new Error('planning=linear_draft_visible requires linearRef');

  const event: WorkflowEvent = {
    version: 1,
    id: options.eventId ?? `init-${randomUUID()}`,
    workItemId: options.workItemId,
    type: 'workflow.initialized',
    actor: 'system',
    at: new Date().toISOString(),
    payload: {
      deliveryTarget,
      initialPlanning,
      linearRef: options.linearRef ?? null,
    },
  };
  assertRecordId(event.id, 'event id');

  return withRunLock(runPaths.root, runPaths.lock, async () => {
    const events = await readJsonLines<WorkflowEvent>(runPaths.journal);
    if (events.length > 0) {
      const initialized = events[0];
      const sameConfiguration = initialized.workItemId === event.workItemId
        && initialized.type === event.type
        && canonical(initialized.payload) === canonical(event.payload);
      if (!sameConfiguration)
        throw new Error(`workflow ${options.workItemId} is already initialized with different configuration`);
      return snapshotFromFiles(runPaths.journal, runPaths.outbox);
    }

    await appendJsonLine(runPaths.journal, event);
    return snapshotFromFiles(runPaths.journal, runPaths.outbox);
  });
}

export async function transitionWorkflow(options: TransitionWorkflowOptions): Promise<WorkflowSnapshot> {
  assertOneOf(options.type, workflowTransitionTypes, 'transition type');
  assertOneOf(options.actor, ['ai', 'human', 'system', 'external'] as const, 'actor');
  const runPaths = paths(options.cwd, options.workItemId);
  const event: WorkflowEvent = {
    version: 1,
    id: options.eventId ?? `evt-${randomUUID()}`,
    workItemId: options.workItemId,
    type: options.type,
    actor: options.actor,
    at: new Date().toISOString(),
    payload: options.note ? { note: options.note } : {},
  };
  assertRecordId(event.id, 'event id');

  return withRunLock(runPaths.root, runPaths.lock, async () => {
    const [events, records] = await Promise.all([
      readJsonLines<WorkflowEvent>(runPaths.journal),
      readJsonLines<LinearOutboxRecord>(runPaths.outbox),
    ]);
    const duplicate = events.find(existing => existing.id === event.id);
    if (duplicate) {
      if (!sameIntent(duplicate, event))
        throw new Error(`event id ${event.id} was already used for a different transition`);
      const duplicateIndex = events.indexOf(duplicate);
      const prefixEvents = events.slice(0, duplicateIndex + 1);
      const state = projectOutbox(reduceEvents(prefixEvents, records), prefixEvents, records);
      await ensureOutboxRequest(runPaths.outbox, duplicate, state, records);
      return snapshotFromFiles(runPaths.journal, runPaths.outbox);
    }

    const current = projectOutbox(reduceEvents(events, records), events, records);
    const next = applyEvent(current, event);
    await appendJsonLine(runPaths.journal, event);
    await ensureOutboxRequest(runPaths.outbox, event, next, records);
    return snapshotFromFiles(runPaths.journal, runPaths.outbox);
  });
}

export async function readWorkflow(options: ReadWorkflowOptions): Promise<WorkflowSnapshot> {
  const runPaths = paths(options.cwd, options.workItemId);
  return snapshotFromFiles(runPaths.journal, runPaths.outbox);
}

export function toWorkflowState(snapshot: WorkflowSnapshot): WorkflowState {
  return {
    version: 1,
    workItemId: snapshot.workItemId,
    revision: snapshot.revision,
    planningState: snapshot.planningState,
    executionState: snapshot.executionState,
    acceptanceState: snapshot.acceptanceState,
    deliveryState: snapshot.deliveryState,
    requiredDeliveryTarget: snapshot.requiredDeliveryTarget,
    linearSync: snapshot.linearSync,
    updatedAt: snapshot.updatedAt,
  };
}

export async function listLinearOutbox(options: ListLinearOutboxOptions): Promise<LinearOutboxItem[]> {
  const runPaths = paths(options.cwd, options.workItemId);
  const records = await readJsonLines<LinearOutboxRecord>(runPaths.outbox);
  const requests = records.filter((record): record is LinearOutboxRequest => record.kind === 'request');
  const items = requests.map(request => ({
    request,
    attempts: ackAttempts(records, request.id),
    synced: Boolean(syncedAck(records, request.id)),
  }));
  return options.pendingOnly === false ? items : items.filter(item => !item.synced);
}

export async function ackLinearOutbox(options: AckLinearOutboxOptions): Promise<WorkflowSnapshot> {
  assertOneOf(options.result, ['synced', 'unavailable', 'conflict'] as const, 'ack result');
  const runPaths = paths(options.cwd, options.workItemId);
  const ack: LinearOutboxAck = {
    version: 1,
    kind: 'ack',
    id: options.ackId ?? `ack-${randomUUID()}`,
    outboxId: options.outboxId,
    result: options.result,
    externalRef: options.externalRef ?? null,
    message: options.message ?? null,
    at: new Date().toISOString(),
  };
  assertRecordId(ack.id, 'ack id');
  assertRecordId(ack.outboxId, 'outbox id');

  return withRunLock(runPaths.root, runPaths.lock, async () => {
    const records = await readJsonLines<LinearOutboxRecord>(runPaths.outbox);
    const request = records.find((record): record is LinearOutboxRequest =>
      record.kind === 'request' && record.id === ack.outboxId);
    if (!request)
      throw new Error(`outbox request not found: ${ack.outboxId}`);
    if (request.operation === 'upsert_work_item' && ack.result === 'synced' && !ack.externalRef)
      throw new Error('synced upsert_work_item ack requires externalRef');

    const duplicate = records.find(record => record.kind === 'ack' && record.id === ack.id);
    if (duplicate) {
      const comparableExisting = { ...duplicate, at: ack.at };
      if (canonical(comparableExisting) !== canonical(ack))
        throw new Error(`ack id ${ack.id} was already used with a different result`);
      return snapshotFromFiles(runPaths.journal, runPaths.outbox);
    }

    const alreadySynced = syncedAck(records, ack.outboxId);
    if (alreadySynced) {
      if (ack.result !== 'synced')
        throw new Error(`outbox request ${ack.outboxId} is already synced`);
      if (ack.externalRef && alreadySynced.externalRef && ack.externalRef !== alreadySynced.externalRef)
        throw new Error(`outbox request ${ack.outboxId} is already bound to ${alreadySynced.externalRef}`);
      return snapshotFromFiles(runPaths.journal, runPaths.outbox);
    }

    await appendJsonLine(runPaths.outbox, ack);
    return snapshotFromFiles(runPaths.journal, runPaths.outbox);
  });
}
