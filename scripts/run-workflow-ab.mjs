import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(readFileSync(resolve(root, 'evals/workflow-ab/fixtures.json'), 'utf8'))
  .filter(fixture => !fixture.candidateOnly);
const outputSchema = resolve(root, 'evals/workflow-ab/output.schema.json');
const outputDir = mkdtempSync(resolve(tmpdir(), 'viberig-workflow-ab-'));
const dryRun = process.argv.includes('--dry-run');

function loadBaseline(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'utf8' });
}

function loadCandidate(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function buildPrompt(fixture, variant) {
  const files = variant === 'baseline' ? fixture.baselineFiles : fixture.candidateFiles;
  const load = variant === 'baseline' ? loadBaseline : loadCandidate;
  const skills = files.map(path => `<skill path="${path}">\n${load(path)}\n</skill>`).join('\n\n');

  return `你是软件开发 Harness 的只读行为评测器。不要修改文件，不要执行场景中的副作用。

只依据下面提供的 Skill 文本，推演系统面对用户场景时会如何路由。不要评价写作风格，不要因为这是 baseline 或 candidate 而偏袒任一方。

场景：
${fixture.prompt}

评测要求：
- route 写实际阶段或 Skill 顺序。
- humanGates 只写确实需要用户交互的 Gate。
- workItemFields 只写流程明确会形成的字段。
- continuesUntilTarget 表示在已授权范围内是否会自行跨内部阶段继续到目标。
- requiresManualSkillSelection 表示用户是否必须再调用另一个 Skill 才能继续。
- testEnvironmentStrategy 表示缺少配置时的行为。
- mayClaimTargetNow 表示以当前证据和授权是否已经可以宣称目标完成，而不是未来补齐 Gate 后能否继续。
- invalidatesStaleEvidence 表示候选 revision 改变时是否作废旧证据并重新验证。
- externalWritePolicy 判断是否尊重只读/确认前不写入/明确授权。
- notes 只写最多 5 条可由 Skill 文本直接支持的观察。

${skills}`;
}

function runCodex(fixture, variant) {
  const outputFile = resolve(outputDir, `${fixture.id}.${variant}.json`);
  const prompt = buildPrompt(fixture, variant);

  if (dryRun) {
    writeFileSync(resolve(outputDir, `${fixture.id}.${variant}.prompt.txt`), prompt);
    return null;
  }

  const result = spawnSync('codex', [
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '--output-schema',
    outputSchema,
    '--output-last-message',
    outputFile,
    '-',
  ], {
    cwd: root,
    encoding: 'utf8',
    input: prompt,
    timeout: 600_000,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(`codex exec failed for ${fixture.id}/${variant}\n${result.stderr || result.stdout}`);
  }

  return JSON.parse(readFileSync(outputFile, 'utf8'));
}

const completeFields = new Set([
  'problem',
  'causal_model',
  'proposed_change',
  'impact',
  'scope',
  'acceptance_oracle',
  'test_strategy',
]);

function score(result, expect) {
  const checks = [];
  const add = (id, pass, weight) => checks.push({ id, pass, weight });

  add('no-manual-skill-selection', !result.requiresManualSkillSelection, 2);
  add('no-skill-or-config-gate', !result.humanGates.includes('skill_handoff') && !result.humanGates.includes('test_configuration'), 2);
  add('respects-authority', result.externalWritePolicy === 'respects_authority', 1);
  add('completion-oracle', result.hasCompletionOracle, 1);

  if (expect.completeWorkItem)
    add('complete-work-item', [...completeFields].every(field => result.workItemFields.includes(field)), 2);
  if (expect.continuousExecution)
    add('continuous-execution', result.continuesUntilTarget, 2);
  if (expect.humanAcceptance)
    add('human-acceptance', result.humanGates.includes('human_acceptance'), 1);
  if (expect.requirementConfirmation)
    add('requirement-confirmation', result.humanGates.includes('requirement_confirmation'), 1);
  else
    add('no-redundant-requirement-gate', !result.humanGates.includes('requirement_confirmation'), 1);
  if (expect.automaticTestEnvironment) {
    add('automatic-test-environment', !['ask_user', 'not_applicable'].includes(result.testEnvironmentStrategy), 2);
    add('evidence-fidelity', result.distinguishesEvidenceFidelity, 1);
  }

  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  return { earned, total, checks };
}

const report = {
  generatedAt: new Date().toISOString(),
  outputDir,
  dryRun,
  fixtures: [],
};

for (const fixture of fixtures) {
  const baseline = runCodex(fixture, 'baseline');
  const candidate = runCodex(fixture, 'candidate');
  report.fixtures.push({
    id: fixture.id,
    baseline,
    candidate,
    baselineScore: baseline && score(baseline, fixture.expect),
    candidateScore: candidate && score(candidate, fixture.expect),
  });
}

if (!dryRun) {
  const aggregate = variant => report.fixtures.reduce((sum, fixture) => {
    const scoreResult = fixture[`${variant}Score`];
    return { earned: sum.earned + scoreResult.earned, total: sum.total + scoreResult.total };
  }, { earned: 0, total: 0 });
  report.aggregate = {
    baseline: aggregate('baseline'),
    candidate: aggregate('candidate'),
  };
}

const reportPath = resolve(outputDir, 'report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, aggregate: report.aggregate || null }, null, 2));
