import { resolve } from 'node:path';
import { defineCommand } from 'citty';
import { consola } from 'consola';

import { doctorPiCompany, findPackageRoot, initPiCompany } from '../lib/pi-company.js';

const initPiCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Generate the project-local Pi company, isolated agents, skills, and model settings.',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Target project directory.',
      default: '.',
    },
    model: {
      type: 'string',
      description: 'Default project model in provider/model form.',
      default: 'openai-codex/gpt-5.6-terra',
    },
    name: {
      type: 'string',
      description: 'Project name.',
    },
    force: {
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
      force: args.force,
    });
    consola.success(`Generated ${Object.keys(config.roles).length} Pi company roles in ${root}/.pi/agents`);
    consola.info(`Project model: ${config.models.default}`);
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

export const piCommand = defineCommand({
  meta: {
    name: 'pi',
    description: 'Manage the Pi-only virtual software company.',
  },
  subCommands: {
    init: initPiCommand,
    doctor: doctorCommand,
  },
});
