import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
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
import { delimiter, dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = resolve(root, 'evals/backend-e2e-live/fixture');
const oracleRoot = resolve(root, 'evals/backend-e2e-live/oracle');
const outputDir = mkdtempSync('/tmp/viberig-backend-e2e-live-');
const selectedModels = (valueAfter('--models') || valueAfter('--model') || 'gpt-5.6-sol').split(',').filter(Boolean);
const selectedVariant = valueAfter('--variant');
const repeat = Number(valueAfter('--repeat') || 1);
const concurrency = Number(valueAfter('--concurrency') || 1);
const effort = valueAfter('--effort') || 'low';
const transport = valueAfter('--transport') || 'mcp';
const replayReportPath = valueAfter('--replay-report');
const baselineRef = valueAfter('--baseline-ref') || 'origin/main';
const detectedGoRoot = discoverGoRoot();
const goBinary = resolve(detectedGoRoot, 'bin/go');
const gofmtBinary = resolve(detectedGoRoot, 'bin/gofmt');
const goCache = resolve(outputDir, 'go-cache');
const goTemp = resolve(outputDir, 'go-tmp');
mkdirSync(goCache, { recursive: true });
mkdirSync(goTemp, { recursive: true });
const benchmarkEnv = {
  ...process.env,
  GOCACHE: goCache,
  GOENV: 'off',
  GOROOT: detectedGoRoot,
  GOTMPDIR: goTemp,
  PATH: `${resolve(detectedGoRoot, 'bin')}${delimiter}${process.env.PATH || ''}`,
};
let portCursor = 24000 + Math.floor(Math.random() * 10000);

const variants = selectedVariant ? [selectedVariant] : ['baseline', 'candidate'];
const skillFiles = {
  baseline: [
    'skills/pre-development/SKILL.md',
    'skills/test-driven-development/SKILL.md',
    'skills/execute/SKILL.md',
  ],
  candidate: [
    'skills/pre-development/SKILL.md',
    'skills/test-driven-development/SKILL.md',
    'skills/execute/SKILL.md',
    'skills/execute/references/e2e-test-contract.md',
    'skills/pre-development/assets/e2e-contract.schema.json',
  ],
};

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function discoverGoRoot() {
  const configured = process.env.VIBERIG_BENCH_GO;
  const current = execFileSync('go', ['env', 'GOROOT'], { encoding: 'utf8' }).trim();
  const candidates = [];
  if (configured)
    candidates.push(configured.endsWith('/bin/go') ? dirname(dirname(configured)) : configured);
  candidates.push(current);
  const siblingsRoot = dirname(current);
  if (existsSync(siblingsRoot)) {
    const siblings = readdirSync(siblingsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(resolve(siblingsRoot, entry.name, 'bin/go')))
      .map(entry => resolve(siblingsRoot, entry.name))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    candidates.push(...siblings);
  }
  candidates.push('/usr/local/go');

  const probeCache = resolve(outputDir, 'go-probe-cache');
  const probeTemp = resolve(outputDir, 'go-probe-tmp');
  const probeSource = resolve(outputDir, 'go-probe-source');
  mkdirSync(probeCache, { recursive: true });
  mkdirSync(probeTemp, { recursive: true });
  mkdirSync(probeSource, { recursive: true });
  writeFileSync(resolve(probeSource, 'go.mod'), 'module example.com/viberig/toolchainprobe\n\ngo 1.22\n');
  writeFileSync(resolve(probeSource, 'probe_test.go'), 'package toolchainprobe\n\nimport (\n  "net/http"\n  "testing"\n)\n\nfunc TestToolchain(t *testing.T) {\n  if http.MethodGet == "" { t.Fatal("invalid stdlib") }\n}\n');
  for (const candidate of [...new Set(candidates)]) {
    const binary = resolve(candidate, 'bin/go');
    if (!existsSync(binary))
      continue;
    const probe = spawnSync(binary, ['test', './...', '-count=1'], {
      cwd: probeSource,
      encoding: 'utf8',
      env: {
        ...process.env,
        GOCACHE: probeCache,
        GOENV: 'off',
        GOROOT: candidate,
        GOTMPDIR: probeTemp,
        PATH: `${resolve(candidate, 'bin')}${delimiter}${process.env.PATH || ''}`,
      },
    });
    if (probe.status === 0)
      return candidate;
  }
  throw new Error('No self-consistent Go toolchain is available for the live backend E2E benchmark');
}

function loadSkill(path, variant) {
  if (variant === 'baseline')
    return execFileSync('git', ['show', `${baselineRef}:${path}`], { cwd: root, encoding: 'utf8' });
  return readFileSync(resolve(root, path), 'utf8');
}

function buildPrompt(variant) {
  const skills = skillFiles[variant]
    .map(path => `<skill path="${path}">\n${loadSkill(path, variant)}\n</skill>`)
    .join('\n\n');
  return `你是这个仓库的后端 E2E test engineer。需求已经确认，授权仅包括编写和验证测试，不包括修改生产实现。

目标：检查仓库中的 AGENTS.md、README、docs/requirement.md、api/openapi.yaml、Makefile 和现有代码，然后创建唯一交付物 e2e/invitations_test.go。

要求：
- 写真实可运行的 Go 黑盒 E2E 测试，不要只返回方案、伪代码或 Markdown。
- 通过真实 HTTP 服务边界验证已确认 AC，不得 import internal/invites。
- 使用仓库声明的本地命令和测试状态边界。
- 生产行为可能尚未完整；环境健康后的业务断言失败是预期 RED。不得为了 GREEN 跳过、弱化测试或修改 cmd/internal/api/docs/Makefile/go.mod。
- 不增加依赖。完成后运行相关格式化、收集和 RED 验证，并在最终消息中简述证据。

只依据以下 Harness Skill 执行，不要评价 baseline/candidate：

${skills}`;
}

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

function snapshotFiles(directory) {
  const files = new Map();
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      const name = relative(directory, path);
      if (name === '.tmp' || name.startsWith('.tmp/'))
        continue;
      if (entry.isDirectory())
        walk(path);
      else if (entry.isFile())
        files.set(name, digest(readFileSync(path)));
    }
  }
  walk(directory);
  return files;
}

function changedFiles(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter(path => before.get(path) !== after.get(path)).sort();
}

function parseUsage(stdout) {
  try {
    const events = stdout.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    return events.findLast(event => event.type === 'turn.completed')?.usage || null;
  }
  catch {
    return null;
  }
}

function runCodexExec(job, authorDir, finalMessagePath) {
  return new Promise((resolveRun) => {
    const child = spawn('codex', [
      'exec',
      '--ephemeral',
      '--ignore-user-config',
      '--sandbox',
      'workspace-write',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--json',
      '-m',
      job.model,
      '-c',
      `model_reasoning_effort="${effort}"`,
      '--output-last-message',
      finalMessagePath,
      '-',
    ], { cwd: authorDir, env: benchmarkEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 240_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status) => {
      clearTimeout(timeout);
      resolveRun({
        status,
        timedOut,
        stdout,
        stderr,
        usage: parseUsage(stdout),
        finalMessage: existsSync(finalMessagePath) ? readFileSync(finalMessagePath, 'utf8') : null,
      });
    });
    child.stdin.end(buildPrompt(job.variant));
  });
}

function runCodexMcp(job, authorDir) {
  return new Promise((resolveRun) => {
    const child = spawn('codex', ['mcp-server'], {
      cwd: root,
      env: benchmarkEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let buffer = '';
    let settled = false;
    let initialized = false;
    let toolRequested = false;
    let mcpServerInfo = null;
    const notificationCounts = {};
    const timeout = setTimeout(() => finish({
      status: child.exitCode,
      timedOut: true,
      stdout: null,
      stdoutBytes: Buffer.byteLength(stdout),
      stderr,
      usage: null,
      threadId: null,
      finalMessage: null,
      mcpError: 'Codex MCP call timed out after 240000ms',
      mcpServerInfo,
      notificationCounts,
    }), 240_000);

    function send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }

    function stopChild() {
      if (child.exitCode === null)
        child.kill('SIGTERM');
    }

    function finish(result) {
      if (settled)
        return;
      settled = true;
      clearTimeout(timeout);
      stopChild();
      resolveRun(result);
    }

    function fail(message, detail = null) {
      finish({
        status: child.exitCode,
        timedOut: false,
        stdout: null,
        stdoutBytes: Buffer.byteLength(stdout),
        stderr,
        usage: null,
        threadId: null,
        finalMessage: null,
        mcpError: detail ? `${message}: ${JSON.stringify(detail)}` : message,
        mcpServerInfo,
        notificationCounts,
      });
    }

    function handleMessage(message) {
      if (message.id === 1) {
        if (message.error) {
          fail('Codex MCP initialize failed', message.error);
          return;
        }
        mcpServerInfo = message.result?.serverInfo || null;
        initialized = true;
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'codex',
            arguments: {
              'prompt': buildPrompt(job.variant),
              'model': job.model,
              'cwd': authorDir,
              'sandbox': 'workspace-write',
              'approval-policy': 'never',
              'config': {
                model_reasoning_effort: effort,
              },
            },
          },
        });
        toolRequested = true;
        return;
      }
      if (message.id === 2) {
        if (message.error) {
          fail('Codex MCP tool call failed', message.error);
          return;
        }
        const result = message.result || {};
        const structured = result.structuredContent || {};
        const fallbackText = result.content?.find(item => item.type === 'text')?.text || null;
        finish({
          status: result.isError ? 1 : 0,
          timedOut: false,
          stdout: null,
          stdoutBytes: Buffer.byteLength(stdout),
          stderr,
          usage: null,
          threadId: structured.threadId || null,
          finalMessage: structured.content || fallbackText,
          mcpError: result.isError ? (structured.content || fallbackText || 'Codex MCP tool returned isError') : null,
          mcpServerInfo,
          notificationCounts,
        });
        return;
      }
      if (message.id !== undefined && message.method) {
        send({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Unsupported client method: ${message.method}` },
        });
        return;
      }
      if (message.method)
        notificationCounts[message.method] = (notificationCounts[message.method] || 0) + 1;
    }

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      buffer += text;
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline === -1)
          break;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line)
          continue;
        try {
          handleMessage(JSON.parse(line));
        }
        catch (error) {
          fail(`Invalid Codex MCP JSON response: ${error.message}`, line);
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', error => fail(`Unable to start Codex MCP server: ${error.message}`));
    child.on('close', (status) => {
      if (!settled) {
        fail(`Codex MCP server exited before completing the call (status ${status}, initialized=${initialized}, toolRequested=${toolRequested})`);
      }
    });
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'viberig-backend-e2e-live-ab', version: '1.0.0' },
      },
    });
  });
}

function runCodex(job, authorDir, finalMessagePath) {
  if (transport === 'exec')
    return runCodexExec(job, authorDir, finalMessagePath);
  if (transport === 'mcp')
    return runCodexMcp(job, authorDir);
  throw new Error(`unknown Codex transport: ${transport}`);
}

function goRun(args, cwd, options = {}) {
  return spawnSync(goBinary, args, {
    cwd,
    encoding: 'utf8',
    timeout: options.timeout || 30_000,
    env: { ...benchmarkEnv, ...options.env },
  });
}

async function waitForHealth(port, server) {
  const deadline = Date.now() + 8_000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`server exited before health with status ${server.exitCode}`);
    try {
      if (await healthRequest(port))
        return;
    }
    catch (error) {
      lastError = error;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 80));
  }
  throw new Error(`health timeout: ${lastError || 'not ready'}`);
}

function healthRequest(port) {
  return new Promise((resolveHealth, rejectHealth) => {
    const child = spawn('curl', [
      '--silent',
      '--show-error',
      '--fail',
      '--noproxy',
      '*',
      '--max-time',
      '0.5',
      `http://127.0.0.1:${port}/health`,
    ], {
      env: benchmarkEnv,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', rejectHealth);
    child.on('close', status => status === 0
      ? resolveHealth(true)
      : rejectHealth(new Error(stderr.trim() || `curl health probe exited ${status}`)));
  });
}

async function stopServer(server) {
  if (server.exitCode !== null)
    return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise(resolveExit => server.once('exit', resolveExit)),
    new Promise(resolveDelay => setTimeout(resolveDelay, 800)),
  ]);
  if (server.exitCode === null)
    server.kill('SIGKILL');
}

async function runMutation(evaluationDir, mutation, port) {
  copyFileSync(resolve(oracleRoot, mutation.file), resolve(evaluationDir, 'internal/invites/behavior.go'));
  const benchmarkDir = resolve(evaluationDir, '.benchmark');
  mkdirSync(benchmarkDir, { recursive: true });
  const binary = resolve(benchmarkDir, `server-${mutation.id}`);
  const statePath = resolve(benchmarkDir, `state-${mutation.id}.json`);
  rmSync(statePath, { force: true });
  const build = goRun(['build', '-o', binary, './cmd/server'], evaluationDir);
  if (build.status !== 0) {
    return { id: mutation.id, buildStatus: build.status, buildOutput: build.stderr || build.stdout, healthy: false, testStatus: null, testOutput: null };
  }

  const server = spawn(binary, [], {
    cwd: evaluationDir,
    env: { ...benchmarkEnv, PORT: String(port), DATA_PATH: statePath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', chunk => serverOutput += chunk);
  server.stderr.on('data', chunk => serverOutput += chunk);
  try {
    await waitForHealth(port, server);
    const test = goRun(['test', './e2e', '-count=1'], evaluationDir, {
      timeout: 20_000,
      env: { BASE_URL: `http://127.0.0.1:${port}` },
    });
    return {
      id: mutation.id,
      buildStatus: build.status,
      healthy: true,
      testStatus: test.status,
      testOutput: `${test.stdout || ''}${test.stderr || ''}`,
      serverOutput,
    };
  }
  catch (error) {
    return { id: mutation.id, buildStatus: build.status, healthy: false, testStatus: null, testOutput: String(error), serverOutput };
  }
  finally {
    await stopServer(server);
  }
}

function scoreEvaluation(evaluation) {
  const checks = [];
  const add = (id, pass, weight) => checks.push({ id, pass, weight });
  add('test-artifact-exists', evaluation.artifactExists, 2);
  add('authorized-scope-only', evaluation.scopeClean, 2);
  add('gofmt-clean', evaluation.formatted, 1);
  add('test-compiles-and-collects', evaluation.compiles, 3);
  for (const id of ['missing_mail', 'auth_bypass', 'missing_persistence', 'delayed_forbidden_side_effects']) {
    const mutation = evaluation.mutations.find(item => item.id === id);
    add(`business-red-${id}`, mutation?.healthy && mutation.testStatus !== 0, 4);
  }
  const reference = evaluation.mutations.find(item => item.id === 'reference');
  add('reference-green', reference?.healthy && reference.testStatus === 0, 6);
  add('test-unchanged-across-oracles', evaluation.testHashBefore === evaluation.testHashAfter && Boolean(evaluation.testHashBefore), 2);
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  return { earned, total, rate: earned / total, checks };
}

async function evaluateTest(authorDir, changedPaths) {
  const testPath = resolve(authorDir, 'e2e/invitations_test.go');
  const artifactExists = existsSync(testPath) && statSync(testPath).isFile();
  const scopeClean = changedPaths.every(path => path === 'e2e/invitations_test.go');
  if (!artifactExists) {
    const empty = {
      artifactExists,
      scopeClean,
      formatted: false,
      compiles: false,
      mutations: [],
      changedPaths,
      testHashBefore: null,
      testHashAfter: null,
    };
    return { ...empty, score: scoreEvaluation(empty) };
  }

  const evaluationDir = resolve(dirname(authorDir), 'evaluation');
  rmSync(evaluationDir, { recursive: true, force: true });
  cpSync(fixtureRoot, evaluationDir, { recursive: true });
  copyFileSync(testPath, resolve(evaluationDir, 'e2e/invitations_test.go'));
  const evaluationTestPath = resolve(evaluationDir, 'e2e/invitations_test.go');
  const testHashBefore = digest(readFileSync(evaluationTestPath));
  const format = spawnSync(gofmtBinary, ['-d', evaluationTestPath], { encoding: 'utf8' });
  const formatted = format.status === 0 && format.stdout === '';
  const compile = goRun(['test', './e2e', '-run', '^$', '-count=1'], evaluationDir);
  const compiles = compile.status === 0;
  const mutations = [];
  if (compiles) {
    for (const mutation of [
      { id: 'missing_mail', file: 'behavior-missing-mail.go.txt' },
      { id: 'auth_bypass', file: 'behavior-auth-bypass.go.txt' },
      { id: 'missing_persistence', file: 'behavior-missing-persistence.go.txt' },
      { id: 'delayed_forbidden_side_effects', file: 'behavior-delayed-forbidden-side-effects.go.txt' },
      { id: 'reference', file: 'behavior-reference.go.txt' },
    ]) {
      mutations.push(await runMutation(evaluationDir, mutation, portCursor++));
    }
  }
  const testHashAfter = digest(readFileSync(evaluationTestPath));
  const evaluation = {
    artifactExists,
    scopeClean,
    formatted,
    formatDiff: format.stdout || format.stderr,
    compiles,
    compileOutput: `${compile.stdout || ''}${compile.stderr || ''}`,
    mutations,
    changedPaths,
    testHashBefore,
    testHashAfter,
  };
  return { ...evaluation, score: scoreEvaluation(evaluation) };
}

async function runJob(job) {
  const jobDir = resolve(outputDir, `${job.model}-${job.variant}-${job.repeat}`.replaceAll('/', '_'));
  const authorDir = resolve(jobDir, 'author');
  mkdirSync(jobDir, { recursive: true });
  cpSync(fixtureRoot, authorDir, { recursive: true });
  const before = snapshotFiles(authorDir);
  const startedAt = performance.now();
  const codex = await runCodex(job, authorDir, resolve(jobDir, 'last-message.txt'));
  const durationMs = Math.round(performance.now() - startedAt);
  const after = snapshotFiles(authorDir);
  const changedPaths = changedFiles(before, after);
  const evaluation = await evaluateTest(authorDir, changedPaths);
  return { ...job, durationMs, codex, evaluation, score: evaluation.score, jobDir };
}

async function runPool(jobs) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const result = await runJob(job);
      results.push(result);
      process.stderr.write(`${job.model}/${job.variant}/${job.repeat} ${result.score.earned}/${result.score.total} ${result.durationMs}ms\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

async function replayResults(reportPath) {
  const source = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));
  const replayed = [];
  for (const result of source.results) {
    const authorDir = resolve(result.jobDir, 'author');
    const evaluation = await evaluateTest(authorDir, result.evaluation.changedPaths);
    const replayedResult = { ...result, evaluation, score: evaluation.score, replayedFrom: resolve(reportPath) };
    replayed.push(replayedResult);
    process.stderr.write(`${result.model}/${result.variant}/${result.repeat} ${evaluation.score.earned}/${evaluation.score.total} replay\n`);
  }
  return replayed;
}

async function selfTest() {
  const selfRoot = resolve(outputDir, 'self-test');
  const strongDir = resolve(selfRoot, 'strong/author');
  mkdirSync(dirname(strongDir), { recursive: true });
  cpSync(fixtureRoot, strongDir, { recursive: true });
  copyFileSync(resolve(oracleRoot, 'reference_invitations_test.go.txt'), resolve(strongDir, 'e2e/invitations_test.go'));
  const strong = await evaluateTest(strongDir, ['e2e/invitations_test.go']);

  const weakDir = resolve(selfRoot, 'weak/author');
  mkdirSync(dirname(weakDir), { recursive: true });
  cpSync(fixtureRoot, weakDir, { recursive: true });
  copyFileSync(resolve(oracleRoot, 'weak_invitations_test.go.txt'), resolve(weakDir, 'e2e/invitations_test.go'));
  const weak = await evaluateTest(weakDir, ['e2e/invitations_test.go']);
  const selfTestReport = { outputDir, strong, weak };
  writeFileSync(resolve(outputDir, 'self-test-report.json'), `${JSON.stringify(selfTestReport, null, 2)}\n`);
  assert.equal(strong.score.earned, strong.score.total, JSON.stringify(strong, null, 2));
  assert.ok(weak.score.earned < strong.score.earned, JSON.stringify(weak, null, 2));
  assert.equal(weak.mutations.find(item => item.id === 'reference')?.testStatus, 0);
  console.log(JSON.stringify({ outputDir, strong: strong.score, weak: weak.score }, null, 2));
}

if (process.argv.includes('--self-test')) {
  await selfTest();
  process.exit(0);
}

for (const variant of variants) {
  if (!skillFiles[variant])
    throw new Error(`unknown variant: ${variant}`);
}

const jobs = selectedModels.flatMap(model => variants.flatMap(variant =>
  Array.from({ length: repeat }, (_, index) => ({ model, variant, repeat: index + 1 })),
));
const results = replayReportPath ? await replayResults(replayReportPath) : await runPool(jobs);

function aggregate(model, variant) {
  const matching = results.filter(result => result.model === model && result.variant === variant);
  return {
    runs: matching.length,
    earned: matching.reduce((sum, result) => sum + result.score.earned, 0),
    total: matching.reduce((sum, result) => sum + result.score.total, 0),
    durationMs: matching.reduce((sum, result) => sum + result.durationMs, 0),
    usage: matching.reduce((sum, result) => {
      for (const key of Object.keys(sum))
        sum[key] += result.codex.usage?.[key] || 0;
      return sum;
    }, { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 }),
  };
}

const summary = selectedModels.map(model => ({
  model,
  effort,
  baseline: aggregate(model, 'baseline'),
  candidate: aggregate(model, 'candidate'),
}));
const report = {
  generatedAt: new Date().toISOString(),
  runner: `${transport === 'mcp' ? 'codex mcp-server' : 'codex exec'} + generated Go test + live HTTP mutation oracle`,
  transport,
  replayedFrom: replayReportPath ? resolve(replayReportPath) : null,
  baselineRef,
  fixture: 'evals/backend-e2e-live/fixture',
  oracle: ['missing_mail', 'auth_bypass', 'missing_persistence', 'delayed_forbidden_side_effects', 'reference'],
  outputDir,
  summary,
  results,
};
const reportPath = resolve(outputDir, 'report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, summary }, null, 2));
