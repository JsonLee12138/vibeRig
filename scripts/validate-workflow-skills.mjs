import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const workflowFixtures = JSON.parse(readFileSync(resolve(root, 'evals/workflow-ab/fixtures.json'), 'utf8'));
const workflowOutputSchema = JSON.parse(readFileSync(resolve(root, 'evals/workflow-ab/output.schema.json'), 'utf8'));
const executeLinearFixtures = JSON.parse(readFileSync(resolve(root, 'evals/execute-linear-ab/fixtures.json'), 'utf8'));
const executeLinearOutputSchema = JSON.parse(readFileSync(resolve(root, 'evals/execute-linear-ab/output.schema.json'), 'utf8'));

const requiredFiles = [
  'skills/intake/SKILL.md',
  'skills/execute/SKILL.md',
  'skills/execute/references/contracts.md',
  'skills/execute/references/goal-loop.md',
  'skills/execute/references/test-environment-broker.md',
  'skills/execute/references/context-router.md',
  'skills/execute/references/environment-driver.md',
  'skills/execute/references/verification-graph.md',
  'skills/execute/references/runbook-contract.md',
  'skills/execute/references/e2e-test-contract.md',
  'skills/execute/references/linear-records.md',
  'skills/execute/assets/work-item.schema.json',
  'skills/execute/assets/goal-contract.schema.json',
  'skills/execute/assets/evidence-packet.schema.json',
  'skills/execute/assets/verification-graph.schema.json',
  'skills/pre-development/assets/delivery-plan.schema.json',
  'skills/pre-development/assets/e2e-contract.schema.json',
  'skills/accept-deliver/SKILL.md',
  'skills/accept-deliver/references/acceptance-and-delivery.md',
  'skills/subagent-routing/references/model-routing.md',
  'skills/subagent-routing/assets/model-capability-prior.json',
  'skills/subagent-routing/assets/model-capability-prior.schema.json',
  'skills/subagent-routing/assets/route-observation.schema.json',
  'skills/update-team/assets/model-routing-profile.schema.json',
  'skills/vb-init/assets/project-profile.schema.json',
  'skills/vb-init/assets/context-routes.schema.json',
  'skills/vb-init/assets/environment-profile.schema.json',
  'skills/vb-init/assets/runbook-index.schema.json',
  'evals/execute-linear-ab/fixtures.json',
  'evals/execute-linear-ab/output.schema.json',
];

for (const path of requiredFiles) {
  if (!existsSync(resolve(root, path)))
    failures.push(`missing required file: ${path}`);
}

for (const path of requiredFiles.filter(path => path.endsWith('.json'))) {
  try {
    JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  }
  catch (error) {
    failures.push(`invalid JSON ${path}: ${error.message}`);
  }
}

const skillExpectations = {
  'skills/intake/SKILL.md': ['统一 Work Item', '人工 Gate 1', 'work-item.json', '自动交接'],
  'skills/execute/SKILL.md': ['Goal Loop', 'Completion Oracle', 'test-environment-broker.md', 'Verification Graph', 'Environment Driver', 'accept-deliver', 'vb-linear', 'execution_started', 'technically_ready', 'Proof Packet', '内容 intent', 'read-back'],
  'skills/pre-development/SKILL.md': ['Publish Draft', 'Publish Proposal', 'plan_fingerprint', '计划同步摘要', 'linear_draft_visible', 'read-back'],
  'skills/accept-deliver/SKILL.md': ['人工验收', 'Evidence', '明确授权', 'execute'],
  'skills/record-issue/SKILL.md': ['兼容', 'intake'],
  'skills/bugger/SKILL.md': ['兼容', 'intake', 'execute'],
  'skills/quick/SKILL.md': ['兼容', 'execute'],
  'skills/task-runner/SKILL.md': ['兼容', 'execute', 'Proof Packet', '不能只更新状态'],
  'skills/blocker-resume/SKILL.md': ['兼容', 'execute'],
  'skills/accept-issue/SKILL.md': ['兼容', 'accept-deliver'],
  'skills/accept-milestone/SKILL.md': ['兼容', 'accept-deliver'],
  'skills/merge-issue/SKILL.md': ['兼容', 'accept-deliver'],
  'skills/subagent-routing/SKILL.md': ['capability before model', 'route observation', 'at most 10%'],
  'skills/update-team/SKILL.md': ['.vibeRig/model-routing.yaml', 'provider-specific accepted evidence', 'model: inherit'],
  'skills/insights/SKILL.md': ['routing_observations', '少于 5 个可比样本', 'confounder'],
};

for (const [path, needles] of Object.entries(skillExpectations)) {
  const text = readFileSync(resolve(root, path), 'utf8');
  const lineCount = text.split('\n').length;
  if (lineCount > 500)
    failures.push(`${path} exceeds 500 lines (${lineCount})`);
  for (const needle of needles) {
    if (!text.includes(needle))
      failures.push(`${path} missing contract phrase: ${needle}`);
  }
  if (/\[TODO|TODO:|FIXME|TBD/.test(text))
    failures.push(`${path} contains unresolved placeholder`);
}

const primaryText = [
  'skills/intake/SKILL.md',
  'skills/execute/SKILL.md',
  'skills/accept-deliver/SKILL.md',
].map(path => readFileSync(resolve(root, path), 'utf8')).join('\n');

const bannedPrimaryPatterns = [
  /请.*调用 `quick`/,
  /请.*调用 `task-runner`/,
  /Every Linear task execution must use a subagent/,
  /缺少 \.env\.test.*询问用户/,
];

for (const pattern of bannedPrimaryPatterns) {
  if (pattern.test(primaryText))
    failures.push(`primary workflow contains banned pattern: ${pattern}`);
}

const readmes = [
  readFileSync(resolve(root, 'README.md'), 'utf8'),
  readFileSync(resolve(root, 'README.zh-CN.md'), 'utf8'),
].join('\n');

for (const phrase of ['intake', 'execute', 'accept-deliver', 'Goal Loop', 'Work Item']) {
  if (!readmes.includes(phrase))
    failures.push(`README workflow missing: ${phrase}`);
}

if (/bugger.*quick.*accept-issue/i.test(readmes))
  failures.push('README still advertises the legacy bugger -> quick -> accept-issue chain');

const requiredEvalFixtures = [
  'ui-implementation-visual-acceptance',
  'confirmed-requirement-to-pr',
  'repeated-failure-strategy-recovery',
  'multi-agent-shared-contract-conflict',
  'declared-real-e2e-execution',
  'locked-e2e-contract-before-implementation',
  'schema-validated-milestone-issue-plan',
  'backend-api-invitation-e2e-blueprint',
  'backend-webhook-idempotency-e2e-blueprint',
  'backend-tenant-isolation-e2e-blueprint',
];
const fixtureIds = workflowFixtures.map(fixture => fixture.id);
if (new Set(fixtureIds).size !== fixtureIds.length)
  failures.push('workflow A/B fixture ids must be unique');
for (const id of requiredEvalFixtures) {
  if (!fixtureIds.includes(id))
    failures.push(`missing workflow A/B fixture: ${id}`);
}

for (const field of [
  'uiVerificationPolicy',
  'recoveryPolicy',
  'deliveryFlowPolicy',
  'subagentIntegrationPolicy',
  'e2eExecutionPolicy',
  'e2eContractPolicy',
  'deliveryPlanPolicy',
]) {
  if (!workflowOutputSchema.required.includes(field) || !workflowOutputSchema.properties[field])
    failures.push(`workflow A/B output schema missing required field: ${field}`);
}

if (!workflowOutputSchema.properties.backendE2EBlueprint)
  failures.push('workflow A/B output schema missing backendE2EBlueprint');

const executeLinearFixtureIds = executeLinearFixtures.map(fixture => fixture.id);
if (new Set(executeLinearFixtureIds).size !== executeLinearFixtureIds.length)
  failures.push('execute Linear A/B fixture ids must be unique');
const executeLinearWeight = executeLinearFixtures.reduce((total, fixture) =>
  total + Object.values(fixture.weights).reduce((sum, weight) => sum + weight, 0), 0);
if (executeLinearWeight !== 100)
  failures.push(`execute Linear A/B weights must total 100, received ${executeLinearWeight}`);
for (const fixture of executeLinearFixtures) {
  for (const field of Object.keys(fixture.weights)) {
    if (!(field in fixture.expect))
      failures.push(`execute Linear A/B ${fixture.id} weights missing expectation: ${field}`);
  }
}
const executeLinearCaseIds = executeLinearOutputSchema.properties.cases.items.properties.caseId.enum;
for (const id of executeLinearFixtureIds) {
  if (!executeLinearCaseIds.includes(id))
    failures.push(`execute Linear A/B output schema missing case id: ${id}`);
}

for (const runner of ['scripts/run-workflow-ab.mjs', 'scripts/run-workflow-model-matrix.mjs']) {
  if (!readFileSync(resolve(root, runner), 'utf8').includes('--baseline-ref'))
    failures.push(`${runner} does not support an explicit baseline ref`);
}

const executeLinearRunner = readFileSync(resolve(root, 'scripts/run-execute-linear-ab.mjs'), 'utf8');
for (const phrase of ['--baseline-ref', 'skills/vb-linear/SKILL.md', 'readBackBeforeAck']) {
  if (!executeLinearRunner.includes(phrase))
    failures.push(`execute Linear A/B runner missing: ${phrase}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`workflow skill validation passed (${requiredFiles.length} required files, ${Object.keys(skillExpectations).length} skill contracts)`);
