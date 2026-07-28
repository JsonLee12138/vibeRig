import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(readFileSync(resolve(root, 'evals/pi-company-ab/fixtures.json'), 'utf8'));
const outputDir = mkdtempSync(resolve(tmpdir(), 'viberig-pi-company-ab-'));
const modelArg = process.argv.find(arg => arg.startsWith('--model='))?.slice('--model='.length)
  ?? 'openai-codex/gpt-5.6-terra';
const thinkingArg = process.argv.find(arg => arg.startsWith('--thinking='))?.slice('--thinking='.length)
  ?? 'low';
const dryRun = process.argv.includes('--dry-run');
const onlyFixture = process.argv.find(arg => arg.startsWith('--fixture='))?.slice('--fixture='.length);
const skipCodex = process.argv.includes('--skip-codex');
const codexModelArg = process.argv.find(arg => arg.startsWith('--codex-model='))?.slice('--codex-model='.length)
  ?? modelArg.split('/').at(-1);
const outputSchema = resolve(root, 'evals/pi-company-ab/output.schema.json');
const usageProbePath = resolve(outputDir, 'subagent-usage-probe.ts');

writeFileSync(usageProbePath, `import { appendFileSync } from "node:fs";

export default function (pi) {
  for (const eventName of ["subagents:completed", "subagents:failed"]) {
    pi.events.on(eventName, (payload) => {
      const path = process.env.VIBERIG_AB_SUBAGENT_USAGE_PATH;
      if (path)
        appendFileSync(path, JSON.stringify({ eventName, ...payload }) + "\\n");
    });
  }
}
`);

function evaluatorPrompt(fixture, variant) {
  return `你正在接受软件交付编排 A/B 评测。

场景：
${fixture.prompt}

规则：
- ${variant === 'candidate'
  ? `如果存在 Agent 工具，必须实际派发最小必要专家，不得全员启动。独立专家应在同一轮并行调用，显式设置 run_in_background: true 和 thinking: ${thinkingArg}；随后必须用 get_subagent_result(wait: true) 逐个取回全部结果，并把专家证据综合进最终答案。不得在结果取回前交卷。`
  : '独立完成分析，不假设存在子 Agent。'}
- 只读分析，不修改文件，不调用任何外部写入工具。
- 最后只输出一个 JSON 对象，不要 Markdown 代码块，字段必须是：
  route: 实际参与的角色名数组；
  facts: 仓库证据数组；
  hypotheses: 尚未证实的假设数组；
  authority: { planeWriteOwner, finalAcceptanceOwner }；
  testStrategy: 测试层级与环境数组；
  risks: 风险数组；
  handoff: 下一位负责人、进入条件和禁止事项；
  boundaries: { testerVsVerifier, debuggerVsImplementer, knowledgeVsSkill }。
- 不得声称已经完成人工验收。`;
}

function parseJsonLines(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      }
      catch {
        return null;
      }
    })
    .filter(Boolean);
}

function textFromMessage(message) {
  if (!message || message.role !== 'assistant')
    return '';
  if (typeof message.content === 'string')
    return message.content;
  if (!Array.isArray(message.content))
    return '';
  return message.content
    .filter(item => item?.type === 'text')
    .map(item => item.text)
    .join('');
}

function extractAnswer(events) {
  const assistantEnds = events
    .filter(event => event.type === 'message_end' && event.message?.role === 'assistant')
    .map(event => textFromMessage(event.message))
    .filter(Boolean);
  const raw = assistantEnds.at(-1) ?? '';
  const cleaned = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  try {
    return { raw, parsed: JSON.parse(cleaned) };
  }
  catch {
    return { raw, parsed: null };
  }
}

function usageFromEvents(events) {
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  for (const event of events) {
    if (event.type !== 'message_end' || event.message?.role !== 'assistant')
      continue;
    const item = event.message.usage;
    if (!item)
      continue;
    usage.input += item.input ?? 0;
    usage.output += item.output ?? 0;
    usage.cacheRead += item.cacheRead ?? 0;
    usage.cacheWrite += item.cacheWrite ?? 0;
    usage.cost += item.cost?.total ?? 0;
  }
  return usage;
}

function effectivePiTokens(usage) {
  return (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheWrite ?? 0);
}

function readJsonLines(path) {
  if (!existsSync(path))
    return [];
  return parseJsonLines(readFileSync(path, 'utf8'));
}

function runPiVariant(fixture, variant) {
  const args = [
    '--mode',
    'json',
    '--print',
    '--no-session',
    '--offline',
    '--no-context-files',
    '--model',
    modelArg,
    '--thinking',
    thinkingArg,
  ];

  if (variant === 'baseline') {
    args.push(
      '--no-extensions',
      '--no-skills',
      '--tools',
      'read,grep,find,ls',
    );
  }
  else {
    args.push(
      '--approve',
      '--extension',
      usageProbePath,
      '--tools',
      'read,grep,find,ls,Agent,get_subagent_result,viberig_company_status,viberig_plane_capabilities,viberig_plane_read_work_item',
    );
  }
  args.push(evaluatorPrompt(fixture, variant));

  if (dryRun)
    return { command: ['pi', ...args], elapsedMs: 0, events: [], answer: { raw: '', parsed: null }, agentCalls: [], subagentRuns: [] };

  const subagentUsagePath = resolve(outputDir, `${fixture.id}.${variant}.subagents.jsonl`);
  const started = performance.now();
  const result = spawnSync('pi', args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PI_OFFLINE: '1',
      VIBERIG_AB_SUBAGENT_USAGE_PATH: subagentUsagePath,
    },
    timeout: 900_000,
    maxBuffer: 50 * 1024 * 1024,
  });
  const elapsedMs = Math.round(performance.now() - started);
  if (result.status !== 0) {
    throw new Error(`pi ${variant} failed for ${fixture.id}\n${result.stderr || result.stdout}`);
  }
  const events = parseJsonLines(result.stdout);
  const agentCalls = events
    .filter(event => event.type === 'tool_execution_start' && event.toolName === 'Agent')
    .map(event => event.args?.subagent_type ?? event.args?.agent ?? 'unknown');
  const parentUsage = usageFromEvents(events);
  const subagentRuns = readJsonLines(subagentUsagePath);
  const subagentUsage = subagentRuns.reduce((sum, run) => ({
    input: sum.input + (run.tokens?.input ?? 0),
    output: sum.output + (run.tokens?.output ?? 0),
    total: sum.total + (run.tokens?.total ?? 0),
  }), { input: 0, output: 0, total: 0 });
  return {
    elapsedMs,
    events,
    answer: extractAnswer(events),
    usage: {
      ...parentUsage,
      effectiveTokens: effectivePiTokens(parentUsage),
      subagents: subagentUsage,
      combinedEffectiveTokens: effectivePiTokens(parentUsage) + subagentUsage.total,
    },
    agentCalls,
    subagentRuns,
    stderr: result.stderr.trim(),
  };
}

function runCodex(fixture) {
  const outputFile = resolve(outputDir, `${fixture.id}.codex.json`);
  const prompt = evaluatorPrompt(fixture, 'codex');
  const args = [
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '--json',
    '-m',
    codexModelArg,
    '-c',
    `model_reasoning_effort="${thinkingArg}"`,
    '--output-schema',
    outputSchema,
    '--output-last-message',
    outputFile,
    '-',
  ];

  if (dryRun)
    return { command: ['codex', ...args], elapsedMs: 0, answer: { raw: '', parsed: null }, usage: null, agentCalls: [] };

  const started = performance.now();
  const result = spawnSync('codex', args, {
    cwd: root,
    encoding: 'utf8',
    input: prompt,
    timeout: 900_000,
    maxBuffer: 50 * 1024 * 1024,
  });
  const elapsedMs = Math.round(performance.now() - started);
  if (result.status !== 0)
    throw new Error(`codex failed for ${fixture.id}\n${result.stderr || result.stdout}`);

  const events = parseJsonLines(result.stdout);
  const completed = events.findLast(event => event.type === 'turn.completed');
  const rawUsage = completed?.usage ?? {};
  const cachedInput = rawUsage.cached_input_tokens ?? 0;
  const freshInput = Math.max(0, (rawUsage.input_tokens ?? 0) - cachedInput);
  const output = rawUsage.output_tokens ?? 0;
  const raw = readFileSync(outputFile, 'utf8').trim();
  return {
    elapsedMs,
    events,
    answer: { raw, parsed: JSON.parse(raw) },
    usage: {
      ...rawUsage,
      fresh_input_tokens: freshInput,
      effective_tokens: freshInput + output,
    },
    agentCalls: [],
    stderr: result.stderr.trim(),
  };
}

function score(fixture, run) {
  const answer = run.answer.parsed;
  const serialized = JSON.stringify(answer ?? {});
  const conceptChecks = {
    evidence: Array.isArray(answer?.facts) && answer.facts.length >= 2,
    trust_boundary: /信任边界|trust.?bound|RBAC|授权|secret|密钥/i.test(serialized),
    test_levels: Array.isArray(answer?.testStrategy) && answer.testStrategy.length >= 3,
    human_gate: /human|人工|用户|管理员.*验收/i.test(serialized),
    root_cause: /因果|根因|root.?cause|causal/i.test(serialized),
    idempotency: /幂等|idempoten/i.test(serialized),
    integration_test: /集成|integration|并发.*测试|concurren/i.test(serialized),
    handoff_contract: String(
      typeof answer?.handoff === 'string' ? answer.handoff : JSON.stringify(answer?.handoff ?? ''),
    ).length >= 80,
  };
  const checks = [
    { id: 'valid-json', pass: Boolean(answer), weight: 2 },
    ...fixture.requiredConcepts.map(concept => ({
      id: `required-concept:${concept}`,
      pass: Boolean(conceptChecks[concept]),
      weight: 2,
    })),
    {
      id: 'plane-authority',
      pass: /delivery.?lead|human|parent|交付负责人|主交付|人工|禁止|未分配|无[；：:]/i.test(String(answer?.authority?.planeWriteOwner ?? '')),
      weight: 2,
    },
    {
      id: 'human-acceptance',
      pass: /human|用户|人工|人类|业务负责人|管理员/i.test(String(answer?.authority?.finalAcceptanceOwner ?? '')),
      weight: 2,
    },
    {
      id: 'tester-verifier-boundary',
      pass: String(answer?.boundaries?.testerVsVerifier ?? '').length >= 12,
      weight: 1,
    },
    {
      id: 'debugger-implementer-boundary',
      pass: String(answer?.boundaries?.debuggerVsImplementer ?? '').length >= 12,
      weight: 1,
    },
    {
      id: 'knowledge-skill-boundary',
      pass: String(answer?.boundaries?.knowledgeVsSkill ?? '').length >= 12,
      weight: 1,
    },
    {
      id: 'has-evidence',
      pass: Array.isArray(answer?.facts) && answer.facts.length > 0,
      weight: 2,
    },
    {
      id: 'separates-hypotheses',
      pass: Array.isArray(answer?.hypotheses) && answer.hypotheses.length > 0,
      weight: 1,
    },
  ];
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  return { earned, total, checks };
}

function scoreRouting(fixture, run) {
  const actualRoles = run.agentCalls;
  const checks = [
    ...fixture.expectedRoles.map(role => ({
      id: `expected-role:${role}`,
      pass: actualRoles.includes(role),
      weight: 2,
    })),
    ...fixture.forbiddenRoles.map(role => ({
      id: `forbidden-role:${role}`,
      pass: !actualRoles.includes(role),
      weight: 1,
    })),
    {
      id: 'minimal-team',
      pass: actualRoles.length > 0 && actualRoles.length <= fixture.expectedRoles.length + 1,
      weight: 2,
    },
  ];
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  return { earned, total, checks, actualRoles };
}

const report = {
  generatedAt: new Date().toISOString(),
  model: modelArg,
  thinking: thinkingArg,
  outputDir,
  dryRun,
  fixtures: [],
};

for (const fixture of fixtures.filter(item => !onlyFixture || item.id === onlyFixture)) {
  process.stderr.write(`running ${fixture.id}: pi-baseline\n`);
  const baseline = runPiVariant(fixture, 'baseline');
  process.stderr.write(`running ${fixture.id}: pi-company\n`);
  const candidate = runPiVariant(fixture, 'candidate');
  process.stderr.write(`running ${fixture.id}: codex\n`);
  const codex = skipCodex ? null : runCodex(fixture);
  report.fixtures.push({
    id: fixture.id,
    baseline,
    candidate,
    codex,
    baselineScore: score(fixture, baseline),
    candidateScore: score(fixture, candidate),
    candidateRoutingScore: scoreRouting(fixture, candidate),
    codexScore: codex && score(fixture, codex),
  });
}

function aggregatePi(variant) {
  return report.fixtures.reduce((sum, fixture) => {
    const run = fixture[variant];
    const scoreResult = fixture[`${variant}Score`];
    return {
      earned: sum.earned + scoreResult.earned,
      total: sum.total + scoreResult.total,
      elapsedMs: sum.elapsedMs + run.elapsedMs,
      freshInput: sum.freshInput + (run.usage?.input ?? 0) + (run.usage?.subagents?.input ?? 0),
      output: sum.output + (run.usage?.output ?? 0) + (run.usage?.subagents?.output ?? 0),
      cacheRead: sum.cacheRead + (run.usage?.cacheRead ?? 0),
      effectiveTokens: sum.effectiveTokens + (run.usage?.combinedEffectiveTokens ?? run.usage?.effectiveTokens ?? 0),
      subagentRuns: sum.subagentRuns + (run.subagentRuns?.length ?? 0),
    };
  }, { earned: 0, total: 0, elapsedMs: 0, freshInput: 0, output: 0, cacheRead: 0, effectiveTokens: 0, subagentRuns: 0 });
}

function aggregateRouting() {
  return report.fixtures.reduce((sum, fixture) => ({
    earned: sum.earned + fixture.candidateRoutingScore.earned,
    total: sum.total + fixture.candidateRoutingScore.total,
  }), { earned: 0, total: 0 });
}

function aggregateCodex() {
  return report.fixtures.reduce((sum, fixture) => {
    if (!fixture.codex)
      return sum;
    return {
      earned: sum.earned + fixture.codexScore.earned,
      total: sum.total + fixture.codexScore.total,
      elapsedMs: sum.elapsedMs + fixture.codex.elapsedMs,
      freshInput: sum.freshInput + (fixture.codex.usage?.fresh_input_tokens ?? 0),
      output: sum.output + (fixture.codex.usage?.output_tokens ?? 0),
      cachedInput: sum.cachedInput + (fixture.codex.usage?.cached_input_tokens ?? 0),
      effectiveTokens: sum.effectiveTokens + (fixture.codex.usage?.effective_tokens ?? 0),
    };
  }, { earned: 0, total: 0, elapsedMs: 0, freshInput: 0, output: 0, cachedInput: 0, effectiveTokens: 0 });
}

report.aggregate = {
  baseline: aggregatePi('baseline'),
  candidate: aggregatePi('candidate'),
  candidateRouting: aggregateRouting(),
  codex: aggregateCodex(),
};

const reportPath = resolve(outputDir, 'report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, aggregate: report.aggregate }, null, 2));
