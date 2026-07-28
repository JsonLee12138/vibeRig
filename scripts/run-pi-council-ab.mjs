import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesRoot = resolve(root, 'evals/pi-development-ab/fixtures');
const outputDir = mkdtempSync(resolve(tmpdir(), 'viberig-pi-council-ab-'));
const reportTarget = valueAfter('--report');
const onlyFixture = valueAfter('--fixture');
const dryRun = process.argv.includes('--dry-run');
const implementationModel = {
  id: 'mimo-v2.5',
  model: 'xiaomi-token-plan-cn/mimo-v2.5',
  thinking: 'low',
};
const validationModel = {
  id: 'gpt-5.6-sol',
  model: 'openai-codex/gpt-5.6-sol',
  thinking: 'high',
};
const fixtureIds = readdirSync(fixturesRoot)
  .filter(name => statSync(resolve(fixturesRoot, name)).isDirectory())
  .filter(name => !onlyFixture || name === onlyFixture);

if (!fixtureIds.length)
  throw new Error(`No fixture matched: ${onlyFixture ?? '(all)'}`);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, effectiveTokens: 0 };
}

function addUsage(target, usage) {
  for (const key of Object.keys(target))
    target[key] += usage[key] ?? 0;
}

function parseEvents(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(line => ['message_end', 'tool_execution_start', 'agent_end']
      .some(type => line.includes(`"type":"${type}"`)))
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

function answerFrom(events) {
  const raw = events
    .filter(event => event.type === 'message_end' && event.message?.role === 'assistant')
    .map(event => event.message.content
      ?.filter(item => item?.type === 'text')
      .map(item => item.text)
      .join('') ?? '')
    .filter(Boolean)
    .at(-1) ?? '';
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  const object = raw.includes('{') && raw.includes('}')
    ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    : null;
  for (const candidate of [cleaned, object]) {
    try {
      if (candidate)
        return { raw, parsed: JSON.parse(candidate) };
    }
    catch {
      // Try the next representation.
    }
  }
  return { raw, parsed: null };
}

function usageFrom(events) {
  const usage = emptyUsage();
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
  }
  usage.effectiveTokens = usage.input + usage.output + usage.cacheWrite;
  return usage;
}

async function runPi({ fixtureId, variant, workspace, stage, model, prompt, mutating = false, bash = false }) {
  const tracePath = resolve(outputDir, `${fixtureId}.${variant}.${stage}.json`);
  const tools = mutating
    ? 'read,grep,find,ls,bash,edit,write'
    : bash
      ? 'read,grep,find,ls,bash'
      : 'read,grep,find,ls';
  const args = [
    '--mode',
    'json',
    '--print',
    '--no-session',
    '--offline',
    '--no-context-files',
    '--no-extensions',
    '--no-skills',
    '--approve',
    '--model',
    model.model,
    '--thinking',
    model.thinking,
    '--tools',
    tools,
    prompt,
  ];
  process.stderr.write(`running ${fixtureId}/${variant}/${stage} (${model.id})\n`);
  if (dryRun) {
    const result = {
      stage,
      model: model.id,
      status: 'dry-run',
      elapsedMs: 0,
      usage: emptyUsage(),
      answer: { raw: '', parsed: null },
      tracePath,
    };
    writeFileSync(tracePath, `${JSON.stringify({ args, prompt }, null, 2)}\n`);
    return result;
  }

  const started = performance.now();
  const child = spawn('pi', args, {
    cwd: workspace,
    env: { ...process.env, PI_OFFLINE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => stdout += chunk);
  child.stderr.on('data', chunk => stderr += chunk);
  const exitCode = await new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${stage} timed out`));
    }, 900_000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });
  const events = parseEvents(stdout);
  const result = {
    stage,
    model: model.id,
    status: exitCode === 0 ? 'passed' : 'failed',
    elapsedMs: Math.round(performance.now() - started),
    usage: usageFrom(events),
    answer: answerFrom(events),
    tracePath,
    error: exitCode === 0 ? '' : stderr.slice(-8_000),
  };
  writeFileSync(tracePath, `${JSON.stringify({
    ...result,
    tools: events
      .filter(event => event.type === 'tool_execution_start')
      .map(event => event.toolName),
  }, null, 2)}\n`);
  if (exitCode !== 0)
    throw new Error(`${fixtureId}/${variant}/${stage}: ${result.error || `exit ${exitCode}`}`);
  return result;
}

function listFiles(directory) {
  if (!existsSync(directory))
    return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function sourceHash(workspace) {
  const sourceRoot = resolve(workspace, 'src');
  const hash = createHash('sha256');
  for (const path of listFiles(sourceRoot).sort()) {
    hash.update(relative(sourceRoot, path));
    hash.update(readFileSync(path));
  }
  return hash.digest('hex');
}

function runCommand(command, args, cwd) {
  const child = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: child.status,
    output: `${child.stdout ?? ''}${child.stderr ?? ''}`.slice(-20_000),
  };
}

function grade(fixtureId, workspace) {
  const hiddenTarget = resolve(workspace, '.viberig-hidden.test.mjs');
  copyFileSync(resolve(fixturesRoot, fixtureId, 'hidden.test.mjs'), hiddenTarget);
  try {
    const result = runCommand(
      'node',
      ['--test', '--test-reporter=tap', basename(hiddenTarget)],
      workspace,
    );
    const tests = Number(result.output.match(/# tests (\d+)/)?.[1] ?? 0);
    const passed = Number(result.output.match(/# pass (\d+)/)?.[1] ?? 0);
    return {
      tests,
      passed,
      failed: Math.max(0, tests - passed),
      rate: tests ? passed / tests : 0,
      status: result.status,
      output: result.status === 0 ? '' : result.output,
    };
  }
  finally {
    rmSync(hiddenTarget, { force: true });
  }
}

function publicTests(workspace) {
  const result = runCommand('npm', ['test'], workspace);
  return { passed: result.status === 0, status: result.status, output: result.status === 0 ? '' : result.output };
}

function blockingFrom(run) {
  const value = run.answer.parsed;
  if (!value || typeof value !== 'object')
    return [];
  const accepted = Array.isArray(value.accepted)
    ? value.accepted.filter(item => String(item?.severity ?? '').toLowerCase() === 'blocking')
    : [];
  return accepted.length
    ? accepted
    : Array.isArray(value.blocking)
      ? value.blocking
      : [];
}

function acceptedForOwner(run, owner) {
  const accepted = run.answer.parsed?.accepted;
  return Array.isArray(accepted)
    ? accepted.filter(item => item?.owner === owner)
    : [];
}

function makeMetrics(variant, workspace, runs, wallMs, verification = null) {
  const usage = emptyUsage();
  let agentElapsedMs = 0;
  for (const run of runs) {
    addUsage(usage, run.usage);
    agentElapsedMs += run.elapsedMs;
  }
  const accuracy = grade(variant.fixtureId, workspace);
  const visibleTests = publicTests(workspace);
  return {
    variant: variant.id,
    fixtureId: variant.fixtureId,
    workspace,
    wallMs,
    agentElapsedMs,
    parallelismSavingsMs: Math.max(0, agentElapsedMs - wallMs),
    usage,
    accuracy,
    visibleTests,
    verifierPassed: verification?.answer.parsed?.passed ?? null,
    verifierRisks: verification?.answer.parsed?.risks ?? [],
    technicalPass: accuracy.status === 0
      && visibleTests.passed
      && verification?.answer.parsed?.passed !== false,
    sourceHash: sourceHash(workspace),
    runs,
  };
}

function reviewPrompt(role) {
  const focus = {
    reviewer: 'correctness, public contracts, simplicity, maintainability, and regressions',
    security: 'trust boundaries, validation, tenant isolation, mutation, atomicity, injection, and fail-open behavior',
    architect: 'unnecessary abstraction, missing boundaries, dependency direction, and specification drift',
    qa_reviewer: 'requirement-to-test traceability, empty and whitespace boundaries, null and wrong types, async failures, rollback, mutation, and valid unusual inputs',
  }[role];
  return `You are the independent ${role} in a software review.

Read REQUIREMENTS.md, production source, and tests. Do not modify files.
Inspect only ${focus}. A preference is not a defect. Reject advice that narrows behavior explicitly allowed by REQUIREMENTS.md.
Return only JSON: {"blocking": [{"finding":"...","evidence":"...","contract":"..."}],"nonBlocking":[]}.
Keep the entire response below 600 tokens.`;
}

function remediationPrompt(findings) {
  return `You are the MiMo implementer applying adjudicated blocking findings.

Read REQUIREMENTS.md, source, and tests. Fix only findings that are supported by the public contract.
Do not edit, delete, skip, or weaken tests. Do not add dependencies. Run npm test.
If a finding conflicts with REQUIREMENTS.md, leave code unchanged and explain it.

Blocking findings:
${JSON.stringify(findings, null, 2)}`;
}

function testGapPrompt(findings) {
  return `You are the MiMo test engineer closing adjudicated requirement-to-test gaps.

Read REQUIREMENTS.md, source, and existing tests. Add or tighten only public contract tests.
Do not modify src/, add dependencies, assert internal representation, or weaken existing tests.
Run npm test. A newly exposed production failure is useful evidence and must not be hidden.

Coverage gaps:
${JSON.stringify(findings, null, 2)}`;
}

function verificationPrompt() {
  return `You are an independent verifier with a clean decision boundary. Do not modify files.
Read REQUIREMENTS.md, source, and tests. Run npm test and inspect public contract behavior independently of prior claims.
Return only JSON: {"passed":true|false,"commands":[],"risks":[]}. A specification-narrowing change must fail.`;
}

async function prepareCommon(fixtureId) {
  const fixtureRoot = resolve(fixturesRoot, fixtureId);
  const base = resolve(outputDir, 'workspaces', fixtureId, 'base');
  mkdirSync(dirname(base), { recursive: true });
  cpSync(fixtureRoot, base, {
    recursive: true,
    filter: source => basename(source) !== 'hidden.test.mjs',
  });
  const requirements = readFileSync(resolve(base, 'REQUIREMENTS.md'), 'utf8');
  const implement = await runPi({
    fixtureId,
    variant: 'common',
    workspace: base,
    stage: 'implement',
    model: implementationModel,
    mutating: true,
    prompt: `You are the MiMo implementer for an evaluation project.

Read REQUIREMENTS.md and source. Implement the complete production behavior.
Do not create or modify tests. Do not add dependencies. Run existing project commands.

Requirements:
${requirements}`,
  });
  const devOnly = makeMetrics(
    { id: 'mimo_dev_only', fixtureId },
    base,
    [implement],
    implement.elapsedMs,
  );

  const common = resolve(outputDir, 'workspaces', fixtureId, 'dev-test');
  cpSync(base, common, { recursive: true });
  const beforeTestAuthor = sourceHash(common);
  const testAuthor = await runPi({
    fixtureId,
    variant: 'common',
    workspace: common,
    stage: 'test-author',
    model: implementationModel,
    mutating: true,
    prompt: `You are the MiMo test engineer.

Read REQUIREMENTS.md and production source. Add one concise Node test file under test/ with at most 10 risk-driven cases.
Test only public inputs, outputs, errors, and observable state. Do not modify src/, add dependencies, or assert internal storage representation.
Run npm test.`,
  });
  if (sourceHash(common) !== beforeTestAuthor)
    throw new Error('test author modified production source');
  const commonRuns = [implement, testAuthor];
  const testResult = publicTests(common);
  if (!testResult.passed) {
    commonRuns.push(await runPi({
      fixtureId,
      variant: 'common',
      workspace: common,
      stage: 'test-remediation',
      model: implementationModel,
      mutating: true,
      prompt: `${remediationPrompt([{ finding: 'Authored public tests fail', evidence: testResult.output }])}`,
    }));
  }
  return { base, common, commonRuns, devOnly };
}

async function runSequential(fixtureId, common, commonRuns) {
  const workspace = resolve(outputDir, 'workspaces', fixtureId, 'sequential');
  cpSync(common, workspace, { recursive: true });
  const runs = [...commonRuns];
  const started = performance.now();
  for (const role of ['reviewer', 'security', 'qa_reviewer', 'architect']) {
    const review = await runPi({
      fixtureId,
      variant: 'sequential',
      workspace,
      stage: role,
      model: validationModel,
      prompt: reviewPrompt(role),
    });
    runs.push(review);
    const blocking = blockingFrom(review);
    if (role === 'qa_reviewer' && blocking.length) {
      const beforeTestGap = sourceHash(workspace);
      runs.push(await runPi({
        fixtureId,
        variant: 'sequential',
        workspace,
        stage: `${role}-remediation`,
        model: implementationModel,
        mutating: true,
        prompt: testGapPrompt(blocking),
      }));
      if (sourceHash(workspace) !== beforeTestGap)
        throw new Error('sequential test-gap remediation modified production source');
      const visibleAfterTestGap = publicTests(workspace);
      if (!visibleAfterTestGap.passed) {
        runs.push(await runPi({
          fixtureId,
          variant: 'sequential',
          workspace,
          stage: `${role}-production-remediation`,
          model: implementationModel,
          mutating: true,
          prompt: remediationPrompt([{
            finding: 'New requirement-driven public tests fail',
            evidence: visibleAfterTestGap.output,
          }]),
        }));
      }
    }
    else if (blocking.length) {
      runs.push(await runPi({
        fixtureId,
        variant: 'sequential',
        workspace,
        stage: `${role}-remediation`,
        model: implementationModel,
        mutating: true,
        prompt: remediationPrompt(blocking),
      }));
    }
  }
  let verification = await runPi({
    fixtureId,
    variant: 'sequential',
    workspace,
    stage: 'verify',
    model: validationModel,
    bash: true,
    prompt: verificationPrompt(),
  });
  runs.push(verification);
  if (verification.answer.parsed?.passed === false) {
    runs.push(await runPi({
      fixtureId,
      variant: 'sequential',
      workspace,
      stage: 'verify-remediation',
      model: implementationModel,
      mutating: true,
      prompt: remediationPrompt(verification.answer.parsed?.risks ?? []),
    }));
    verification = await runPi({
      fixtureId,
      variant: 'sequential',
      workspace,
      stage: 'reverify',
      model: validationModel,
      bash: true,
      prompt: verificationPrompt(),
    });
    runs.push(verification);
  }
  const commonWall = commonRuns.reduce((sum, run) => sum + run.elapsedMs, 0);
  return makeMetrics(
    { id: 'sequential_strong_gates', fixtureId },
    workspace,
    runs,
    commonWall + Math.round(performance.now() - started),
    verification,
  );
}

async function runCouncil(fixtureId, common, commonRuns) {
  const workspace = resolve(outputDir, 'workspaces', fixtureId, 'council');
  cpSync(common, workspace, { recursive: true });
  const runs = [...commonRuns];
  const started = performance.now();
  const beforeCouncil = sourceHash(workspace);
  const advisorRoles = ['reviewer', 'security', 'qa_reviewer', 'architect'];
  const advisors = await Promise.all(advisorRoles.map(role => runPi({
    fixtureId,
    variant: 'council',
    workspace,
    stage: role,
    model: validationModel,
    prompt: reviewPrompt(role),
  })));
  if (sourceHash(workspace) !== beforeCouncil)
    throw new Error('read-only council modified production source');
  runs.push(...advisors);
  const aggregate = await runPi({
    fixtureId,
    variant: 'council',
    workspace,
    stage: 'aggregate',
    model: validationModel,
    prompt: `You are the strong read-only council aggregator.

Read REQUIREMENTS.md and source only when needed to check evidence. Do not modify files.
Deduplicate and challenge the labelled advisor findings below. Reject speculative, style-only, or specification-narrowing advice.
Return only JSON:
{"accepted":[{"severity":"blocking|notable","owner":"implementer|test_engineer","finding":"...","evidence":"..."}],"rejected":[],"blocking":[],"residualRisks":[]}.
Route missing or weak public-contract tests to test_engineer. Route supported production defects to implementer.

${JSON.stringify(advisors.map((run, index) => ({
  role: advisorRoles[index],
  findings: run.answer.parsed ?? run.answer.raw,
})), null, 2)}`,
  });
  runs.push(aggregate);
  const testGaps = acceptedForOwner(aggregate, 'test_engineer');
  if (testGaps.length) {
    const beforeTestGap = sourceHash(workspace);
    runs.push(await runPi({
      fixtureId,
      variant: 'council',
      workspace,
      stage: 'test-gap-remediation',
      model: implementationModel,
      mutating: true,
      prompt: testGapPrompt(testGaps),
    }));
    if (sourceHash(workspace) !== beforeTestGap)
      throw new Error('test-gap remediation modified production source');
  }
  const blocking = acceptedForOwner(aggregate, 'implementer');
  const visibleAfterCouncil = publicTests(workspace);
  if (blocking.length || !visibleAfterCouncil.passed) {
    const remediationFindings = [
      ...blocking,
      ...(!visibleAfterCouncil.passed
        ? [{ finding: 'Adjudicated public contract tests fail', evidence: visibleAfterCouncil.output }]
        : []),
    ];
    runs.push(await runPi({
      fixtureId,
      variant: 'council',
      workspace,
      stage: 'remediation',
      model: implementationModel,
      mutating: true,
      prompt: remediationPrompt(remediationFindings),
    }));
  }
  let verification = await runPi({
    fixtureId,
    variant: 'council',
    workspace,
    stage: 'verify',
    model: validationModel,
    bash: true,
    prompt: verificationPrompt(),
  });
  runs.push(verification);
  if (verification.answer.parsed?.passed === false) {
    runs.push(await runPi({
      fixtureId,
      variant: 'council',
      workspace,
      stage: 'verify-remediation',
      model: implementationModel,
      mutating: true,
      prompt: remediationPrompt(verification.answer.parsed?.risks ?? []),
    }));
    verification = await runPi({
      fixtureId,
      variant: 'council',
      workspace,
      stage: 'reverify',
      model: validationModel,
      bash: true,
      prompt: verificationPrompt(),
    });
    runs.push(verification);
  }
  const commonWall = commonRuns.reduce((sum, run) => sum + run.elapsedMs, 0);
  return makeMetrics(
    { id: 'role_isolated_council', fixtureId },
    workspace,
    runs,
    commonWall + Math.round(performance.now() - started),
    verification,
  );
}

function summarize(results, variant) {
  const rows = results.filter(result => result.variant === variant);
  const tests = rows.reduce((sum, row) => sum + row.accuracy.tests, 0);
  const passed = rows.reduce((sum, row) => sum + row.accuracy.passed, 0);
  return {
    fixtures: rows.length,
    accuracy: { passed, tests, rate: tests ? passed / tests : 0 },
    technicalPasses: rows.filter(row => row.technicalPass).length,
    wallMs: rows.reduce((sum, row) => sum + row.wallMs, 0),
    agentElapsedMs: rows.reduce((sum, row) => sum + row.agentElapsedMs, 0),
    effectiveTokens: rows.reduce((sum, row) => sum + row.usage.effectiveTokens, 0),
    inputTokens: rows.reduce((sum, row) => sum + row.usage.input, 0),
    outputTokens: rows.reduce((sum, row) => sum + row.usage.output, 0),
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  branch: 'codex/pi-company-plane',
  dryRun,
  priority: ['accuracy', 'wallMs', 'effectiveTokens'],
  implementationModel,
  validationModel,
  fixtureIds,
  variants: ['mimo_dev_only', 'sequential_strong_gates', 'role_isolated_council'],
  results: [],
};

for (const fixtureId of fixtureIds) {
  const common = await prepareCommon(fixtureId);
  report.results.push(common.devOnly);
  report.results.push(await runSequential(fixtureId, common.common, common.commonRuns));
  report.results.push(await runCouncil(fixtureId, common.common, common.commonRuns));
  writeFileSync(resolve(outputDir, 'report.partial.json'), `${JSON.stringify(report, null, 2)}\n`);
}

report.summary = Object.fromEntries(report.variants.map(variant => [
  variant,
  summarize(report.results, variant),
]));
const reportPath = reportTarget ? resolve(root, reportTarget) : resolve(outputDir, 'report.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, traceDir: outputDir, summary: report.summary }, null, 2));
