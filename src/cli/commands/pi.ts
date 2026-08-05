import { resolve } from 'node:path';
import process from 'node:process';
import { defineCommand } from 'citty';
import { consola } from 'consola';

import { doctorPiCompany, findPackageRoot, initPiCompany, loadPiCompanyConfig } from '../lib/pi-company.js';
import {
  PLANE_MCP_ENVIRONMENT_VARIABLES,
  PLANE_MCP_PACKAGE,
  PLANE_MCP_SERVER_NAME,
} from '../lib/plane-mcp.js';

const initPiCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Generate the project-local Pi company, isolated agents, skills, and model settings.',
  },
  args: {
    'cwd': {
      type: 'string',
      description: 'Target project directory.',
      default: '.',
    },
    'model': {
      type: 'string',
      description: 'Parent delivery-lead model in provider/model form.',
      default: 'openai-codex/gpt-5.6-sol',
    },
    'implementation-model': {
      type: 'string',
      description: 'Fast project model for implementer and test-writing roles.',
      default: 'xiaomi-token-plan-cn/mimo-v2.5',
    },
    'validation-model': {
      type: 'string',
      description: 'Strong project model for review, security, architecture, aggregation, and verification.',
      default: 'openai-codex/gpt-5.6-sol',
    },
    'knowledge-model': {
      type: 'string',
      description: 'Strong model for accepted-evidence knowledge candidate curation.',
      default: 'openai-codex/gpt-5.6-sol',
    },
    'name': {
      type: 'string',
      description: 'Project name.',
    },
    'force': {
      type: 'boolean',
      description: 'Regenerate managed Agent and subagent settings files.',
      default: false,
    },
    'package-source': {
      type: 'string',
      description: 'Pi package source written to .pi/settings.json; defaults to the local VibeRig package path.',
    },
  },
  async run({ args }) {
    const root = resolve(args.cwd);
    const packageRoot = await findPackageRoot(import.meta.url);
    const config = await initPiCompany({
      cwd: root,
      packageRoot,
      packageSource: args['package-source'],
      projectName: args.name,
      defaultModel: args.model,
      implementationModel: args['implementation-model'],
      validationModel: args['validation-model'],
      knowledgeModel: args['knowledge-model'],
      force: args.force,
    });
    consola.success(`Generated ${Object.keys(config.roles).length} Pi company roles in ${root}/.pi/agents`);
    consola.info(`Project model: ${config.models.default}`);
    consola.info(`Implementation tier: ${config.models.implementation}`);
    consola.info(`Validation tier: ${config.models.validation}`);
    consola.info(`Knowledge tier: ${config.models.knowledge} (${config.knowledge.backend})`);
    consola.info('Run `viberig pi doctor --cwd <project>` before starting Pi.');
  },
});

const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Validate Pi company configuration, generated agents, and Plane prerequisites.',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Project root.',
      default: '.',
    },
    json: {
      type: 'boolean',
      description: 'Print machine-readable JSON.',
      default: false,
    },
  },
  async run({ args }) {
    const result = await doctorPiCompany(resolve(args.cwd));
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    else {
      for (const warning of result.warnings)
        consola.warn(warning);
      for (const error of result.errors)
        consola.error(error);
      if (result.ok)
        consola.success(`Pi company is ready (${result.generatedAgents.length} agents).`);
    }
    if (!result.ok)
      process.exitCode = 1;
  },
});

const planeProbeCommand = defineCommand({
  meta: {
    name: 'plane-probe',
    description: 'Validate the official Plane MCP project config and required environment without mutating Plane.',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Project root.',
      default: '.',
    },
    json: {
      type: 'boolean',
      description: 'Print machine-readable JSON.',
      default: false,
    },
  },
  async run({ args }) {
    const root = resolve(args.cwd);
    const config = await loadPiCompanyConfig(root);
    if (!config.plane.enabled)
      throw new Error('Plane is disabled in .pi/viberig.yaml');
    const doctor = await doctorPiCompany(root);
    const environment = Object.fromEntries(
      PLANE_MCP_ENVIRONMENT_VARIABLES.map(name => [name, Boolean(process.env[name])]),
    );
    const missingEnvironment = Object.entries(environment)
      .filter(([, present]) => !present)
      .map(([name]) => name);
    const result = {
      ok: doctor.ok && missingEnvironment.length === 0,
      transport: 'stdio',
      server: PLANE_MCP_SERVER_NAME,
      package: PLANE_MCP_PACKAGE,
      projectId: config.plane.project_id,
      environment,
      writesEnabled: config.plane.writes_enabled,
      allowHeadlessWrites: config.plane.allow_headless_writes,
      knowledgeBackend: config.knowledge.backend,
      pagesAutomation: 'disabled-by-policy',
      errors: doctor.errors,
      missingEnvironment,
      next: `Start Pi, run mcp({ connect: "${PLANE_MCP_SERVER_NAME}" }), then call the project-bound retrieve_project tool.`,
    };
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    else {
      consola.info(`MCP server: ${result.server} (${result.package}, ${result.transport})`);
      consola.info(`Project binding: ${result.projectId || '(missing)'}`);
      for (const [name, present] of Object.entries(result.environment))
        consola.info(`${present ? '✓' : '✗'} ${name}`);
      consola.info(`Knowledge backend: ${result.knowledgeBackend}`);
      consola.info(`Pages automation: ${result.pagesAutomation}`);
      consola.info(result.next);
    }
    if (!result.ok)
      process.exitCode = 1;
  },
});

export const piCommand = defineCommand({
  meta: {
    name: 'pi',
    description: 'Manage the Pi-only virtual software company.',
  },
  subCommands: {
    'init': initPiCommand,
    'doctor': doctorCommand,
    'plane-probe': planeProbeCommand,
  },
});
