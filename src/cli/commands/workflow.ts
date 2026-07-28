import type { DeliveryTarget, LinearAckResult, PlanningState, WorkflowActor, WorkflowSnapshot, WorkflowTransitionType } from '../lib/workflow-kernel.js';
import { defineCommand } from 'citty';

import { consola } from 'consola';
import {
  acceptanceStates,
  ackLinearOutbox,
  deliveryStates,

  deliveryTargets,
  executionStates,
  initializeWorkflow,

  linearSyncStates,
  listLinearOutbox,

  planningStates,
  readWorkflow,
  transitionWorkflow,

  workflowTransitionTypes,
} from '../lib/workflow-kernel.js';

function printSnapshot(snapshot: WorkflowSnapshot, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  consola.info([
    `work item: ${snapshot.workItemId}`,
    `planning: ${snapshot.planningState}`,
    `execution: ${snapshot.executionState}`,
    `acceptance: ${snapshot.acceptanceState}`,
    `delivery: ${snapshot.deliveryState} (target: ${snapshot.requiredDeliveryTarget})`,
    `Linear: ${snapshot.linearSync}${snapshot.linearRef ? ` (${snapshot.linearRef})` : ''}`,
    `goal: ${snapshot.goalState}`,
    `Linear Done eligible: ${snapshot.linearDoneEligible}`,
    `pending Linear operations: ${snapshot.pendingLinearOperations}`,
    `events: ${snapshot.eventCount} (last: ${snapshot.lastEventId})`,
  ].join('\n'));
}

const cwdArg = {
  type: 'string' as const,
  description: 'Project root containing .vibeRig/.',
  default: '.',
};

const jsonArg = {
  type: 'boolean' as const,
  description: 'Print machine-readable JSON.',
  default: false,
};

const initWorkflowCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a local append-only workflow run. Does not call Linear.',
  },
  args: {
    'workItemId': {
      type: 'positional',
      description: 'Stable work item id.',
      required: true,
    },
    'cwd': cwdArg,
    'event-id': {
      type: 'string',
      description: 'Optional idempotency id for the initialization event.',
    },
    'delivery-target': {
      type: 'string',
      description: `Required delivery target: ${deliveryTargets.join(', ')}.`,
      default: 'none',
    },
    'planning': {
      type: 'string',
      description: `Initial planning state: ${planningStates.join(', ')}.`,
    },
    'linear-ref': {
      type: 'string',
      description: 'Existing Linear issue id/key. No API call is made.',
    },
    'json': jsonArg,
  },
  async run({ args }) {
    const snapshot = await initializeWorkflow({
      cwd: args.cwd,
      workItemId: args.workItemId,
      eventId: args['event-id'],
      deliveryTarget: args['delivery-target'] as DeliveryTarget,
      planning: args.planning as PlanningState | undefined,
      linearRef: args['linear-ref'] ?? null,
    });
    printSnapshot(snapshot, args.json);
  },
});

const transitionCommand = defineCommand({
  meta: {
    name: 'transition',
    description: 'Append one validated workflow event and any derived Linear outbox intent.',
  },
  args: {
    'workItemId': {
      type: 'positional',
      description: 'Stable work item id.',
      required: true,
    },
    'transition': {
      type: 'positional',
      description: `Transition: ${workflowTransitionTypes.join(', ')}.`,
      required: true,
    },
    'cwd': cwdArg,
    'actor': {
      type: 'string',
      description: 'Event actor: ai, human, system, or external.',
      default: 'ai',
    },
    'event-id': {
      type: 'string',
      description: 'Optional caller-stable idempotency id.',
    },
    'note': {
      type: 'string',
      description: 'Optional short event note.',
    },
    'json': jsonArg,
  },
  async run({ args }) {
    const snapshot = await transitionWorkflow({
      cwd: args.cwd,
      workItemId: args.workItemId,
      type: args.transition as WorkflowTransitionType,
      actor: args.actor as WorkflowActor,
      eventId: args['event-id'],
      note: args.note,
    });
    printSnapshot(snapshot, args.json);
  },
});

const showCommand = defineCommand({
  meta: {
    name: 'show',
    description: 'Project the current state from the append-only journal and outbox.',
  },
  args: {
    workItemId: {
      type: 'positional',
      description: 'Stable work item id.',
      required: true,
    },
    cwd: cwdArg,
    json: jsonArg,
  },
  async run({ args }) {
    const snapshot = await readWorkflow({
      cwd: args.cwd,
      workItemId: args.workItemId,
    });
    printSnapshot(snapshot, args.json);
  },
});

const outboxCommand = defineCommand({
  meta: {
    name: 'outbox',
    description: 'List local Linear intents. This command never sends them.',
  },
  args: {
    workItemId: {
      type: 'positional',
      description: 'Stable work item id.',
      required: true,
    },
    cwd: cwdArg,
    all: {
      type: 'boolean',
      description: 'Include already synced outbox entries.',
      default: false,
    },
    json: jsonArg,
  },
  async run({ args }) {
    const items = await listLinearOutbox({
      cwd: args.cwd,
      workItemId: args.workItemId,
      pendingOnly: !args.all,
    });

    if (args.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }
    if (items.length === 0) {
      consola.success(args.all ? 'Linear outbox is empty.' : 'No pending Linear operations.');
      return;
    }
    for (const item of items) {
      const latestAttempt = item.attempts.at(-1);
      consola.info([
        `${item.request.id}: ${item.request.operation}`,
        `  semantic status: ${item.request.payload.semanticStatus}`,
        `  synced: ${item.synced}`,
        `  latest attempt: ${latestAttempt?.result ?? 'none'}`,
      ].join('\n'));
    }
  },
});

const ackCommand = defineCommand({
  meta: {
    name: 'ack',
    description: 'Append the result of an external Linear outbox attempt.',
  },
  args: {
    'workItemId': {
      type: 'positional',
      description: 'Stable work item id.',
      required: true,
    },
    'outboxId': {
      type: 'positional',
      description: 'Outbox request id returned by workflow outbox.',
      required: true,
    },
    'cwd': cwdArg,
    'result': {
      type: 'string',
      description: 'Adapter result: synced, unavailable, or conflict.',
      default: 'synced',
    },
    'ack-id': {
      type: 'string',
      description: 'Optional caller-stable acknowledgement id.',
    },
    'external-ref': {
      type: 'string',
      description: 'Linear issue id/key returned by an upsert.',
    },
    'message': {
      type: 'string',
      description: 'Optional adapter result detail.',
    },
    'json': jsonArg,
  },
  async run({ args }) {
    const snapshot = await ackLinearOutbox({
      cwd: args.cwd,
      workItemId: args.workItemId,
      outboxId: args.outboxId,
      result: args.result as LinearAckResult,
      ackId: args['ack-id'],
      externalRef: args['external-ref'] ?? null,
      message: args.message ?? null,
    });
    printSnapshot(snapshot, args.json);
  },
});

export const workflowCommand = defineCommand({
  meta: {
    name: 'workflow',
    description: 'Deterministic local workflow state, journal, and Linear outbox.',
  },
  subCommands: {
    init: initWorkflowCommand,
    transition: transitionCommand,
    show: showCommand,
    outbox: outboxCommand,
    ack: ackCommand,
  },
});

export const workflowStateValues = {
  planning: planningStates,
  execution: executionStates,
  acceptance: acceptanceStates,
  delivery: deliveryStates,
  linearSync: linearSyncStates,
};
