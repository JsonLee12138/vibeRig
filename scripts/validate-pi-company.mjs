import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { stringify } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'viberig-pi-company-'));

try {
  const company = await tsImport(resolve(root, 'src/cli/lib/pi-company.ts'), import.meta.url);
  const planeMcp = await tsImport(resolve(root, 'src/cli/lib/plane-mcp.ts'), import.meta.url);
  const model = 'openai-codex/gpt-5.6-terra';
  let config = await company.initPiCompany({
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
  assert.equal(company.resolvePiRoleModel(config, 'implementer'), 'xiaomi-token-plan-cn/mimo-v2.5');
  assert.equal(company.resolvePiRoleModel(config, 'reviewer'), 'openai-codex/gpt-5.6-sol');
  assert.equal(config.knowledge.backend, 'vb-wiki');
  assert.equal(config.knowledge.plane_pages_enabled, false);
  assert.ok(Object.keys(config.roles).length >= 13, 'the built-in company is missing core employees');

  const analyst = await readFile(resolve(temporaryRoot, '.pi/agents/project_analyst.md'), 'utf8');
  assert.match(analyst, /tools: "read, grep, find, ls"/);
  assert.match(analyst, /extensions: false/);
  assert.match(analyst, /skills: "vb-company-context, vb-project-analysis"/);
  assert.match(analyst, /model: "openai-codex\/gpt-5\.6-sol"/);
  assert.match(analyst, /disallowed_tools: "edit, write"/);
  assert.doesNotMatch(analyst, /isolation: worktree/);

  const projectAnalysisSkill = await readFile(
    resolve(temporaryRoot, '.pi/skills/vb-project-analysis/SKILL.md'),
    'utf8',
  );
  assert.match(projectAnalysisSkill, /name: vb-project-analysis/);

  const implementer = await readFile(resolve(temporaryRoot, '.pi/agents/implementer.md'), 'utf8');
  assert.match(implementer, /isolation: worktree/);
  assert.match(implementer, /model: "xiaomi-token-plan-cn\/mimo-v2\.5"/);
  assert.match(implementer, /output_transcript: false/);
  assert.match(implementer, /inherit_context: false/);

  const aggregator = await readFile(resolve(temporaryRoot, '.pi/agents/council_aggregator.md'), 'utf8');
  assert.match(aggregator, /vb-council-synthesis/);
  assert.match(aggregator, /model: "openai-codex\/gpt-5\.6-sol"/);
  assert.match(aggregator, /disallowed_tools: "edit, write"/);

  const curator = await readFile(resolve(temporaryRoot, '.pi/agents/knowledge_curator.md'), 'utf8');
  assert.match(curator, /vb-wiki/);
  assert.match(curator, /vb-insights/);
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

  await assert.rejects(
    readFile(resolve(temporaryRoot, '.mcp.json'), 'utf8'),
    error => error.code === 'ENOENT',
  );
  const existingMcpConfig = {
    settings: { toolPrefix: 'short' },
    mcpServers: { existing: { command: 'existing-mcp' } },
  };
  const existingMcpRaw = `${JSON.stringify(existingMcpConfig, null, 2)}\n`;
  await writeFile(
    resolve(temporaryRoot, '.mcp.json'),
    existingMcpRaw,
  );

  config.plane.enabled = true;
  config.plane.project_id = 'project-1';
  await writeFile(
    resolve(temporaryRoot, '.pi/viberig.yaml'),
    stringify(config, { lineWidth: 0 }),
  );
  config = await company.initPiCompany({
    cwd: temporaryRoot,
    packageRoot: root,
    defaultModel: model,
    force: true,
  });

  assert.equal(
    await readFile(resolve(temporaryRoot, '.mcp.json'), 'utf8'),
    existingMcpRaw,
  );

  const builtInMcpConfig = planeMcp.createBuiltInPlaneMcpConfig();
  assert.equal(planeMcp.PLANE_MCP_PACKAGE, 'plane-mcp-server==0.2.9');
  assert.equal(builtInMcpConfig.settings.toolPrefix, 'server');
  assert.equal(builtInMcpConfig.settings.hostConfigDiscovery, 'off');
  const planeServer = builtInMcpConfig.mcpServers[planeMcp.PLANE_MCP_SERVER_NAME];
  assert.equal(planeServer.command, 'uvx');
  assert.deepEqual(planeServer.args, [planeMcp.PLANE_MCP_PACKAGE, 'stdio']);
  assert.equal(planeServer.env.PLANE_BASE_URL, '$' + '{PLANE_BASE_URL}');
  assert.equal(planeServer.env.PLANE_API_KEY, '$' + '{PLANE_API_KEY}');
  assert.equal(planeServer.env.PLANE_WORKSPACE_SLUG, '$' + '{PLANE_WORKSPACE_SLUG}');
  assert.equal(planeServer.directTools, false);
  assert.equal(planeServer.exposeResources, false);
  assert.ok(planeServer.includeTools.includes('list_projects'));
  assert.ok(planeServer.includeTools.includes('create_project'));
  assert.ok(planeServer.includeTools.includes('retrieve_work_item'));
  assert.ok(planeServer.includeTools.includes('update_work_item'));
  assert.ok(!planeServer.includeTools.some(tool => tool.startsWith('delete_')));
  assert.ok(!planeServer.includeTools.some(tool => tool.includes('page')));

  const injectedInput = {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_retrieve_work_item',
    args: { work_item_id: 'work-item-1' },
  };
  const readPolicy = planeMcp.enforcePlaneMcpToolCall(config.plane, injectedInput);
  assert.equal(readPolicy.blockReason, undefined);
  assert.equal(readPolicy.write, false);
  assert.equal(injectedInput.args.project_id, 'project-1');

  const mismatchPolicy = planeMcp.enforcePlaneMcpToolCall(config.plane, {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_retrieve_work_item',
    args: JSON.stringify({ project_id: 'project-2', work_item_id: 'work-item-1' }),
  });
  assert.match(mismatchPolicy.blockReason, /does not match/);

  const disabledWritePolicy = planeMcp.enforcePlaneMcpToolCall(config.plane, {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_update_work_item',
    args: { work_item_id: 'work-item-1', name: 'changed' },
  });
  assert.match(disabledWritePolicy.blockReason, /writes are disabled/i);

  const disallowedPolicy = planeMcp.enforcePlaneMcpToolCall(config.plane, {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_delete_work_item',
    args: { work_item_id: 'work-item-1' },
  });
  assert.match(disallowedPolicy.blockReason, /outside the VibeRig allowlist/);

  const writeConfig = { ...config.plane, writes_enabled: true };
  const enabledWriteInput = {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_create_work_item_comment',
    args: { work_item_id: 'work-item-1', comment_html: '<p>progress</p>' },
  };
  const enabledWritePolicy = planeMcp.enforcePlaneMcpToolCall(writeConfig, enabledWriteInput);
  assert.equal(enabledWritePolicy.blockReason, undefined);
  assert.equal(enabledWritePolicy.write, true);
  assert.equal(enabledWriteInput.args.project_id, 'project-1');

  const bootstrapPlane = { ...config.plane, project_id: '', writes_enabled: false };
  assert.deepEqual(planeMcp.planeMcpTools(false, false), ['list_projects', 'create_project']);
  const listProjectsPolicy = planeMcp.enforcePlaneMcpToolCall(bootstrapPlane, {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_list_projects',
    args: { per_page: 100 },
  });
  assert.equal(listProjectsPolicy.blockReason, undefined);
  assert.equal(listProjectsPolicy.bootstrap, true);
  assert.equal(listProjectsPolicy.write, false);

  const createProjectInput = {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_create_project',
    args: { name: 'Pi Company', identifier: 'PICOMP', page_view: true },
  };
  const createProjectPolicy = planeMcp.enforcePlaneMcpToolCall(bootstrapPlane, createProjectInput);
  assert.equal(createProjectPolicy.blockReason, undefined);
  assert.equal(createProjectPolicy.bootstrap, true);
  assert.equal(createProjectPolicy.write, true);
  assert.equal(createProjectInput.args.page_view, false);

  const unboundProjectTool = planeMcp.enforcePlaneMcpToolCall(bootstrapPlane, {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_list_work_items',
    args: {},
  });
  assert.match(unboundProjectTool.blockReason, /discovery must complete/);
  const reboundBootstrapTool = planeMcp.enforcePlaneMcpToolCall(config.plane, {
    server: planeMcp.PLANE_MCP_SERVER_NAME,
    tool: 'vb_plane_list_projects',
    args: {},
  });
  assert.match(reboundBootstrapTool.blockReason, /disabled after project binding/);

  const skillInitRoot = resolve(temporaryRoot, 'skill-init-project');
  const skillConfig = await company.initPiCompany({
    cwd: skillInitRoot,
    packageRoot: root,
    addPackageToProject: false,
    defaultModel: model,
    plane: {
      enabled: true,
      projectId: 'skill-project-1',
      writesEnabled: false,
      allowHeadlessWrites: false,
    },
  });
  assert.equal(skillConfig.plane.enabled, true);
  assert.equal(skillConfig.plane.project_id, 'skill-project-1');
  const skillSettings = JSON.parse(await readFile(resolve(skillInitRoot, '.pi/settings.json'), 'utf8'));
  assert.deepEqual(skillSettings.packages, []);
  const insightsSkill = await readFile(resolve(skillInitRoot, '.pi/skills/vb-insights/SKILL.md'), 'utf8');
  assert.match(insightsSkill, /name: vb-insights/);
  await assert.rejects(
    readFile(resolve(skillInitRoot, '.pi/skills/vb-init/SKILL.md'), 'utf8'),
    error => error.code === 'ENOENT',
  );
  await assert.rejects(
    readFile(resolve(skillInitRoot, '.mcp.json'), 'utf8'),
    error => error.code === 'ENOENT',
  );

  const bootstrapInitRoot = resolve(temporaryRoot, 'bootstrap-init-project');
  const bootstrapConfig = await company.initPiCompany({
    cwd: bootstrapInitRoot,
    packageRoot: root,
    addPackageToProject: false,
    defaultModel: model,
    plane: {
      enabled: true,
      writesEnabled: false,
      allowHeadlessWrites: false,
    },
  });
  assert.equal(bootstrapConfig.plane.project_id, '');
  await assert.rejects(
    readFile(resolve(bootstrapInitRoot, '.mcp.json'), 'utf8'),
    error => error.code === 'ENOENT',
  );

  let doctor = await company.doctorPiCompany(temporaryRoot);
  assert.equal(doctor.ok, true);
  assert.equal(doctor.generatedAgents.length, Object.keys(company.roleDefinitions).length);
  assert.equal(doctor.warnings.filter(item => item.includes('agent drift')).length, 0);
  for (const envName of planeMcp.PLANE_MCP_ENVIRONMENT_VARIABLES) {
    if (!process.env[envName])
      assert.ok(doctor.warnings.some(item => item.includes(envName)));
  }

  const reviewerPath = resolve(temporaryRoot, '.pi/agents/reviewer.md');
  await appendFile(reviewerPath, '\nmanual drift\n');
  doctor = await company.doctorPiCompany(temporaryRoot);
  assert.equal(doctor.ok, true);
  assert.ok(doctor.warnings.some(item => item.includes('agent drift detected: reviewer')));

  console.log('pi company validation passed (role isolation, model routing, package-owned Plane MCP and policy)');
}
finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
