import { Buffer } from 'node:buffer';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parse as parseYaml } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = resolve(root, 'evals/agent-team-live/fixture');
const outputRoot = mkdtempSync('/tmp/viberig-agent-team-live-');
const baselineRef = valueAfter('--baseline-ref') || 'origin/main';
const variants = valueAfter('--variant') ? [valueAfter('--variant')] : ['baseline', 'candidate'];
const initModel = valueAfter('--init-model') || 'gpt-5.6-terra';
const repeat = Number(valueAfter('--repeat') || 1);
const mcpTimeoutMs = Number(valueAfter('--mcp-timeout-ms') || 900_000);
const nestedSandbox = process.argv.includes('--danger-full-access') ? 'danger-full-access' : 'workspace-write';
const oracleGoBinary = process.env.VIBERIG_BENCH_GO || (existsSync('/Users/jsonlee/.gvm/gos/go1.22.6/bin/go') ? '/Users/jsonlee/.gvm/gos/go1.22.6/bin/go' : 'go');
const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
const teamProfileValidator = ajv.compile(JSON.parse(readFileSync(resolve(root, 'skills/update-team/assets/team-profile.schema.json'), 'utf8')));
const modelRoutingValidator = ajv.compile(JSON.parse(readFileSync(resolve(root, 'skills/update-team/assets/model-routing-profile.schema.json'), 'utf8')));

const coreAgents = ['researcher', 'implementation', 'test_engineer', 'code_review', 'qa', 'security_auditor', 'integrator'];
const expectedConditional = ['backend_architect', 'backend_e2e_engineer', 'data_architect', 'reliability_engineer', 'architecture_red_team'];
const forbiddenConditional = ['frontend_architect', 'uiux_design'];
const expectedCodexModels = {
  architecture_red_team: 'gpt-5.6-sol',
  backend_architect: 'gpt-5.6-terra',
  backend_e2e_engineer: 'gpt-5.6-sol',
  code_review: 'gpt-5.6-terra',
  data_architect: 'gpt-5.6-terra',
  implementation: 'gpt-5.6-luna',
  integrator: 'gpt-5.6-terra',
  qa: 'gpt-5.6-terra',
  reliability_engineer: 'gpt-5.6-terra',
  researcher: 'gpt-5.6-luna',
  security_auditor: 'gpt-5.6-sol',
  test_engineer: 'gpt-5.6-luna',
};
const roleSnapshotPath = '.vibeRig/role-protected-snapshot.json';
const roleAllowedPaths = new Set(['e2e/invitations_test.go', 'review-result.json']);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function load(path, variant) {
  if (variant === 'baseline')
    return execFileSync('git', ['show', `${baselineRef}:${path}`], { cwd: root, encoding: 'utf8' });
  return readFileSync(resolve(root, path), 'utf8');
}

function maybeLoad(path, variant) {
  try {
    return load(path, variant);
  }
  catch {
    return null;
  }
}

function skillBundle(variant) {
  const files = [
    'skills/vb-init/SKILL.md',
    'skills/update-team/SKILL.md',
    'skills/built-in-agents/SKILL.md',
    'skills/built-in-agents/agents.manifest.json',
    'skills/built-in-agents/assets/backend_e2e_engineer.json',
    'skills/agent-creator/SKILL.md',
    'skills/subagent-routing/SKILL.md',
    'skills/subagent-routing/assets/model-capability-prior.json',
    'skills/update-team/references/team-composition.md',
    'skills/update-team/assets/team-profile.schema.json',
    'skills/update-team/assets/model-routing-profile.schema.json',
  ];
  return files.flatMap((path) => {
    const content = maybeLoad(path, variant);
    return content ? [`<artifact path="${path}">\n${content}\n</artifact>`] : [];
  }).join('\n\n');
}

function initPrompt(variant) {
  return `Use the supplied VibeRig skills to initialize only the Codex agent team for this repository. Work in the repository and inspect its real files. Do not modify production code.

Required deliverables:
- materialize the selected Codex agents as .codex/agents/<name>.toml;
- apply the manifest's fixed Codex model to every materialized Agent; do not leave Codex models inherited;
- write .vibeRig/team-profile.yaml with the selected core and evidence-activated conditional agents;
- write .vibeRig/model-routing.yaml with executable Codex routes split by capability and mode/task family;
- validate those files against skills/update-team/assets/team-profile.schema.json and model-routing-profile.schema.json; every route must have an explicit risk or risk band;
- do not create Claude or Cursor files in this benchmark;
- do not create speculative frontend or UI roles for a backend-only repository;
- validate the artifacts you create and report evidence.

Follow the ${variant} artifacts below as the only VibeRig policy. Do not compare variants or optimize for a hidden benchmark.

${skillBundle(variant)}`;
}

function rolePrompt(variant, role, roleConfig) {
  if (role === 'backend_e2e_engineer' || role === 'test_engineer') {
    const assetPath = role === 'backend_e2e_engineer'
      ? 'skills/built-in-agents/assets/backend_e2e_engineer.json'
      : 'skills/built-in-agents/assets/test_engineer.json';
    return `Act only as the configured ${role} below. Inspect the repository requirement, OpenAPI contract, production code, and existing test conventions. Create e2e/invitations_test.go as a real Go test that exposes the missing authorization behavior. Drive the checked-in internal/httpapi.Handler with httptest.NewRequest and httptest.NewRecorder; do not implement a replacement HTTP handler/router or open a listener socket in the test. Do not edit production files. Run go test ./... and preserve trustworthy RED evidence rather than weakening the assertion.\n\n<agent-config>\n${roleConfig}\n</agent-config>\n\n${maybeLoad(assetPath, variant) || ''}`;
  }
  return `Act only as the configured code_review agent below. Review internal/invitations/service.go against .vibeRig/requirements/invitations.md. Do not edit files. Write review-result.json with keys verdict and findings; each finding must include severity, file, line, impact, and remediation.\n\n<agent-config>\n${roleConfig}\n</agent-config>\n\n${maybeLoad('skills/built-in-agents/assets/code_review.json', variant) || ''}`;
}

function runMcp({ prompt, model, effort, cwd }) {
  return new Promise((resolveRun) => {
    const child = spawn('codex', ['mcp-server'], { cwd: root, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let buffer = '';
    let settled = false;
    const timeout = setTimeout(() => finish({ ok: false, error: `timeout after ${mcpTimeoutMs}ms`, stdoutBytes: Buffer.byteLength(stdout), stderr }), mcpTimeoutMs);

    function send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
    function finish(result) {
      if (settled)
        return;
      settled = true;
      clearTimeout(timeout);
      if (child.exitCode === null)
        child.kill('SIGTERM');
      resolveRun(result);
    }
    function fail(message) {
      finish({ ok: false, error: message, stdoutBytes: Buffer.byteLength(stdout), stderr });
    }
    function handle(message) {
      if (message.id === 1) {
        if (message.error)
          return fail(`initialize: ${JSON.stringify(message.error)}`);
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'codex',
            arguments: {
              prompt,
              model,
              cwd,
              'sandbox': nestedSandbox,
              'approval-policy': 'never',
              'config': { model_reasoning_effort: effort },
            },
          },
        });
        return;
      }
      if (message.id === 2) {
        if (message.error)
          return fail(`tool: ${JSON.stringify(message.error)}`);
        const result = message.result || {};
        const structured = result.structuredContent || {};
        const text = structured.content || result.content?.find(item => item.type === 'text')?.text || null;
        return finish({ ok: !result.isError, error: result.isError ? text : null, finalMessage: text, threadId: structured.threadId || null, stderr });
      }
      if (message.id !== undefined && message.method) {
        send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'unsupported client method' } });
      }
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
          handle(JSON.parse(line));
        }
        catch (error) {
          fail(`invalid MCP response: ${error.message}`);
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', error => fail(error.message));
    child.on('close', (status) => {
      if (!settled)
        fail(`server exited ${status}`);
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'viberig-agent-team-live-ab', version: '1.0.0' } } });
  });
}

function readYaml(path) {
  if (!existsSync(path))
    return null;
  try {
    return parseYaml(readFileSync(path, 'utf8'));
  }
  catch {
    return null;
  }
}

function agentNames(cwd) {
  const directory = resolve(cwd, '.codex/agents');
  if (!existsSync(directory))
    return [];
  return readdirSync(directory).filter(name => name.endsWith('.toml')).map(name => name.slice(0, -5)).sort();
}

function codexAgentModel(cwd, name) {
  const config = readFileSync(resolve(cwd, `.codex/agents/${name}.toml`), 'utf8');
  return config.match(/^model\s*=\s*["']([^"']+)["']/m)?.[1] || null;
}

function routeMatches(routes, familyPattern, modelPattern, effort = null) {
  return routes.some((route) => {
    const family = `${route.taskFamily || ''} ${route.capability || ''} ${route.mode || ''}`;
    const selection = route.default || route.model || {};
    const model = typeof selection === 'string' ? selection : selection.model;
    const reasoning = route.reasoningEffort || selection.reasoningEffort;
    return familyPattern.test(family) && modelPattern.test(model || '') && (!effort || reasoning === effort);
  });
}

function normalizedRoutes(routes) {
  if (Array.isArray(routes))
    return routes;
  if (!routes || typeof routes !== 'object')
    return [];
  return Object.entries(routes).map(([taskFamily, route]) => ({ taskFamily, ...route }));
}

function routeUsesCapability(routes, familyPattern, capability) {
  return routes.some(route => familyPattern.test(route.taskFamily || '')
    && (route.capability === capability || route.capability?.startsWith(`${capability}/`)));
}

function uniqueConditionalNames(team) {
  return team.conditionalAgents !== null && !Array.isArray(team.conditionalAgents) && typeof team.conditionalAgents === 'object';
}

function runRoleOracle(cwd) {
  const goCache = resolve('/tmp/viberig-agent-team-live-go-cache');
  const goTemp = resolve('/tmp/viberig-agent-team-live-go-tmp');
  mkdirSync(goCache, { recursive: true });
  mkdirSync(goTemp, { recursive: true });
  const result = spawnSync(oracleGoBinary, ['test', '-ldflags=-linkmode=external', './e2e', '-count=1'], {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, GOCACHE: goCache, GOTMPDIR: goTemp, GOTOOLCHAIN: 'go1.22.0' },
  });
  return {
    status: result.status,
    error: result.error?.message || null,
    output: `${result.stdout || ''}${result.stderr || ''}`
      .replace(/\(\d+(?:\.\d+)?s\)/g, '(<duration>)')
      .replace(/\t\d+(?:\.\d+)?s\n/g, '\t<duration>\n'),
  };
}

function fileHash(path) {
  if (!existsSync(path))
    return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function protectedRoleTree(cwd) {
  const files = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const relativePath = path.slice(cwd.length + 1);
      if (relativePath === roleSnapshotPath || roleAllowedPaths.has(relativePath) || relativePath === '.git' || relativePath.startsWith('.git/'))
        continue;
      if (entry.isDirectory())
        walk(path);
      else if (entry.isFile())
        files[relativePath] = fileHash(path);
    }
  }
  walk(cwd);
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

function writeRoleSnapshot(cwd) {
  const path = resolve(cwd, roleSnapshotPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(protectedRoleTree(cwd), null, 2)}\n`);
}

function changedProtectedRolePaths(cwd) {
  const path = resolve(cwd, roleSnapshotPath);
  if (!existsSync(path))
    return ['<missing-role-snapshot>'];
  const before = JSON.parse(readFileSync(path, 'utf8'));
  const after = protectedRoleTree(cwd);
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter(name => before[name] !== after[name]).sort();
}

const mandatoryCandidateChecks = new Set([
  ...coreAgents.map(name => `core-${name}`),
  ...expectedConditional.map(name => `conditional-${name}`),
  ...forbiddenConditional.map(name => `absent-${name}`),
  'conditional-evidence',
  'conditional-names-unique',
  'team-schema-valid',
  'exact-agent-set',
  'codex-fixed-role-models',
  'routing-schema-valid',
  'route-risk-explicit',
  'route-bounded-implementation-luna',
  'route-ordinary-tests-luna',
  'route-backend-e2e-sol',
  'route-backend-e2e-agent',
  'route-review-terra',
  'route-integration-terra',
  'route-security-sol',
  'route-red-team-sol-high',
  'test-agent-wrote-go-test',
  'test-agent-public-boundary',
  'test-agent-no-replacement-handler',
  'test-agent-no-listener-socket',
  'test-agent-independent-red',
  'test-agent-no-persistence-red',
  'test-agent-no-production-edit',
  'review-agent-request-changes',
  'review-agent-finds-auth-bypass',
]);

function mandatoryFailures(artifactScore, roleScore) {
  return [...artifactScore.checks, ...roleScore.checks]
    .filter(check => mandatoryCandidateChecks.has(check.id) && !check.pass)
    .map(check => check.id);
}

function scoreArtifacts(cwd) {
  const checks = [];
  const add = (id, pass, points) => checks.push({ id, pass: Boolean(pass), points });
  const names = agentNames(cwd);
  const team = readYaml(resolve(cwd, '.vibeRig/team-profile.yaml')) || {};
  const routing = readYaml(resolve(cwd, '.vibeRig/model-routing.yaml')) || {};
  const conditionalEntries = team.conditionalAgents && !Array.isArray(team.conditionalAgents) && typeof team.conditionalAgents === 'object'
    ? Object.entries(team.conditionalAgents)
    : [];
  const selected = new Set([...(team.coreAgents || []), ...conditionalEntries.map(([name]) => name)]);

  for (const name of coreAgents) add(`core-${name}`, names.includes(name), 2);
  for (const name of expectedConditional) add(`conditional-${name}`, names.includes(name), 3);
  for (const name of forbiddenConditional) add(`absent-${name}`, !names.includes(name) && !selected.has(name), 3);
  add('conditional-evidence', conditionalEntries.length === expectedConditional.length && conditionalEntries.every(([, item]) => item?.evidence?.length > 0), 4);
  add('conditional-names-unique', uniqueConditionalNames(team), 2);
  add('team-fingerprints', Boolean(team.manifestFingerprint && team.policyFingerprint), 4);
  add('team-schema-valid', teamProfileValidator(team), 4);
  add('exact-agent-set', names.length === coreAgents.length + expectedConditional.length, 4);

  const configs = names.map(name => readFileSync(resolve(cwd, `.codex/agents/${name}.toml`), 'utf8'));
  add('codex-fixed-role-models', names.length > 0 && names.every(name => codexAgentModel(cwd, name) === expectedCodexModels[name]), 5);
  add('role-boundaries', configs.length > 0 && configs.every(config => /mission|developer_instructions/i.test(config)), 3);

  const routes = normalizedRoutes(routing.routes);
  add('routing-schema-valid', modelRoutingValidator(routing), 4);
  add('route-risk-explicit', routes.length > 0 && routes.every(route => typeof route.risk === 'string' && route.risk.length > 0), 4);
  add('route-bounded-implementation-luna', routeMatches(routes, /implementation|deterministic-execute/i, /luna/i, 'low'), 4);
  add('route-ordinary-tests-luna', routeMatches(routes, /unit|contract|integration.*test|test.*unit|deterministic-execute/i, /luna/i, 'low'), 4);
  add('route-backend-e2e-sol', routeMatches(routes, /backend.*e2e|e2e.*backend/i, /sol/i, 'low'), 6);
  add('route-backend-e2e-agent', routeUsesCapability(routes, /backend.*e2e|e2e.*backend/i, 'backend_e2e_engineer'), 4);
  add('route-review-terra', routeMatches(routes, /code.review|independent.*review/i, /terra/i), 3);
  add('route-integration-terra', routeMatches(routes, /cross.issue|integrator|integration/i, /terra/i), 3);
  add('route-security-sol', routeMatches(routes, /security/i, /sol/i), 3);
  add('route-red-team-sol-high', routeMatches(routes, /red.team/i, /sol/i, 'high'), 4);
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.points, 0);
  const total = checks.reduce((sum, check) => sum + check.points, 0);
  return { earned, total, checks, names, team, routing };
}

function scoreRoles(cwd) {
  const checks = [];
  const add = (id, pass, points) => checks.push({ id, pass: Boolean(pass), points });
  const e2ePath = resolve(cwd, 'e2e/invitations_test.go');
  const e2e = existsSync(e2ePath) ? readFileSync(e2ePath, 'utf8') : '';
  const oracle = runRoleOracle(cwd);
  const protectedChanges = changedProtectedRolePaths(cwd);
  add('test-agent-wrote-go-test', /func Test/.test(e2e) && /invit/i.test(e2e), 5);
  add('test-agent-authorization-oracle', /403|forbidden|non.?admin|unauthor/i.test(e2e), 5);
  add('test-agent-public-boundary', /httptest\.NewRequest/.test(e2e) && /httptest\.NewRecorder/.test(e2e) && /internal\/httpapi/i.test(e2e) && /httpapi\.Handler/.test(e2e), 3);
  add('test-agent-no-replacement-handler', !/http\.HandlerFunc|http\.HandleFunc|NewServeMux/.test(e2e), 3);
  add('test-agent-no-listener-socket', !/httptest\.NewServer|net\.Listen/.test(e2e), 2);
  add('test-agent-independent-red', oracle.status !== 0 && /status.*201.*want 403|want 403.*got 201/is.test(oracle.output), 5);
  add('test-agent-no-persistence-red', oracle.status !== 0 && /persist/i.test(oracle.output), 3);
  add('test-agent-no-production-edit', protectedChanges.length === 0, 2);

  let review = null;
  try {
    review = JSON.parse(readFileSync(resolve(cwd, 'review-result.json'), 'utf8'));
  }
  catch {}
  const findings = review?.findings || [];
  add('review-agent-request-changes', /change|fail|reject|block/i.test(review?.verdict || ''), 3);
  add('review-agent-finds-auth-bypass', findings.some(finding => /auth|role|admin|forbidden/i.test(JSON.stringify(finding))), 5);
  add('review-agent-cites-file-line', findings.some(finding => /service\.go/.test(finding.file || '') && Number(finding.line) > 0), 4);
  add('review-agent-remediation', findings.some(finding => typeof finding.remediation === 'string' && finding.remediation.length > 10), 3);
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.points, 0);
  const total = checks.reduce((sum, check) => sum + check.points, 0);
  return { earned, total, checks, review, oracle, protectedChanges };
}

const scoreOnlyRoot = valueAfter('--score-only');
const snapshotRoleStateRoot = valueAfter('--snapshot-role-state');
if (snapshotRoleStateRoot) {
  for (const variant of ['baseline', 'candidate'])
    writeRoleSnapshot(resolve(snapshotRoleStateRoot, variant));
  console.log(JSON.stringify({ snapshotRoleStateRoot, variants: ['baseline', 'candidate'] }, null, 2));
  process.exit(0);
}

if (scoreOnlyRoot) {
  const scored = {};
  for (const variant of ['baseline', 'candidate']) {
    const cwd = resolve(scoreOnlyRoot, variant);
    const artifactScore = scoreArtifacts(cwd);
    const roleScore = scoreRoles(cwd);
    const earned = artifactScore.earned + roleScore.earned;
    const total = artifactScore.total + roleScore.total;
    scored[variant] = {
      cwd,
      artifactScore,
      roleScore,
      mandatoryFailures: mandatoryFailures(artifactScore, roleScore),
      score: Math.round(1000 * earned / total) / 10,
    };
  }
  scored.candidate.passed = scored.candidate.score >= 90 && scored.candidate.mandatoryFailures.length === 0;
  const reportPath = valueAfter('--report-path') || resolve(scoreOnlyRoot, 'score-report.json');
  writeFileSync(reportPath, `${JSON.stringify(scored, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, baseline: scored.baseline.score, candidate: scored.candidate.score, passed: scored.candidate.passed, mandatoryFailures: scored.candidate.mandatoryFailures }, null, 2));
  process.exit(scored.candidate.passed ? 0 : 1);
}

const report = { generatedAt: new Date().toISOString(), baselineRef, outputRoot, nestedSandbox, runs: [] };
for (let iteration = 1; iteration <= repeat; iteration += 1) {
  for (const variant of variants) {
    const cwd = resolve(outputRoot, `${variant}-${iteration}`);
    mkdirSync(cwd, { recursive: true });
    cpSync(fixtureRoot, cwd, { recursive: true });
    execFileSync('git', ['init', '--quiet'], { cwd });
    mkdirSync(resolve(cwd, '.codex/agents'), { recursive: true });
    const init = await runMcp({ prompt: initPrompt(variant), model: initModel, effort: 'low', cwd });
    const artifactScore = scoreArtifacts(cwd);
    writeRoleSnapshot(cwd);
    const backendE2EAgent = existsSync(resolve(cwd, '.codex/agents/backend_e2e_engineer.toml')) ? 'backend_e2e_engineer' : 'test_engineer';
    const testConfigPath = resolve(cwd, `.codex/agents/${backendE2EAgent}.toml`);
    const reviewConfigPath = resolve(cwd, '.codex/agents/code_review.toml');
    let testRun = { ok: false, error: 'agent not created' };
    let reviewRun = { ok: false, error: 'agent not created' };
    if (existsSync(testConfigPath)) {
      testRun = await runMcp({ prompt: rolePrompt(variant, backendE2EAgent, readFileSync(testConfigPath, 'utf8')), model: 'gpt-5.6-sol', effort: 'low', cwd });
    }
    if (existsSync(reviewConfigPath)) {
      reviewRun = await runMcp({ prompt: rolePrompt(variant, 'code_review', readFileSync(reviewConfigPath, 'utf8')), model: 'gpt-5.6-terra', effort: 'low', cwd });
    }
    const roleScore = scoreRoles(cwd);
    const earned = artifactScore.earned + roleScore.earned;
    const total = artifactScore.total + roleScore.total;
    report.runs.push({ variant, iteration, cwd, init, testRun, reviewRun, artifactScore, roleScore, mandatoryFailures: mandatoryFailures(artifactScore, roleScore), score: Math.round(1000 * earned / total) / 10 });
    writeFileSync(resolve(outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
}

for (const variant of variants) {
  const runs = report.runs.filter(run => run.variant === variant);
  report[variant] = { averageScore: Math.round(10 * runs.reduce((sum, run) => sum + run.score, 0) / runs.length) / 10, scores: runs.map(run => run.score) };
}
writeFileSync(resolve(outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath: resolve(outputRoot, 'report.json'), baseline: report.baseline, candidate: report.candidate }, null, 2));
if (report.runs.some(run => run.variant === 'candidate' && (run.score < 90 || run.mandatoryFailures.length > 0)))
  process.exitCode = 1;
