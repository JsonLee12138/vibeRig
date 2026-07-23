import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const requiredFiles = [
  'skills/intake/SKILL.md',
  'skills/execute/SKILL.md',
  'skills/execute/references/contracts.md',
  'skills/execute/references/goal-loop.md',
  'skills/execute/references/test-environment-broker.md',
  'skills/execute/assets/work-item.schema.json',
  'skills/execute/assets/goal-contract.schema.json',
  'skills/execute/assets/evidence-packet.schema.json',
  'skills/accept-deliver/SKILL.md',
  'skills/accept-deliver/references/acceptance-and-delivery.md',
  'skills/subagent-routing/references/model-routing.md',
  'skills/subagent-routing/assets/model-capability-prior.json',
  'skills/subagent-routing/assets/model-capability-prior.schema.json',
  'skills/subagent-routing/assets/route-observation.schema.json',
  'skills/update-team/assets/model-routing-profile.schema.json',
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
  'skills/execute/SKILL.md': ['Goal Loop', 'Completion Oracle', 'test-environment-broker.md', 'accept-deliver'],
  'skills/accept-deliver/SKILL.md': ['人工验收', 'Evidence', '明确授权', 'execute'],
  'skills/record-issue/SKILL.md': ['兼容', 'intake'],
  'skills/bugger/SKILL.md': ['兼容', 'intake', 'execute'],
  'skills/quick/SKILL.md': ['兼容', 'execute'],
  'skills/task-runner/SKILL.md': ['兼容', 'execute'],
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

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`workflow skill validation passed (${requiredFiles.length} required files, ${Object.keys(skillExpectations).length} skill contracts)`);
