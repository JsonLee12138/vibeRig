import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const matrix = JSON.parse(readFileSync(
  resolve(root, 'evals/pi-development-ab/model-matrix.json'),
  'utf8',
));

assert.deepEqual(
  matrix.map(item => item.id),
  ['terra', 'mimo-v2.5'],
  'the matrix must keep the primary and weaker comparison models',
);
assert.equal(
  matrix.find(item => item.id === 'mimo-v2.5')?.model,
  'xiaomi-token-plan-cn/mimo-v2.5',
);

const expectedStarterScores = {
  'event-ledger': { passed: 2, tests: 7 },
  'oauth-config': { passed: 1, tests: 7 },
};

for (const [fixtureId, expected] of Object.entries(expectedStarterScores)) {
  const fixtureRoot = resolve(root, 'evals/pi-development-ab/fixtures', fixtureId);
  const result = spawnSync(
    'node',
    ['--test', '--test-reporter=tap', 'hidden.test.mjs'],
    {
      cwd: fixtureRoot,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.equal(Number(output.match(/# tests (\d+)/)?.[1]), expected.tests);
  assert.equal(Number(output.match(/# pass (\d+)/)?.[1]), expected.passed);
  assert.notEqual(result.status, 0, `${fixtureId} starter must not satisfy the hidden contract`);
}

const dryRun = spawnSync(
  'node',
  [
    'scripts/run-pi-development-ab.mjs',
    '--dry-run',
    '--models',
    'terra',
    '--fixture',
    'event-ledger',
  ],
  {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
  },
);
assert.equal(dryRun.status, 0, dryRun.stderr);
const result = JSON.parse(dryRun.stdout);
assert.deepEqual(
  Object.keys(result.summary.terra),
  [
    'dev_only',
    'dev_test',
    'dev_test_review',
    'dev_test_review_security',
    'full_verify',
  ],
);
for (const checkpoint of Object.values(result.summary.terra)) {
  assert.deepEqual(checkpoint.accuracy, { passed: 2, tests: 7, rate: 2 / 7 });
  assert.equal(checkpoint.visiblePasses, 1);
  assert.equal(checkpoint.technicalPasses, 0);
}

console.log('Pi development A/B fixtures and dry-run pipeline are valid.');
