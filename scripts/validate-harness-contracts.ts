import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parse } from 'yaml';

import { contextRoutesYaml, environmentsYaml, runbooksYaml } from '../src/cli/utils/harness-files.js';
import { projectProfileVersion, projectYaml, reconcileProjectYaml } from '../src/cli/utils/project-yaml.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const schemaPaths = [
  'skills/vb-init/assets/project-profile.schema.json',
  'skills/vb-init/assets/context-routes.schema.json',
  'skills/vb-init/assets/environment-profile.schema.json',
  'skills/vb-init/assets/runbook-index.schema.json',
  'skills/execute/assets/verification-graph.schema.json',
  'skills/pre-development/assets/delivery-plan.schema.json',
  'skills/pre-development/assets/e2e-contract.schema.json',
];

const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
for (const path of schemaPaths) {
  const schema = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  assert.doesNotThrow(() => validators.set(path, ajv.compile(schema)), `invalid JSON schema: ${path}`);
}

function assertSchema(path: string, value: unknown, expected: boolean) {
  const validate = validators.get(path);
  assert.ok(validate, `missing validator: ${path}`);
  assert.equal(validate(value), expected, `${path}: ${ajv.errorsText(validate.errors)}`);
}

const generated = parse(projectYaml({ projectName: 'demo' }));
assert.equal(generated.version, 2);
assert.equal(generated.project.name, 'demo');
assert.equal(generated.documents.mode, 'discover');
assert.equal(generated.environment.default_profile, 'local');
assert.equal(generated.tracking.mode, 'adapter');
assert.ok(!('workspace' in generated));
assert.equal(projectProfileVersion(projectYaml({ projectName: 'demo' })), 2);
assert.equal(projectProfileVersion('not: [valid'), null);

const legacy = `version: 1
project:
  name: legacy
docs:
  root: custom/requirements
workspace:
  worktrees_root: custom-worktrees
output:
  language: en-US
linear:
  team_id: team-1
custom_extension:
  keep: true
`;
const upgraded = parse(reconcileProjectYaml(legacy, { projectName: 'fallback' }));
assert.equal(upgraded.version, 2);
assert.equal(upgraded.project.name, 'legacy');
assert.equal(upgraded.documents.requirement_root, 'custom/requirements');
assert.equal(upgraded.output.language, 'en-US');
assert.equal(upgraded.linear.team_id, 'team-1');
assert.equal(upgraded.custom_extension.keep, true);
assert.ok(!('docs' in upgraded));
assert.ok(!('workspace' in upgraded));

const routes = parse(contextRoutesYaml());
assert.equal(routes.version, 1);
assert.ok(routes.routes.length > 0);
assert.ok(routes.routes[0].read.includes('nearest:AGENTS.md'));

const environments = parse(environmentsYaml());
assert.equal(environments.profiles.local.production_network, 'denied');
assert.equal(environments.profiles.local.credentials.production, 'forbidden');

const runbooks = parse(runbooksYaml());
assert.equal(runbooks.policy.require_exercise_evidence, true);
assert.deepEqual(runbooks.runbooks, []);

const deliveryPlan = {
  version: 1,
  requirementId: 'REQ-1',
  milestones: [{
    id: 'ms-1',
    title: 'Avatar upload available',
    userValue: 'Users can replace their profile avatar',
    scope: ['upload and display'],
    nonGoals: ['image editing'],
    acIds: ['AC-1'],
    testCaseIds: ['E2E-1'],
    riskIds: ['RISK-1'],
    dependencies: [],
    deliverySignal: 'AC-1 is demonstrable',
    rollbackSignal: 'upload can be disabled',
    confidence: 'committed',
    issues: [{
      id: 'ISSUE-1',
      title: 'Deliver avatar upload slice',
      outcome: 'A user uploads and sees a new avatar',
      scope: ['API, UI, persistence and tests'],
      nonGoals: ['image editing'],
      acIds: ['AC-1'],
      testCaseIds: ['E2E-1'],
      riskIds: ['RISK-1'],
      contractRefs: ['openapi/users.yaml'],
      verificationSummary: 'Run locked API and UI E2E',
      size: 'M',
      dependencies: [],
      checklist: ['implement behavior', 'run tests'],
      parallelGroup: null,
      conflictSet: ['openapi/users.yaml'],
      integrationPoints: ['generated SDK'],
      rollbackUnit: 'avatar upload feature flag',
      completionEvidence: ['E2E-1 PASS for current revision'],
      indicative: false,
    }],
  }],
};
assertSchema('skills/pre-development/assets/delivery-plan.schema.json', deliveryPlan, true);
assertSchema('skills/pre-development/assets/delivery-plan.schema.json', {
  ...deliveryPlan,
  milestones: [{ ...deliveryPlan.milestones[0], issues: [{ ...deliveryPlan.milestones[0].issues[0], outcome: undefined }] }],
}, false);

const e2eContract = {
  version: 1,
  requirementId: 'REQ-1',
  contracts: [{
    id: 'E2E-1',
    title: 'Avatar upload journey',
    type: 'ui_e2e',
    scope: 'milestone',
    acIds: ['AC-1'],
    preconditions: ['signed-in seeded user'],
    steps: ['upload a valid image'],
    expected: ['new avatar is visible'],
    requiredFidelity: 'real_browser',
    environment: 'local',
    testPath: 'tests/ui-e2e/avatar.spec.ts',
    status: 'locked',
    contractRevision: 1,
    oracleApproval: { status: 'approved', source: 'requirement_gate', approvedRevision: 1 },
    implementationReview: { status: 'approved', reviewerKind: 'independent_qa', reviewedRevision: 1 },
    lock: { status: 'locked', lockedRevision: 1, changePolicy: 'reopen_contract_review' },
    redEvidenceRef: 'artifacts/viberig/E2E-1-red.json',
    passingEvidenceRef: null,
    invalidatedBy: ['AC, test path, fixture, environment or contract revision changes'],
  }],
};
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', e2eContract, true);
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', {
  ...e2eContract,
  contracts: [{ ...e2eContract.contracts[0], oracleApproval: { status: 'pending', source: 'requirement_gate', approvedRevision: null } }],
}, false);

const verificationGraph = {
  version: 1,
  workItemId: 'REQ-1',
  nodes: [
    { id: 'outcome-1', kind: 'outcome' },
    { id: 'AC-1', kind: 'ac' },
    { id: 'E2E-1', kind: 'tc', testType: 'ui_e2e', authoritativeStage: 'milestone', requiredFidelity: 'real_browser', command: 'pnpm test:e2e', artifacts: ['playwright-report'], invalidatedBy: ['contract revision'] },
    { id: 'stage-milestone', kind: 'stage', authoritativeStage: 'milestone' },
    { id: 'evidence-e2e-1', kind: 'evidence', artifacts: ['playwright-report'] },
  ],
  edges: [
    { from: 'outcome-1', to: 'AC-1', relation: 'defines' },
    { from: 'AC-1', to: 'E2E-1', relation: 'verifies' },
    { from: 'E2E-1', to: 'stage-milestone', relation: 'executes_at' },
    { from: 'E2E-1', to: 'evidence-e2e-1', relation: 'produces' },
  ],
};
assertSchema('skills/execute/assets/verification-graph.schema.json', verificationGraph, true);
assertSchema('skills/execute/assets/verification-graph.schema.json', {
  ...verificationGraph,
  nodes: verificationGraph.nodes.map(node => node.id === 'E2E-1' ? { id: 'E2E-1', kind: 'tc' } : node),
}, false);

const requiredReferences = [
  'skills/execute/references/context-router.md',
  'skills/execute/references/environment-driver.md',
  'skills/execute/references/verification-graph.md',
  'skills/execute/references/runbook-contract.md',
  'skills/execute/references/e2e-test-contract.md',
];

for (const path of requiredReferences)
  assert.ok(readFileSync(resolve(root, path), 'utf8').length > 200, `reference is unexpectedly empty: ${path}`);

console.log(`harness contract validation passed (${schemaPaths.length} schemas, V1 migration, generated manifests)`);
