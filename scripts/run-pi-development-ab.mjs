import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
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
const evalRoot = resolve(root, 'evals/pi-development-ab');
const matrix = JSON.parse(readFileSync(resolve(evalRoot, 'model-matrix.json'), 'utf8'));
const fixturesRoot = resolve(evalRoot, 'fixtures');
const outputDir = mkdtempSync(resolve(tmpdir(), 'viberig-pi-development-ab-'));
const dryRun = process.argv.includes('--dry-run');
const onlyFixture = valueAfter('--fixture');
const selectedModels = new Set((valueAfter('--models') || '').split(',').filter(Boolean));

const fixtureIds = readdirSync(fixturesRoot)
  .filter(name => statSync(resolve(fixturesRoot, name)).isDirectory())
  .filter(name => !onlyFixture || name === onlyFixture);
const models = matrix.filter(item => selectedModels.size === 0 || selectedModels.has(item.id));

if (fixtureIds.length === 0)
  throw new Error(`No fixture matched: ${onlyFixture ?? '(all)'}`);
if (models.length === 0)
  throw new Error(`No model matched: ${[...selectedModels].join(', ')}`);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function parseRelevantJsonLines(stdout) {
  const relevantTypes = [
    'message_end',
    'tool_execution_start',
    'tool_execution_end',
    'agent_end',
  ];
  return stdout
    .split(/\r?\n/)
    .filter(line => relevantTypes.some(type => line.includes(`"type":"${type}"`)))
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
  if (!message || message.role !== 'assistant' || !Array.isArray(message.content))
    return '';
  return message.content
    .filter(item => item?.type === 'text')
    .map(item => item.text)
    .join('');
}

function extractAnswer(events) {
  const raw = events
    .filter(event => event.type === 'message_end' && event.message?.role === 'assistant')
    .map(event => textFromMessage(event.message))
    .filter(Boolean)
    .at(-1) ?? '';
  const cleaned = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  const fenceStart = raw.toLowerCase().indexOf('```json');
  const fenceEnd = fenceStart === -1 ? -1 : raw.indexOf('```', fenceStart + 7);
  const fenced = fenceStart === -1 || fenceEnd === -1
    ? null
    : raw.slice(fenceStart + 7, fenceEnd).trim();
  const objectSlice = raw.includes('{') && raw.includes('}')
    ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    : null;
  for (const candidate of [cleaned, fenced, objectSlice]) {
    if (!candidate)
      continue;
    try {
      return { raw, parsed: JSON.parse(candidate) };
    }
    catch {
      // Try the next candidate.
    }
  }
  return { raw, parsed: null };
}

function usageFromEvents(events) {
  const usage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    effectiveTokens: 0,
  };
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

function runPi({ model, fixtureId, workspace, stage, prompt, mutating }) {
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
    mutating ? 'read,grep,find,ls,bash,edit,write' : 'read,grep,find,ls,bash',
    prompt,
  ];
  const tracePath = resolve(outputDir, `${model.id}.${fixtureId}.${stage}.jsonl`);
  if (dryRun) {
    writeFileSync(tracePath, `${JSON.stringify({ command: ['pi', ...args], prompt }, null, 2)}\n`);
    return {
      stage,
      status: 'dry-run',
      elapsedMs: 0,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, effectiveTokens: 0 },
      answer: { raw: '', parsed: null },
      tracePath,
    };
  }

  const started = performance.now();
  const stderrPath = `${tracePath}.stderr`;
  const stdoutFd = openSync(tracePath, 'w');
  const stderrFd = openSync(stderrPath, 'w');
  const result = spawnSync('pi', args, {
    cwd: workspace,
    env: { ...process.env, PI_OFFLINE: '1' },
    timeout: 900_000,
    stdio: ['ignore', stdoutFd, stderrFd],
  });
  closeSync(stdoutFd);
  closeSync(stderrFd);
  const elapsedMs = Math.round(performance.now() - started);
  const stdout = readFileSync(tracePath, 'utf8');
  const stderr = readFileSync(stderrPath, 'utf8');
  rmSync(stderrPath, { force: true });
  const events = parseRelevantJsonLines(stdout);
  if (result.status !== 0) {
    writeFileSync(tracePath, events.map(event => JSON.stringify(event)).join('\n'));
    const diagnostic = stderr.trim()
      || `pi exited with status ${result.status ?? 'null'}${result.signal ? ` signal ${result.signal}` : ''}`;
    return {
      stage,
      status: 'failed',
      elapsedMs,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, effectiveTokens: 0 },
      answer: { raw: '', parsed: null },
      tracePath,
      error: diagnostic.slice(-8000),
      exitStatus: result.status,
      signal: result.signal,
    };
  }
  const answer = extractAnswer(events);
  const usage = usageFromEvents(events);
  writeFileSync(tracePath, `${JSON.stringify({
    stage,
    answer,
    usage,
    tools: events
      .filter(event => event.type === 'tool_execution_start')
      .map(event => event.toolName),
  }, null, 2)}\n`);
  return {
    stage,
    status: 'passed',
    elapsedMs,
    usage,
    answer,
    tracePath,
    stderr: stderr.trim(),
  };
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory())
      files.push(...listFiles(path));
    else
      files.push(path);
  }
  return files;
}

function sourceHash(workspace) {
  const sourceRoot = resolve(workspace, 'src');
  const hash = createHash('sha256');
  if (!existsSync(sourceRoot))
    return hash.digest('hex');
  for (const path of listFiles(sourceRoot).sort()) {
    hash.update(relative(sourceRoot, path));
    hash.update(readFileSync(path));
  }
  return hash.digest('hex');
}

function runCommand(command, args, cwd) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: result.status,
    elapsedMs: Math.round(performance.now() - started),
    output: `${result.stdout || ''}${result.stderr || ''}`.slice(-20_000),
  };
}

function gradeFixture(fixtureId, workspace) {
  const hiddenSource = resolve(fixturesRoot, fixtureId, 'hidden.test.mjs');
  const hiddenTarget = resolve(workspace, '.viberig-hidden.test.mjs');
  copyFileSync(hiddenSource, hiddenTarget);
  try {
    const result = runCommand(
      'node',
      ['--test', '--test-reporter=tap', basename(hiddenTarget)],
      workspace,
    );
    const tests = Number(result.output.match(/# tests (\d+)/)?.[1] ?? 0);
    const passed = Number(result.output.match(/# pass (\d+)/)?.[1] ?? 0);
    const failed = Number(result.output.match(/# fail (\d+)/)?.[1] ?? Math.max(0, tests - passed));
    return {
      tests,
      passed,
      failed,
      rate: tests ? passed / tests : 0,
      status: result.status,
      elapsedMs: result.elapsedMs,
      output: failed ? result.output : '',
    };
  }
  finally {
    rmSync(hiddenTarget, { force: true });
  }
}

function publicTests(workspace) {
  return runCommand('npm', ['test'], workspace);
}

function addUsage(target, run) {
  target.elapsedMs += run.elapsedMs ?? 0;
  for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'effectiveTokens'])
    target.usage[key] += run.usage?.[key] ?? 0;
}

function findingsFrom(run) {
  const parsed = run.answer.parsed;
  if (parsed && typeof parsed === 'object') {
    const findings = [
      ...(Array.isArray(parsed.blocking) ? parsed.blocking : []),
      ...(Array.isArray(parsed.nonBlocking) ? parsed.nonBlocking : []),
      ...(Array.isArray(parsed.findings) ? parsed.findings : []),
    ].map(String).filter(Boolean);
    if (findings.length)
      return findings;
  }
  return run.answer.raw.trim() ? [run.answer.raw.trim()] : [];
}

function checkpoint(name, cumulative, fixtureId, workspace, integrity, verification = null) {
  const accuracy = gradeFixture(fixtureId, workspace);
  const visibleTests = publicTests(workspace);
  const verifierPassed = verification?.answer.parsed?.passed;
  return {
    name,
    elapsedMs: cumulative.elapsedMs,
    usage: structuredClone(cumulative.usage),
    accuracy,
    visibleTests: {
      passed: visibleTests.status === 0,
      status: visibleTests.status,
      elapsedMs: visibleTests.elapsedMs,
      output: visibleTests.status === 0 ? '' : visibleTests.output,
    },
    technicalPass: accuracy.status === 0
      && visibleTests.status === 0
      && verifierPassed !== false,
    verification: verification
      ? {
          passed: verifierPassed ?? null,
          risks: Array.isArray(verification.answer.parsed?.risks)
            ? verification.answer.parsed.risks
            : [],
        }
      : null,
    sourceHash: sourceHash(workspace),
    integrity: structuredClone(integrity),
  };
}

function runPipeline(model, fixtureId) {
  const fixtureRoot = resolve(fixturesRoot, fixtureId);
  const workspace = resolve(outputDir, 'workspaces', model.id, fixtureId);
  mkdirSync(dirname(workspace), { recursive: true });
  cpSync(fixtureRoot, workspace, {
    recursive: true,
    filter: source => basename(source) !== 'hidden.test.mjs',
  });

  const cumulative = {
    elapsedMs: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, effectiveTokens: 0 },
  };
  const integrity = [];
  const runs = [];
  const checkpoints = [];
  const requirements = readFileSync(resolve(workspace, 'REQUIREMENTS.md'), 'utf8');

  const execute = (stage, prompt, mutating) => {
    process.stderr.write(`running ${model.id}/${fixtureId}/${stage}\n`);
    const run = runPi({ model, fixtureId, workspace, stage, prompt, mutating });
    runs.push(run);
    addUsage(cumulative, run);
    if (run.status === 'failed')
      throw new Error(run.error || `${stage} failed`);
    return run;
  };

  try {
    execute('implement', `You are the implementer for a temporary evaluation project.

Read REQUIREMENTS.md and the existing source. Implement the complete production behavior.
Do not create, edit, delete, skip, or weaken test files; this checkpoint measures development without a separate test/review/security/verify stage.
You may inspect and run existing project commands. Do not add dependencies. Work only inside the current directory.

Requirements:
${requirements}`, true);
    checkpoints.push(checkpoint('dev_only', cumulative, fixtureId, workspace, integrity));

    const beforeTestAuthor = sourceHash(workspace);
    execute('test-author', `You are the test engineer. Read REQUIREMENTS.md and production source.

Add risk-driven Node tests under test/ that verify public behavior and important edge cases.
Keep the suite concise: one file, at most 10 test cases, and at most 200 lines.
Test only inputs, outputs, errors, and externally observable state behavior; do not assert Map key formats or another internal storage representation.
Do not modify anything under src/. Do not weaken existing behavior or tests. Run npm test and report what the tests prove.
Work only inside the current directory.`, true);
    integrity.push({
      stage: 'test-author',
      productionChanged: sourceHash(workspace) !== beforeTestAuthor,
    });
    const authoredTestResult = publicTests(workspace);
    cumulative.elapsedMs += authoredTestResult.elapsedMs;
    execute('test-remediation', `You are the implementer responding to tests written by a separate test engineer.

Read REQUIREMENTS.md, production source, and all tests. Fix production code so the requirements and tests pass.
Do not edit, delete, skip, or weaken tests. Do not add dependencies. Run npm test before finishing.

Current public test result:
${authoredTestResult.output}`, true);
    checkpoints.push(checkpoint('dev_test', cumulative, fixtureId, workspace, integrity));

    const beforeReview = sourceHash(workspace);
    const review = execute('review', `You are an independent code reviewer.

Read REQUIREMENTS.md, production source, and tests. Do not modify any file.
Find concrete correctness, maintainability, error-semantics, and edge-case defects.
Return only JSON: {"blocking": ["..."], "nonBlocking": ["..."]}. Use empty arrays when there are no findings.`, false);
    integrity.push({
      stage: 'review',
      productionChanged: sourceHash(workspace) !== beforeReview,
    });
    const reviewFindings = findingsFrom(review);
    if (reviewFindings.length) {
      execute('review-remediation', `You are the implementer responding to independent review.

Read REQUIREMENTS.md, source, and tests. Fix every applicable finding in production code.
Do not edit, delete, skip, or weaken tests. Do not add dependencies. Run npm test.

Review findings:
${JSON.stringify(reviewFindings, null, 2)}`, true);
    }
    checkpoints.push(checkpoint('dev_test_review', cumulative, fixtureId, workspace, integrity));

    const beforeSecurity = sourceHash(workspace);
    const security = execute('security', `You are an independent security auditor.

Read REQUIREMENTS.md, production source, and tests. Do not modify any file.
Identify concrete validation, isolation, secret exposure, mutation, atomicity, injection, and fail-open risks relevant to this code.
Return only JSON: {"blocking": ["..."], "nonBlocking": ["..."]}. Do not invent external infrastructure requirements.`, false);
    integrity.push({
      stage: 'security',
      productionChanged: sourceHash(workspace) !== beforeSecurity,
    });
    const securityFindings = findingsFrom(security);
    if (securityFindings.length) {
      execute('security-remediation', `You are the implementer responding to an independent security audit.

Read REQUIREMENTS.md, source, and tests. Fix every applicable security finding in production code.
Do not edit, delete, skip, or weaken tests. Do not add dependencies. Run npm test.

Security findings:
${JSON.stringify(securityFindings, null, 2)}`, true);
    }
    checkpoints.push(checkpoint('dev_test_review_security', cumulative, fixtureId, workspace, integrity));

    const beforeVerify = sourceHash(workspace);
    const verification = execute('verify', `You are the independent verifier.

Do not modify any file. Read REQUIREMENTS.md, source, and tests. Run npm test and inspect the resulting behavior.
Return only JSON: {"passed": true|false, "commands": ["..."], "risks": ["..."]}.
Passing visible tests is technical evidence, not human acceptance.`, false);
    integrity.push({
      stage: 'verify',
      productionChanged: sourceHash(workspace) !== beforeVerify,
    });
    checkpoints.push(checkpoint(
      'full_verify',
      cumulative,
      fixtureId,
      workspace,
      integrity,
      verification,
    ));

    return {
      model: model.id,
      modelRef: model.model,
      thinking: model.thinking,
      fixtureId,
      status: 'passed',
      workspace,
      checkpoints,
      runs,
    };
  }
  catch (error) {
    return {
      model: model.id,
      modelRef: model.model,
      thinking: model.thinking,
      fixtureId,
      status: 'failed',
      workspace,
      checkpoints,
      runs,
      error: String(error),
    };
  }
}

function aggregate(report, modelId, checkpointName) {
  const matching = report.pipelines
    .filter(item => item.model === modelId)
    .map(item => item.checkpoints.find(checkpointItem => checkpointItem.name === checkpointName))
    .filter(Boolean);
  const tests = matching.reduce((sum, item) => sum + item.accuracy.tests, 0);
  const passed = matching.reduce((sum, item) => sum + item.accuracy.passed, 0);
  return {
    fixtures: matching.length,
    accuracy: { passed, tests, rate: tests ? passed / tests : 0 },
    visiblePasses: matching.filter(item => item.visibleTests.passed).length,
    technicalPasses: matching.filter(item => item.technicalPass).length,
    elapsedMs: matching.reduce((sum, item) => sum + item.elapsedMs, 0),
    effectiveTokens: matching.reduce((sum, item) => sum + item.usage.effectiveTokens, 0),
    freshInput: matching.reduce((sum, item) => sum + item.usage.input, 0),
    output: matching.reduce((sum, item) => sum + item.usage.output, 0),
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  outputDir,
  dryRun,
  priority: ['accuracy', 'elapsedMs', 'effectiveTokens'],
  models,
  fixtureIds,
  checkpoints: [
    'dev_only',
    'dev_test',
    'dev_test_review',
    'dev_test_review_security',
    'full_verify',
  ],
  pipelines: [],
};

for (const model of models) {
  for (const fixtureId of fixtureIds) {
    report.pipelines.push(runPipeline(model, fixtureId));
    writeFileSync(resolve(outputDir, 'report.partial.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
}

report.summary = Object.fromEntries(models.map(model => [
  model.id,
  Object.fromEntries(report.checkpoints.map(name => [name, aggregate(report, model.id, name)])),
]));

const reportPath = resolve(outputDir, 'report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, summary: report.summary }, null, 2));
