import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { confirm, intro, isCancel, outro, text } from '@clack/prompts';
import { defineCommand } from 'citty';
import { consola } from 'consola';
import { ensureDir, pathExists } from 'fs-extra/esm';

import { contextRoutesYaml, environmentsYaml, runbooksYaml } from '../utils/harness-files.js';
import { projectProfileVersion, projectYaml, reconcileProjectYaml } from '../utils/project-yaml.js';
import { cancelPrompt } from '../utils/prompts.js';

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Create the VibeRig project directories and project.yaml contract.',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Target project directory.',
      default: '.',
    },
    name: {
      type: 'string',
      description: 'Project name written to .vibeRig/project.yaml.',
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip interactive confirmation.',
      default: false,
    },
    upgrade: {
      type: 'boolean',
      description: 'Reconcile an existing project.yaml to the V2 project profile.',
      default: false,
    },
  },
  async run({ args }) {
    const root = resolve(args.cwd);
    const defaultName = root.split('/').filter(Boolean).at(-1) ?? 'project';
    let projectName = args.name;

    intro('VibeRig init');

    if (!projectName && !args.yes) {
      const answer = await text({
        message: 'Project name',
        placeholder: defaultName,
        defaultValue: defaultName,
      });

      if (isCancel(answer)) {
        cancelPrompt();
      }

      projectName = typeof answer === 'string' ? answer : defaultName;
    }

    projectName ||= defaultName;

    if (!args.yes) {
      const answer = await confirm({
        message: `Initialize VibeRig in ${root}?`,
        initialValue: true,
      });

      if (isCancel(answer)) {
        cancelPrompt();
      }

      if (!answer) {
        cancelPrompt('Initialization skipped.');
      }
    }

    const docsRoot = resolve(root, '.vibeRig/requirements');
    const prdRoot = resolve(root, '.vibeRig/prd');
    const worktreesRoot = resolve(root, '.worktrees');
    const projectYamlPath = resolve(root, '.vibeRig/project.yaml');

    await ensureDir(resolve(docsRoot, 'archive'));
    await ensureDir(resolve(prdRoot, 'archive'));
    await ensureDir(worktreesRoot);

    if (await pathExists(projectYamlPath)) {
      const current = await readFile(projectYamlPath, 'utf8');
      if (args.upgrade) {
        const reconciled = reconcileProjectYaml(current, { projectName });
        if (current === reconciled) {
          consola.info(`${projectYamlPath} is already reconciled.`);
        }
        else {
          await writeFile(projectYamlPath, reconciled, 'utf8');
          consola.success(`Reconciled ${projectYamlPath} to V2.`);
        }
      }
      else if (projectProfileVersion(current) === 2) {
        consola.info(`${projectYamlPath} is already V2; leaving it unchanged.`);
      }
      else {
        consola.warn(`${projectYamlPath} already exists; use --upgrade to reconcile it.`);
      }
    }
    else {
      await ensureDir(resolve(root, '.vibeRig'));
      await writeFile(projectYamlPath, projectYaml({ projectName }), 'utf8');
      consola.success(`Created ${projectYamlPath}`);
    }

    const harnessFiles = [
      ['context-routes.yaml', contextRoutesYaml()],
      ['environments.yaml', environmentsYaml()],
      ['runbooks.yaml', runbooksYaml()],
    ] as const;

    for (const [name, content] of harnessFiles) {
      const path = resolve(root, '.vibeRig', name);
      if (await pathExists(path)) {
        consola.info(`${path} already exists; leaving it unchanged.`);
      }
      else {
        await writeFile(path, content, 'utf8');
        consola.success(`Created ${path}`);
      }
    }

    consola.info(`Ensured ${docsRoot}`);
    consola.info(`Ensured ${prdRoot}`);
    consola.info(`Ensured ${worktreesRoot}`);
    outro('VibeRig project scaffold is ready.');
  },
});
