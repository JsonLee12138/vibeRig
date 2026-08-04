import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(readFileSync(resolve(root, 'evals/workflow-ab/fixtures.json'), 'utf8'));
const matrix = JSON.parse(readFileSync(resolve(root, 'evals/workflow-ab/model-matrix.json'), 'utf8'));
const outputSchema = resolve(root, 'evals/workflow-ab/output.schema.json');
const suite = valueAfter('--suite') || 'screen';
const concurrency = Number(valueAfter('--concurrency') || 3);
const selectedModel = valueAfter('--model');
const selectedModels = new Set((valueAfter('--models') || '').split(',').filter(Boolean));
const selectedFixtures = new Set((valueAfter('--fixtures') || '').split(',').filter(Boolean));
const selectedVariant = valueAfter('--variant');
const repeat = Number(valueAfter('--repeat') || 1);
const baselineRef = valueAfter('--baseline-ref') || 'HEAD';
const outputDir = mkdtempSync(resolve(tmpdir(), `viberig-model-${suite}-`));

if (!matrix[suite])
  throw new Error(`Unknown suite: ${suite}`);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function loadBaseline(path) {
  return execFileSync('git', ['show', `${baselineRef}:${path}`], { cwd: root, encoding: 'utf8' });
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
- usesContextRouter 表示是否按路径/风险只加载必要项目上下文，而不是整库灌入。
- preservesTruthOwners 表示是否复用已有 PRD/spec/ADR/Runbook/任务系统，而不制造第二套真相源。
- usesExecutableEnvironment 表示是否优先运行项目声明的 bootstrap/start/health 等真实环境命令。
- usesVerificationGraph 表示是否把 Outcome、AC、TC、权威阶段和 Evidence 形成机器可追踪关系。
- requiresRunbookExercise 表示 Operational change 是否要求实际演练 Runbook，而不只生成文档。
- taskSplitPolicy 判断任务采用最少充分垂直切片、技术分层拆分，或不适用。
- parallelPolicy 判断并发是否要求契约稳定并规避冲突集合。
- uiVerificationPolicy 判断 UI 是否同时区分浏览器行为、截图/视觉比较和 owner UAT 三类证据。
- recoveryPolicy 判断重复失败后是否改变假设或策略，并只在连续无进展后形成 Blocker。
- deliveryFlowPolicy 判断既有授权是否跨内部阶段持续到目标，还是要求用户手动接力 Skill。
- subagentIntegrationPolicy 判断并发 Agent 是否隔离冲突范围并由主 Agent 统一集成和裁决。
- e2eExecutionPolicy 判断 TC 要求真实 E2E 时是否运行声明环境，还是用 mock 冒充。
- e2eContractPolicy 判断必需 E2E 是否在生产实现前产生正确 RED、经独立 review 并锁定 revision，修改语义时重新审批。
- deliveryPlanPolicy 判断 Milestone/Issue 是否采用 schema 校验的最少充分垂直计划，而不是纯文本或技术分层。
- notes 只写最多 5 条可由 Skill 文本直接支持的观察。

${skills}`;
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
  if (expect.mayClaimTargetNow === false)
    add('cannot-claim-target-now', !result.mayClaimTargetNow, 2);
  if (expect.invalidatesStaleEvidence)
    add('invalidates-stale-evidence', result.invalidatesStaleEvidence, 2);
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
  if (expect.contextRouter)
    add('context-router', result.usesContextRouter, 2);
  if (expect.preserveTruthOwners)
    add('preserve-truth-owners', result.preservesTruthOwners, 2);
  if (expect.executableEnvironment)
    add('executable-environment', result.usesExecutableEnvironment, 2);
  if (expect.verificationGraph)
    add('verification-graph', result.usesVerificationGraph, 2);
  if (expect.runbookExercise)
    add('runbook-exercise', result.requiresRunbookExercise, 2);
  if (expect.verticalMinimalSplit)
    add('vertical-minimal-split', result.taskSplitPolicy === 'vertical_minimal', 2);
  if (expect.contractLockedParallel)
    add('contract-locked-parallel', result.parallelPolicy === 'contract_locked', 2);
  if (expect.targetMode)
    add('target-mode', result.targetMode === expect.targetMode, 2);
  if (expect.uiVerification)
    add('ui-behavior-visual-owner-uat', result.uiVerificationPolicy === 'behavior_visual_owner_uat', 3);
  if (expect.recoveryPolicy)
    add('strategy-changing-recovery', result.recoveryPolicy === 'change_strategy_then_block_after_no_progress', 3);
  if (expect.deliveryFlow)
    add('continuous-delivery-flow', result.deliveryFlowPolicy === 'continuous_to_authorized_target', 3);
  if (expect.subagentIntegration)
    add('conflict-aware-integration', result.subagentIntegrationPolicy === 'conflict_aware_main_agent', 3);
  if (expect.realE2E)
    add('real-e2e-fidelity', result.e2eExecutionPolicy === 'real_or_declared_fidelity', 3);
  if (expect.lockedE2EContract)
    add('red-reviewed-locked-e2e', result.e2eContractPolicy === 'red_review_locked', 3);
  if (expect.schemaValidatedDeliveryPlan)
    add('schema-validated-vertical-plan', result.deliveryPlanPolicy === 'schema_validated_vertical', 3);
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  return { earned, total, rate: earned / total, checks };
}

function parseEvents(stdout) {
  const events = stdout.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  const completed = events.findLast(event => event.type === 'turn.completed');
  return { usage: completed?.usage || null, events };
}

function runJob(job) {
  return new Promise((resolveJob) => {
    const outputFile = resolve(outputDir, `${job.model}.${job.effort}.${job.fixture.id}.${job.variant}.${job.repeat}.json`);
    const started = performance.now();
    const child = spawn('codex', [
      'exec',
      '--ephemeral',
      '--ignore-user-config',
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--json',
      '-m',
      job.model,
      '-c',
      `model_reasoning_effort="${job.effort}"`,
      '--output-schema',
      outputSchema,
      '--output-last-message',
      outputFile,
      '-',
    ], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status) => {
      const durationMs = Math.round(performance.now() - started);
      try {
        if (status !== 0)
          throw new Error(stderr || stdout);
        const result = JSON.parse(readFileSync(outputFile, 'utf8'));
        const { usage } = parseEvents(stdout);
        resolveJob({ ...job, status: 'passed', durationMs, usage, result, score: score(result, job.fixture.expect) });
      }
      catch (error) {
        resolveJob({ ...job, status: 'failed', durationMs, error: String(error), stdout, stderr });
      }
    });
    child.stdin.end(buildPrompt(job.fixture, job.variant));
  });
}

async function runPool(jobs) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const result = await runJob(job);
      results.push(result);
      process.stderr.write(`${result.status} ${job.model}/${job.effort} ${job.fixture.id}/${job.variant} ${result.durationMs}ms\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

const models = matrix[suite].filter(item =>
  (!selectedModel || item.model === selectedModel)
  && (!selectedModels.size || selectedModels.has(item.model)),
);
const suiteFixtures = fixtures.filter(fixture =>
  fixture.suites.includes(suite)
  && (!selectedFixtures.size || selectedFixtures.has(fixture.id)),
);
const jobs = models.flatMap(config => suiteFixtures.flatMap((fixture) => {
  const availableVariants = fixture.candidateOnly ? ['candidate'] : ['baseline', 'candidate'];
  const variants = selectedVariant ? availableVariants.filter(variant => variant === selectedVariant) : availableVariants;
  return variants.flatMap(variant =>
    Array.from({ length: repeat }, (_, index) => ({ ...config, fixture, variant, repeat: index + 1 })),
  );
}));
const raw = await runPool(jobs);
const results = raw.map(({ fixture, ...result }) => ({ ...result, fixtureId: fixture.id, stage: fixture.stage }));

function aggregateFor(model, effort, variant) {
  const matching = results.filter(result => result.model === model && result.effort === effort && result.variant === variant && result.status === 'passed');
  const earned = matching.reduce((sum, result) => sum + result.score.earned, 0);
  const total = matching.reduce((sum, result) => sum + result.score.total, 0);
  const durationMs = matching.reduce((sum, result) => sum + result.durationMs, 0);
  const usage = matching.reduce((sum, result) => {
    for (const key of Object.keys(sum)) sum[key] += result.usage?.[key] || 0;
    return sum;
  }, { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 });
  return { runs: matching.length, earned, total, rate: total ? earned / total : null, durationMs, usage };
}

const summary = models.map(config => ({
  ...config,
  baseline: aggregateFor(config.model, config.effort, 'baseline'),
  candidate: aggregateFor(config.model, config.effort, 'candidate'),
}));
const report = {
  generatedAt: new Date().toISOString(),
  runner: 'codex exec --json',
  baselineRef,
  suite,
  concurrency,
  outputDir,
  pricing: {
    status: 'unavailable',
    reason: 'The active custom provider catalog exposes token usage but no dollar or credit rates.',
  },
  models,
  fixtures: suiteFixtures.map(({ id, stage, prompt }) => ({ id, stage, prompt })),
  summary,
  results,
};
const reportPath = resolve(outputDir, 'report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, summary }, null, 2));
