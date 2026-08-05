import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
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
  'skills/update-team/assets/team-profile.schema.json',
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

const agentSpecTemplate = JSON.parse(readFileSync(resolve(root, 'skills/agent-creator/assets/agent-spec.template.json'), 'utf8'));
assert.deepEqual(agentSpecTemplate.platform_model_overrides, {});
const codexAgentTemplate = readFileSync(resolve(root, 'skills/agent-creator/assets/codex-agent-template.toml'), 'utf8');
assert.match(codexAgentTemplate, /^model = "resolved_model"$/m);
assert.ok(codexAgentTemplate.indexOf('model = "resolved_model"') < codexAgentTemplate.indexOf('developer_instructions ='));

const teamManifest = JSON.parse(readFileSync(resolve(root, 'skills/built-in-agents/agents.manifest.json'), 'utf8'));
assert.equal(teamManifest.coreAgents.length, 7);
assert.deepEqual(new Set(teamManifest.coreAgents), new Set([
  'researcher',
  'implementation',
  'test_engineer',
  'code_review',
  'qa',
  'security_auditor',
  'integrator',
]));
assert.deepEqual(
  new Set([...teamManifest.coreAgents, ...teamManifest.conditionalAgents.map((agent: { name: string }) => agent.name)]),
  new Set(teamManifest.agents),
);
for (const agent of teamManifest.conditionalAgents)
  assert.ok(agent.signals.length > 0, `${agent.name} needs positive activation signals`);
assert.deepEqual(new Set(Object.keys(teamManifest.platformModelDefaults.codex)), new Set(teamManifest.agents));
const expectedCodexModels: Record<string, string> = {
  researcher: 'gpt-5.6-luna',
  implementation: 'gpt-5.6-luna',
  test_engineer: 'gpt-5.6-luna',
  code_review: 'gpt-5.6-terra',
  qa: 'gpt-5.6-terra',
  integrator: 'gpt-5.6-terra',
  backend_architect: 'gpt-5.6-terra',
  frontend_architect: 'gpt-5.6-terra',
  data_architect: 'gpt-5.6-terra',
  reliability_engineer: 'gpt-5.6-terra',
  uiux_design: 'gpt-5.6-terra',
  backend_e2e_engineer: 'gpt-5.6-sol',
  security_auditor: 'gpt-5.6-sol',
  architecture_red_team: 'gpt-5.6-sol',
};
assert.deepEqual(teamManifest.platformModelDefaults.codex, expectedCodexModels);
for (const name of teamManifest.agents) {
  const spec = JSON.parse(readFileSync(resolve(root, `skills/built-in-agents/assets/${name}.json`), 'utf8'));
  assert.equal(spec.name, name);
  assert.equal(spec.model, 'inherit', `${name} must remain provider-portable`);
  assert.deepEqual(new Set(spec.targets), new Set(['codex', 'claude', 'cursor']));
}

const renderedAgentsRoot = mkdtempSync('/tmp/viberig-rendered-agent-models-');
try {
  for (const platform of ['codex', 'claude', 'cursor'])
    mkdirSync(resolve(renderedAgentsRoot, `.${platform}/agents`), { recursive: true });
  for (const name of teamManifest.agents) {
    writeFileSync(resolve(renderedAgentsRoot, `.codex/agents/${name}.toml`), `name = "${name}"\nmodel = "${expectedCodexModels[name]}"\ndeveloper_instructions = """role"""\n`);
    writeFileSync(resolve(renderedAgentsRoot, `.claude/agents/${name}.md`), `---\nname: ${name}\nmodel: inherit\n---\n`);
    writeFileSync(resolve(renderedAgentsRoot, `.cursor/agents/${name}.md`), `---\nname: ${name}\nmodel: inherit\n---\n`);
  }
  const modelValidator = resolve(root, 'scripts/validate-rendered-agent-models.mjs');
  const validatorArgs = [modelValidator, '--root', renderedAgentsRoot, '--agents', teamManifest.agents.join(','), '--platforms', 'codex,claude,cursor'];
  assert.doesNotThrow(() => execFileSync(process.execPath, validatorArgs, { cwd: root, stdio: 'pipe' }));
  writeFileSync(resolve(renderedAgentsRoot, '.claude/agents/researcher.md'), '---\nname: researcher\nmodel: gpt-5.6-luna\n---\n');
  assert.throws(() => execFileSync(process.execPath, validatorArgs, { cwd: root, stdio: 'pipe' }));
}
finally {
  rmSync(renderedAgentsRoot, { recursive: true, force: true });
}
const ordinaryTestEngineer = JSON.parse(readFileSync(resolve(root, 'skills/built-in-agents/assets/test_engineer.json'), 'utf8'));
assert.ok(ordinaryTestEngineer.scope_not_allowed.some((rule: string) => rule.includes('backend E2E')));
const backendE2EEngineer = JSON.parse(readFileSync(resolve(root, 'skills/built-in-agents/assets/backend_e2e_engineer.json'), 'utf8'));
assert.ok(backendE2EEngineer.scope_allowed.some((rule: string) => rule.includes('public HTTP')));

const teamProfile = {
  version: 1,
  manifestFingerprint: 'sha256:manifest',
  policyFingerprint: 'sha256:policy',
  sources: ['go.mod', 'api/openapi.yaml'],
  coreAgents: ['researcher', 'implementation', 'test_engineer', 'code_review', 'qa', 'security_auditor', 'integrator'],
  conditionalAgents: { backend_architect: { evidence: ['api/openapi.yaml'], reason: 'public HTTP API' } },
  preservedAgents: [],
  platforms: {
    codex: { status: 'rendered', agents: ['researcher', 'implementation', 'test_engineer', 'code_review', 'qa', 'security_auditor', 'integrator', 'backend_architect'] },
    claude: { status: 'skipped', agents: [] },
    cursor: { status: 'skipped', agents: [] },
  },
};
assertSchema('skills/update-team/assets/team-profile.schema.json', teamProfile, true);
assertSchema('skills/update-team/assets/team-profile.schema.json', {
  ...teamProfile,
  coreAgents: [...teamProfile.coreAgents, 'backend_architect'],
}, false);
assertSchema('skills/update-team/assets/team-profile.schema.json', {
  ...teamProfile,
  conditionalAgents: { frontend_architect: { evidence: [], reason: 'maybe needed' } },
}, false);
assertSchema('skills/update-team/assets/team-profile.schema.json', {
  ...teamProfile,
  conditionalAgents: { invented_agent: { evidence: ['src/'], reason: 'not in manifest' } },
}, false);

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
    backendExecution: null,
  }],
};
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', e2eContract, true);
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', {
  ...e2eContract,
  contracts: [{ ...e2eContract.contracts[0], oracleApproval: { status: 'pending', source: 'requirement_gate', approvedRevision: null } }],
}, false);

const backendE2EContract = {
  ...e2eContract,
  contracts: [{
    ...e2eContract.contracts[0],
    id: 'E2E-2',
    title: 'Create invitation through the public API',
    type: 'api_e2e',
    requiredFidelity: 'ephemeral',
    testPath: 'tests/api-e2e/invitations.spec.ts',
    backendExecution: {
      boundary: 'public_protocol_to_owned_state',
      transport: 'http',
      sutRuntime: 'declared_runtime',
      ownedDependencies: ['database'],
      externalDependencyPolicy: 'protocol_fake_at_boundary',
      isolation: 'unique_namespace_and_reset',
      commands: {
        bootstrap: 'make e2e-up',
        health: 'make e2e-health',
        test: 'make e2e-api',
        reset: 'make e2e-reset',
      },
      assertionKinds: ['response', 'durable_state', 'side_effect'],
      negativePathKinds: ['authorization', 'idempotency'],
      asyncWait: 'bounded_polling',
      artifactKinds: ['test_report', 'service_logs', 'database_snapshot'],
      repositoryGrounding: {
        testFramework: 'vitest',
        configPath: 'vitest.e2e.config.ts',
        discoveryCommand: 'pnpm vitest --config vitest.e2e.config.ts --list tests/api-e2e/invitations.spec.ts',
        collectionEvidenceRef: 'artifacts/viberig/E2E-2-collection.json',
        testFileHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
    },
  }],
};
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', backendE2EContract, true);
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', {
  ...backendE2EContract,
  contracts: [{ ...backendE2EContract.contracts[0], backendExecution: null }],
}, false);
assertSchema('skills/pre-development/assets/e2e-contract.schema.json', {
  ...backendE2EContract,
  contracts: [{
    ...backendE2EContract.contracts[0],
    backendExecution: {
      ...backendE2EContract.contracts[0].backendExecution,
      repositoryGrounding: {
        ...backendE2EContract.contracts[0].backendExecution.repositoryGrounding,
        collectionEvidenceRef: null,
        testFileHash: null,
      },
    },
  }],
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
