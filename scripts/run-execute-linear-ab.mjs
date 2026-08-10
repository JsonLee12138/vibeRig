import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(readFileSync(resolve(root, 'evals/execute-linear-ab/fixtures.json'), 'utf8'));
const outputSchema = resolve(root, 'evals/execute-linear-ab/output.schema.json');
const outputDir = mkdtempSync(resolve(tmpdir(), 'viberig-execute-linear-ab-'));
const dryRun = process.argv.includes('--dry-run');
const baselineRef = valueAfter('--baseline-ref') || 'HEAD';
const runCount = Number(valueAfter('--runs') || 1);

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 10)
  throw new Error('--runs must be an integer between 1 and 10');

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function load(path, variant) {
  if (variant === 'baseline')
    return execFileSync('git', ['show', `${baselineRef}:${path}`], { cwd: root, encoding: 'utf8' });
  return readFileSync(resolve(root, path), 'utf8');
}

function skillBundle(variant) {
  const paths = [
    'skills/execute/SKILL.md',
    'skills/execute/references/contracts.md',
    'skills/execute/references/goal-loop.md',
  ];
  const execute = load(paths[0], variant);
  if (execute.includes('../vb-linear/SKILL.md')) {
    paths.push(
      'skills/vb-linear/SKILL.md',
      'skills/vb-linear/references/lifecycle-projection.md',
    );
  }
  return paths.map(path => `<skill-file path="${path}">\n${load(path, variant)}\n</skill-file>`).join('\n\n');
}

function buildPrompt(variant) {
  const cases = fixtures.map(({ id, prompt }) => `### ${id}\n${prompt}`).join('\n\n');
  return `你是软件开发 Harness 的只读行为评测器。不要修改文件，也不要真正访问 Linear。

只依据提供的 Skill 文本，分别推演每个场景中 execute 会明确要求主 Agent 做什么。不要评价文风，不要猜测未写明的最佳实践，也不要因为版本身份偏袒任一方。

字段解释：
- transitionIntents：按时间顺序记录明确形成或尝试形成的语义 lifecycle intent；工具不可用但已持久化的 intent 也计入。只读场景或缺少 Linear identity 时为空。
- writesLinear：场景中是否会实际调用外部 Linear 写能力；工具不可用、缺少 identity 或禁止写入时为 false。
- resolvesWorkflowStateBeforeWrite、persistsOutboxBeforeWrite、readBackBeforeAck：Skill 是否明确要求该协议；即使本场景因不可用未完成写入，也按协议要求判断。
- finalOutboxState：全部预期投影均 read-back 后为 ack；外部能力不可用为 unavailable；无需投影为 not_applicable。
- linearStatusTerminal：最终 Linear 状态是否为 completed/Done。技术完成等待人工验收时必须是 false。
- notes 最多 5 条，只能写 Skill 文本直接支持的观察。

场景：
${cases}

Skill 文本：
${skillBundle(variant)}`;
}

function runVariant(variant, runIndex) {
  const outputFile = resolve(outputDir, `${variant}.${runIndex}.json`);
  const prompt = buildPrompt(variant);
  if (dryRun) {
    writeFileSync(resolve(outputDir, `${variant}.${runIndex}.prompt.txt`), prompt);
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

  if (result.status !== 0)
    throw new Error(`codex exec failed for ${variant}\n${result.stderr || result.stdout}`);
  return JSON.parse(readFileSync(outputFile, 'utf8'));
}

function equal(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function score(result) {
  const byId = new Map(result.cases.map(item => [item.caseId, item]));
  const fixtureScores = fixtures.map((fixture) => {
    const actual = byId.get(fixture.id);
    const checks = Object.entries(fixture.weights).map(([field, weight]) => ({
      field,
      weight,
      pass: Boolean(actual) && equal(actual[field], fixture.expect[field]),
      expected: fixture.expect[field],
      actual: actual?.[field],
    }));
    return {
      id: fixture.id,
      earned: checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0),
      total: checks.reduce((sum, check) => sum + check.weight, 0),
      checks,
    };
  });
  return {
    earned: fixtureScores.reduce((sum, fixture) => sum + fixture.earned, 0),
    total: fixtureScores.reduce((sum, fixture) => sum + fixture.total, 0),
    fixtures: fixtureScores,
  };
}

function summarize(scores) {
  const values = scores.map(item => item.earned);
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    totalPerRun: scores[0].total,
    passAt90: values.filter(value => value >= 90).length,
    runs: values.length,
  };
}

function staticContractScore(variant) {
  const text = load('skills/execute/SKILL.md', variant);
  const checks = [
    ['shared-vb-linear-reference', text.includes('../vb-linear/SKILL.md'), 12],
    ['configured-identity-gate', text.includes('tracking.provider: linear') && text.includes('Linear identity'), 8],
    ['execution-transition', text.includes('execution_started'), 8],
    ['review-transition', text.includes('review_started'), 8],
    ['repair-transitions', text.includes('repair_started') && text.includes('acceptance_rejected'), 8],
    ['technically-ready-transition', text.includes('technically_ready'), 8],
    ['write-ahead-outbox', text.includes('outbox intent') && text.includes('payload fingerprint'), 10],
    ['read-back-before-ack', text.includes('read-back') && text.includes('ack'), 8],
    ['no-blind-retry', text.includes('search/adopt') && text.includes('禁止盲目重试'), 6],
    ['unavailable-is-recoverable', text.includes('pending/unavailable') && text.includes('不得') && text.includes('同步成功'), 6],
    ['missing-identity-no-create', text.includes('missing_identity') && text.includes('不因此创建新 Issue'), 6],
    ['main-agent-only', text.includes('只有主 Agent 执行投影'), 5],
    ['execute-never-done', text.includes('不得发出 `done`') && text.includes('accept-deliver'), 7],
  ].map(([id, pass, weight]) => ({ id, pass, weight }));
  return {
    earned: checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0),
    total: checks.reduce((sum, check) => sum + check.weight, 0),
    checks,
  };
}

const baseline = Array.from({ length: runCount }, (_, index) => runVariant('baseline', index + 1));
const candidate = Array.from({ length: runCount }, (_, index) => runVariant('candidate', index + 1));
let behavioralScores = null;
let scores = null;
if (!dryRun) {
  behavioralScores = {
    baseline: baseline.map(score),
    candidate: candidate.map(score),
  };
  scores = {
    behavioral: behavioralScores,
    behavioralSummary: {
      baseline: summarize(behavioralScores.baseline),
      candidate: summarize(behavioralScores.candidate),
    },
    staticContract: {
      baseline: staticContractScore('baseline'),
      candidate: staticContractScore('candidate'),
    },
  };
}
const report = {
  generatedAt: new Date().toISOString(),
  baselineRef,
  dryRun,
  runCount,
  outputDir,
  baseline,
  candidate,
  scores,
};
const reportPath = resolve(outputDir, 'report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, scores: report.scores && {
  behavioral: report.scores.behavioralSummary,
  staticContract: {
    baseline: `${report.scores.staticContract.baseline.earned}/${report.scores.staticContract.baseline.total}`,
    candidate: `${report.scores.staticContract.candidate.earned}/${report.scores.staticContract.candidate.total}`,
  },
} }, null, 2));
