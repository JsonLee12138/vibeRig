import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'viberig-pi-company-'));

try {
  const company = await tsImport(resolve(root, 'src/cli/lib/pi-company.ts'), import.meta.url);
  const model = 'openai-codex/gpt-5.6-terra';
  const config = await company.initPiCompany({
    cwd: temporaryRoot,
    packageRoot: root,
    projectName: 'pi-company-test',
    defaultModel: model,
  });

  assert.equal(config.platform, 'pi');
  assert.equal(config.models.default, model);
  assert.equal(config.models.implementation, 'xiaomi-token-plan-cn/mimo-v2.5');
  assert.equal(config.models.validation, 'openai-codex/gpt-5.6-sol');
  assert.equal(config.models.knowledge, 'openai-codex/gpt-5.6-sol');
  assert.equal(
    company.resolvePiRoleModel(config, 'implementer'),
    'xiaomi-token-plan-cn/mimo-v2.5',
  );
  assert.equal(
    company.resolvePiRoleModel(config, 'reviewer'),
    'openai-codex/gpt-5.6-sol',
  );
  assert.equal(config.knowledge.backend, 'vb-wiki');
  assert.equal(config.knowledge.plane_pages_enabled, false);
  assert.ok(Object.keys(config.roles).length >= 13, 'the built-in company is missing core employees');

  const analyst = await readFile(resolve(temporaryRoot, '.pi/agents/project_analyst.md'), 'utf8');
  assert.match(analyst, /tools: "read, grep, find, ls"/);
  assert.match(analyst, /extensions: false/);
  assert.match(analyst, /skills: "viberig-company-context, viberig-project-analysis"/);
  assert.match(analyst, /model: "openai-codex\/gpt-5\.6-sol"/);
  assert.match(analyst, /disallowed_tools: "edit, write"/);
  assert.doesNotMatch(analyst, /isolation: worktree/);
  const projectAnalysisSkill = await readFile(
    resolve(temporaryRoot, '.pi/skills/viberig-project-analysis/SKILL.md'),
    'utf8',
  );
  assert.match(projectAnalysisSkill, /name: viberig-project-analysis/);

  const implementer = await readFile(resolve(temporaryRoot, '.pi/agents/implementer.md'), 'utf8');
  assert.match(implementer, /isolation: worktree/);
  assert.match(implementer, /model: "xiaomi-token-plan-cn\/mimo-v2\.5"/);
  assert.match(implementer, /output_transcript: false/);
  assert.match(implementer, /inherit_context: false/);

  const aggregator = await readFile(resolve(temporaryRoot, '.pi/agents/council_aggregator.md'), 'utf8');
  assert.match(aggregator, /viberig-council-synthesis/);
  assert.match(aggregator, /model: "openai-codex\/gpt-5\.6-sol"/);
  assert.match(aggregator, /disallowed_tools: "edit, write"/);

  const curator = await readFile(resolve(temporaryRoot, '.pi/agents/knowledge_curator.md'), 'utf8');
  assert.match(curator, /vb-wiki/);
  assert.match(curator, /disallowed_tools: "edit, write"/);
  assert.doesNotMatch(curator, /isolation: worktree/);

  const subagents = JSON.parse(await readFile(resolve(temporaryRoot, '.pi/subagents.json'), 'utf8'));
  assert.equal(subagents.disableDefaultAgents, true);
  assert.equal(subagents.scopeModels, true);
  assert.equal(subagents.outputTranscript, false);

  const settings = JSON.parse(await readFile(resolve(temporaryRoot, '.pi/settings.json'), 'utf8'));
  assert.ok(settings.packages.includes(root));
  assert.ok(settings.enabledModels.includes(model));
  assert.ok(settings.enabledModels.includes('xiaomi-token-plan-cn/mimo-v2.5'));
  assert.ok(settings.enabledModels.includes('openai-codex/gpt-5.6-sol'));
  assert.equal(config.plane.writes_enabled, false);
  assert.equal(config.plane.allow_headless_writes, false);

  const gatewayModule = await tsImport(resolve(root, 'src/cli/lib/plane-gateway.ts'), import.meta.url);
  const responses = [];
  const fakeFetch = async (url, init = {}) => {
    responses.push({ url: String(url), init });
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  process.env.PLANE_TEST_API_KEY = 'test-only';
  const gateway = new gatewayModule.PlaneGateway({
    enabled: true,
    writes_enabled: true,
    allow_headless_writes: false,
    base_url: 'https://plane.internal',
    workspace_slug: 'acme',
    project_id: 'project-1',
    api_key_env: 'PLANE_TEST_API_KEY',
  }, fakeFetch);
  const probe = await gateway.probe();
  assert.equal(probe.ok, true);
  assert.equal(probe.knowledgeBackend, 'vb-wiki');
  assert.equal(probe.pagesAutomation, 'disabled-by-policy');
  assert.ok(responses.every(item => item.init.headers['X-API-Key'] === 'test-only'));
  assert.ok(responses.some(item => item.url.includes('/work-items/')));
  assert.ok(responses.some(item => item.url.includes('/states/')));
  assert.ok(responses.every(item => !item.url.includes('/issues/')));
  assert.ok(responses.every(item => !item.url.includes('/pages/')));
  await gateway.readWorkItemByIdentifier('ACME-123');
  assert.ok(responses.some(item => item.url.includes('/workspaces/acme/work-items/ACME-123/')));

  const states = [
    { id: 'backlog', name: 'Backlog', group: 'backlog', sequence: 1 },
    { id: 'started', name: 'In Progress', group: 'started', sequence: 2 },
    { id: 'review', name: 'In Review', group: 'started', sequence: 3 },
    { id: 'done', name: 'Done', group: 'completed', sequence: 4 },
  ];
  assert.equal(
    gatewayModule.resolvePlaneLifecycleState(states, 'technically_ready').id,
    'review',
  );
  assert.notEqual(
    gatewayModule.resolvePlaneLifecycleState(states, 'technically_ready').group,
    'completed',
  );

  const comments = [];
  const progressFetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    if (method === 'POST') {
      const payload = JSON.parse(init.body);
      comments.push({ id: 'comment-1', ...payload });
      return new Response(JSON.stringify(comments[0]), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ results: comments }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const progressGateway = new gatewayModule.PlaneGateway({
    enabled: true,
    writes_enabled: true,
    allow_headless_writes: false,
    base_url: 'https://plane.internal',
    workspace_slug: 'acme',
    project_id: 'project-1',
    api_key_env: 'PLANE_TEST_API_KEY',
  }, progressFetch);
  const appended = await progressGateway.appendProgress({
    workItemId: 'work-item-1',
    operationId: 'run-1.progress',
    summary: '<script>unsafe</script>',
    evidenceRefs: ['commit:abc123'],
  });
  assert.equal(appended.adopted, false);
  assert.match(comments[0].comment_html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  const retried = await progressGateway.appendProgress({
    workItemId: 'work-item-1',
    operationId: 'run-1.progress',
    summary: 'retry',
  });
  assert.equal(retried.adopted, true);
  assert.equal(comments.length, 1, 'idempotent retry created a duplicate Plane comment');

  let currentState = 'backlog';
  let patches = 0;
  const transitionComments = [];
  const transitionFetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    const method = init.method ?? 'GET';
    if (parsed.pathname.endsWith('/states/')) {
      return new Response(JSON.stringify({ results: states }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.pathname.endsWith('/comments/')) {
      if (method === 'POST') {
        const payload = JSON.parse(init.body);
        transitionComments.push({ id: 'transition-comment', ...payload });
        return new Response(JSON.stringify(transitionComments[0]), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ results: transitionComments }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.pathname.endsWith('/work-items/work-item-1/')) {
      if (method === 'PATCH') {
        patches++;
        currentState = JSON.parse(init.body).state;
      }
      return new Response(JSON.stringify({
        id: 'work-item-1',
        name: 'Lifecycle test',
        state: currentState,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected transition URL: ${url}`);
  };
  const transitionGateway = new gatewayModule.PlaneGateway({
    enabled: true,
    writes_enabled: true,
    allow_headless_writes: false,
    base_url: 'https://plane.internal',
    workspace_slug: 'acme',
    project_id: 'project-1',
    api_key_env: 'PLANE_TEST_API_KEY',
  }, transitionFetch);
  const transitioned = await transitionGateway.transitionWorkItem({
    workItemId: 'work-item-1',
    transition: 'technically_ready',
    operationId: 'run-1.technically-ready',
    summary: 'Technical gates passed; human acceptance remains pending.',
  });
  assert.equal(transitioned.projection, 'applied');
  assert.equal(currentState, 'review');
  const transitionRetry = await transitionGateway.transitionWorkItem({
    workItemId: 'work-item-1',
    transition: 'technically_ready',
    operationId: 'run-1.technically-ready',
    summary: 'retry',
  });
  assert.equal(transitionRetry.projection, 'already-applied');
  assert.equal(transitionRetry.adopted, true);
  assert.equal(patches, 1, 'idempotent transition retry issued another PATCH');
  assert.equal(transitionComments.length, 1, 'idempotent transition retry duplicated progress');

  let doctor = await company.doctorPiCompany(temporaryRoot);
  assert.equal(doctor.ok, true);
  assert.equal(doctor.generatedAgents.length, Object.keys(company.roleDefinitions).length);
  assert.equal(doctor.warnings.filter(item => item.includes('agent drift')).length, 0);

  const reviewerPath = resolve(temporaryRoot, '.pi/agents/reviewer.md');
  await import('node:fs/promises').then(({ appendFile }) => appendFile(reviewerPath, '\nmanual drift\n'));
  doctor = await company.doctorPiCompany(temporaryRoot);
  assert.equal(doctor.ok, true);
  assert.ok(doctor.warnings.some(item => item.includes('agent drift detected: reviewer')));

  console.log('pi company validation passed (config, role isolation, model routing, drift detection)');
}
finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
