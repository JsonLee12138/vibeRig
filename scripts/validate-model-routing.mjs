import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const failures = [];

function check(condition, message) {
  if (!condition)
    failures.push(message);
}

const prior = readJson('skills/subagent-routing/assets/model-capability-prior.json');
const priorSchema = readJson('skills/subagent-routing/assets/model-capability-prior.schema.json');
const observationSchema = readJson('skills/subagent-routing/assets/route-observation.schema.json');
const profileSchema = readJson('skills/update-team/assets/model-routing-profile.schema.json');
const fixtures = readJson('evals/model-routing/fixtures.json');

check(prior.version && prior.provider && prior.evidence, 'model prior must be versioned and evidence-backed');
check(prior.routes.length >= 4, 'model prior must cover the main workflow task families');
check(prior.invalidationSignals.length > 0, 'model prior must define invalidation signals');
check(priorSchema.$defs?.modelSelection, 'prior schema must define modelSelection');
check(observationSchema.properties?.prediction, 'route observation must capture prediction');
check(observationSchema.properties?.outcome, 'route observation must capture outcome');
check(profileSchema.properties?.catalogFingerprint, 'profile must bind the model catalog');
check(profileSchema.properties?.policyFingerprint, 'profile must bind the routing policy');

for (const fixture of fixtures) {
  const { input, expect, id } = fixture;
  if (expect.explorationEligible) {
    check(['L0', 'L1'].includes(input.risk), `${id}: exploration requires L0/L1`);
    check(input.reversible === true, `${id}: exploration requires reversible work`);
    check(input.deterministicOracle === true, `${id}: exploration requires a deterministic oracle`);
    check(input.protectedGate === false, `${id}: exploration cannot own a protected Gate`);
    check(expect.maxExplorationRate <= 0.1, `${id}: exploration rate exceeds 10%`);
  }
  if (input.protectedGate) {
    check(expect.explorationEligible === false, `${id}: protected Gate must not explore`);
    check(expect.allowedPolicyActions?.every(action => ['exploit', 'shadow'].includes(action)), `${id}: protected Gate has unsafe policy action`);
  }
  if (input.providerSpecificEvidence === false) {
    check(expect.model === 'inherit', `${id}: missing provider evidence must inherit`);
    check(expect.usesCodexWinner === false, `${id}: provider route leaked a Codex winner`);
  }
  if ((input.comparableSamples ?? 0) < 5)
    check(expect.defaultChanged === false, `${id}: fewer than 5 samples changed the default`);
  if (input.criticalFailure) {
    check(expect.explorationEligible === false, `${id}: Critical failure must block exploration`);
    check(expect.decision === 'block_exploration', `${id}: Critical failure must emit block_exploration`);
  }
  if (input.configuredModel && !input.availableModels.includes(input.configuredModel)) {
    check(expect.policyAction === 'fallback', `${id}: unavailable model must record fallback`);
    check(expect.silentSubstitution === false, `${id}: unavailable model fallback cannot be silent`);
  }
  check(expect.defaultChanged === false, `${id}: fixture changed a default outside update-team`);
}

if (failures.length) {
  console.error('Model-routing validation failed:');
  for (const failure of failures)
    console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`model-routing validation passed (${fixtures.length} fixtures, ${prior.routes.length} prior routes)`);
