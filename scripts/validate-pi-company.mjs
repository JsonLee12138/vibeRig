import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  assert.ok(Object.keys(config.roles).length >= 12, 'the built-in company is missing core employees');

  const analyst = await readFile(resolve(temporaryRoot, '.pi/agents/project_analyst.md'), 'utf8');
  assert.match(analyst, /tools: "read, grep, find, ls"/);
  assert.match(analyst, /extensions: false/);
  assert.match(analyst, /skills: "viberig-company-context, viberig-project-analysis"/);
  assert.match(analyst, new RegExp(`model: "${model.replaceAll('.', '\\.')}"`));
  assert.match(analyst, /disallowed_tools: "edit, write"/);
  assert.doesNotMatch(analyst, /isolation: worktree/);
  const projectAnalysisSkill = await readFile(
    resolve(temporaryRoot, '.pi/skills/viberig-project-analysis/SKILL.md'),
    'utf8',
  );
  assert.match(projectAnalysisSkill, /name: viberig-project-analysis/);

  const implementer = await readFile(resolve(temporaryRoot, '.pi/agents/implementer.md'), 'utf8');
  assert.match(implementer, /isolation: worktree/);
  assert.match(implementer, /output_transcript: false/);
  assert.match(implementer, /inherit_context: false/);

  const subagents = JSON.parse(await readFile(resolve(temporaryRoot, '.pi/subagents.json'), 'utf8'));
  assert.equal(subagents.disableDefaultAgents, true);
  assert.equal(subagents.scopeModels, true);
  assert.equal(subagents.outputTranscript, false);

  const settings = JSON.parse(await readFile(resolve(temporaryRoot, '.pi/settings.json'), 'utf8'));
  assert.ok(settings.packages.includes(root));
  assert.ok(settings.enabledModels.includes(model));

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
