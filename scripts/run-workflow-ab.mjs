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
const baselineRef = valueAfter('--baseline-ref') || 'HEAD';

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
- 当场景要求产出后端 E2E 时，backendE2EBlueprint 必须根据 Skill 构造具体可执行蓝图；不要把候选枚举当检查清单机械全选。repositoryGrounding 区分已由仓库证据确认的 exact_collected_file、上下文不足时先检查再锁定的 inspect_before_lock，以及编造路径。非后端 E2E 场景设为 null。
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
  if (expect.backendE2EBlueprint) {
    const blueprint = result.backendE2EBlueprint || {};
    add('backend-public-stateful-boundary', blueprint.boundary === 'public_protocol_to_owned_state', 3);
    add('backend-declared-runtime', blueprint.sutRuntime === 'declared_runtime', 2);
    const grounding = expect.backendE2EBlueprint.repositoryGrounding;
    const runnableGrounded = grounding === 'exact_collected_file'
      ? Boolean(blueprint.testPath) && Boolean(blueprint.command)
      : blueprint.repositoryGrounding === 'inspect_before_lock';
    add('backend-runnable-test', blueprint.testArtifact === 'runnable_test' && runnableGrounded, 3);
    if (grounding)
      add('backend-repository-grounding', blueprint.repositoryGrounding === grounding, 3);
    add('backend-setup-and-cleanup', blueprint.setupSteps?.length >= 2 && blueprint.cleanupSteps?.length >= 1, 2);
    add('backend-red-cause', blueprint.redCauseCheck === 'setup_healthy_then_business_assertion', 2);
    for (const component of expect.backendE2EBlueprint.realComponents || [])
      add(`backend-real-${component}`, blueprint.realComponents?.includes(component), 1);
    for (const assertion of expect.backendE2EBlueprint.assertionKinds || [])
      add(`backend-assert-${assertion}`, blueprint.assertionKinds?.includes(assertion), 1);
    for (const negative of expect.backendE2EBlueprint.negativePathKinds || [])
      add(`backend-negative-${negative}`, blueprint.negativePathKinds?.includes(negative), 1);
    for (const artifact of expect.backendE2EBlueprint.artifactKinds || [])
      add(`backend-artifact-${artifact}`, blueprint.artifactKinds?.includes(artifact), 1);
    if (expect.backendE2EBlueprint.asyncWait)
      add('backend-bounded-async-wait', blueprint.asyncWait === expect.backendE2EBlueprint.asyncWait, 2);
    add('backend-does-not-substitute-sut', !blueprint.substitutedComponents?.includes('sut') && !blueprint.substitutedComponents?.includes('owned_persistence'), 2);
  }

  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  return { earned, total, checks };
}

const report = {
  generatedAt: new Date().toISOString(),
  outputDir,
  baselineRef,
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
