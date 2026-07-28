import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kernelPath = resolve(root, 'src/cli/lib/workflow-kernel.ts');
const commandPath = resolve(root, 'src/cli/commands/workflow.ts');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'viberig-workflow-runtime-'));
const workItemId = 'runtime-check';

async function expectFailure(operation, pattern) {
  await assert.rejects(operation, pattern);
}

try {
  const kernel = await tsImport(kernelPath, import.meta.url);
  const commandModule = await tsImport(commandPath, import.meta.url);

  assert.deepEqual(
    Object.keys(commandModule.workflowCommand.subCommands),
    ['init', 'transition', 'show', 'outbox', 'ack'],
    'workflow command must expose the complete local runtime surface',
  );

  let state = await kernel.initializeWorkflow({
    cwd: temporaryRoot,
    workItemId,
    eventId: 'init-runtime-check',
    deliveryTarget: 'merged',
  });
  assert.equal(state.planningState, 'drafting');
  assert.equal(state.executionState, 'not_started');
  assert.equal(state.acceptanceState, 'not_requested');
  assert.equal(state.deliveryState, 'none');
  assert.equal(state.goalState, 'active');

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'planning.baselined',
    actor: 'ai',
    eventId: 'planning-baselined',
  });
  assert.equal(state.planningState, 'requirement_baselined');

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'planning.publish',
    actor: 'ai',
    eventId: 'planning-publish',
  });
  assert.equal(state.planningState, 'requirement_baselined', 'planning must not claim Linear visibility before ack');
  assert.equal(state.linearSync, 'pending');

  let pending = await kernel.listLinearOutbox({ cwd: temporaryRoot, workItemId });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].request.operation, 'upsert_work_item');
  assert.equal(pending[0].request.payload.requiresHumanConfirmation, true);
  const publishOutboxId = pending[0].request.id;

  await expectFailure(
    () => kernel.transitionWorkflow({
      cwd: temporaryRoot,
      workItemId,
      type: 'planning.request_confirmation',
      actor: 'system',
      eventId: 'confirmation-too-early',
    }),
    /invalid from requirement_baselined/,
  );

  state = await kernel.ackLinearOutbox({
    cwd: temporaryRoot,
    workItemId,
    outboxId: publishOutboxId,
    ackId: 'ack-linear-unavailable',
    result: 'unavailable',
    message: 'offline validation',
  });
  assert.equal(state.linearSync, 'unavailable');
  assert.equal(state.planningState, 'requirement_baselined');

  state = await kernel.ackLinearOutbox({
    cwd: temporaryRoot,
    workItemId,
    outboxId: publishOutboxId,
    ackId: 'ack-linear-synced',
    result: 'synced',
    externalRef: 'VB-101',
  });
  assert.equal(state.linearSync, 'synced');
  assert.equal(state.linearRef, 'VB-101');
  assert.equal(state.planningState, 'linear_draft_visible');

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'planning.request_confirmation',
    actor: 'system',
    eventId: 'planning-request-confirmation',
  });
  assert.equal(state.planningState, 'pending_confirmation');

  await expectFailure(
    () => kernel.transitionWorkflow({
      cwd: temporaryRoot,
      workItemId,
      type: 'planning.approved',
      actor: 'ai',
      eventId: 'ai-planning-approval',
    }),
    /requires actor=human/,
  );

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'planning.approved',
    actor: 'human',
    eventId: 'human-planning-approval',
  });
  assert.equal(state.planningState, 'approved');

  for (const transition of [
    ['execution.ready', 'execution-ready'],
    ['execution.started', 'execution-started'],
    ['execution.technical_ready', 'execution-technically-ready'],
  ]) {
    state = await kernel.transitionWorkflow({
      cwd: temporaryRoot,
      workItemId,
      type: transition[0],
      actor: 'ai',
      eventId: transition[1],
    });
  }
  assert.equal(state.executionState, 'technically_ready');
  assert.equal(state.acceptanceState, 'not_requested');
  assert.equal(state.goalState, 'target_reached');
  assert.equal(state.linearDoneEligible, false, 'technical completion must not become Linear Done');

  pending = await kernel.listLinearOutbox({ cwd: temporaryRoot, workItemId });
  assert.ok(pending.some(item => item.request.payload.semanticStatus === 'in_review'));
  assert.ok(!pending.some(item => item.request.payload.semanticStatus === 'completed'));

  await expectFailure(
    () => kernel.transitionWorkflow({
      cwd: temporaryRoot,
      workItemId,
      type: 'done',
      actor: 'ai',
      eventId: 'forbidden-done',
    }),
    /transition type must be one of/,
  );

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'acceptance.requested',
    actor: 'system',
    eventId: 'acceptance-requested',
  });
  assert.equal(state.acceptanceState, 'pending');

  await expectFailure(
    () => kernel.transitionWorkflow({
      cwd: temporaryRoot,
      workItemId,
      type: 'acceptance.accepted',
      actor: 'ai',
      eventId: 'ai-acceptance',
    }),
    /requires actor=human/,
  );

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'acceptance.accepted',
    actor: 'human',
    eventId: 'human-acceptance',
  });
  assert.equal(state.acceptanceState, 'accepted');
  assert.equal(state.goalState, 'target_reached');
  assert.equal(state.linearDoneEligible, false, 'acceptance alone cannot bypass a required delivery target');

  pending = await kernel.listLinearOutbox({ cwd: temporaryRoot, workItemId });
  assert.ok(pending.some(item => item.request.payload.semanticStatus === 'accepted'));
  assert.ok(!pending.some(item => item.request.payload.semanticStatus === 'completed'));

  for (const transition of [
    ['delivery.committed', 'delivery-committed'],
    ['delivery.pr_ready', 'delivery-pr-ready'],
    ['delivery.pending', 'delivery-pending'],
    ['delivery.merged', 'delivery-merged'],
  ]) {
    state = await kernel.transitionWorkflow({
      cwd: temporaryRoot,
      workItemId,
      type: transition[0],
      actor: 'external',
      eventId: transition[1],
    });
  }
  assert.equal(state.deliveryState, 'merged');
  assert.equal(state.goalState, 'target_reached');
  assert.equal(state.linearDoneEligible, true);
  assert.deepEqual(Object.keys(kernel.toWorkflowState(state)), [
    'version',
    'workItemId',
    'revision',
    'planningState',
    'executionState',
    'acceptanceState',
    'deliveryState',
    'requiredDeliveryTarget',
    'linearSync',
    'updatedAt',
  ]);

  pending = await kernel.listLinearOutbox({ cwd: temporaryRoot, workItemId });
  assert.ok(pending.some(item => item.request.payload.semanticStatus === 'completed'));

  const journalPath = resolve(temporaryRoot, '.vibeRig/runs', workItemId, 'events.jsonl');
  const outboxPath = resolve(temporaryRoot, '.vibeRig/runs', workItemId, 'linear-outbox.jsonl');
  const journalBeforeRetry = await readFile(journalPath, 'utf8');
  const outboxBeforeRetry = await readFile(outboxPath, 'utf8');

  state = await kernel.transitionWorkflow({
    cwd: temporaryRoot,
    workItemId,
    type: 'delivery.merged',
    actor: 'external',
    eventId: 'delivery-merged',
  });
  assert.equal(state.goalState, 'target_reached');
  assert.equal(await readFile(journalPath, 'utf8'), journalBeforeRetry, 'idempotent retry appended a duplicate event');
  assert.equal(await readFile(outboxPath, 'utf8'), outboxBeforeRetry, 'idempotent retry appended a duplicate outbox request');

  const kernelSource = await readFile(kernelPath, 'utf8');
  for (const banned of [/\bfetch\s*\(/, /\bhttps?:\/\//, /@linear\//, /linear\.app/])
    assert.doesNotMatch(kernelSource, banned, `kernel contains external API side effect surface: ${banned}`);

  console.log('workflow runtime validation passed (state axes, human gates, journal, outbox, ack, idempotency)');
}
finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
