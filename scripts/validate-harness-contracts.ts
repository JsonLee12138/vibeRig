import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
];

for (const path of schemaPaths)
  assert.doesNotThrow(() => JSON.parse(readFileSync(resolve(root, path), 'utf8')), `invalid JSON schema: ${path}`);

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

const requiredReferences = [
  'skills/execute/references/context-router.md',
  'skills/execute/references/environment-driver.md',
  'skills/execute/references/verification-graph.md',
  'skills/execute/references/runbook-contract.md',
];

for (const path of requiredReferences)
  assert.ok(readFileSync(resolve(root, path), 'utf8').length > 200, `reference is unexpectedly empty: ${path}`);

console.log(`harness contract validation passed (${schemaPaths.length} schemas, V1 migration, generated manifests)`);
