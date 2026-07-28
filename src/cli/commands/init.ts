import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { confirm, intro, isCancel, outro, text } from '@clack/prompts';
import { defineCommand } from 'citty';
import { consola } from 'consola';
import { ensureDir, pathExists } from 'fs-extra/esm';

import { projectYaml } from '../utils/project-yaml.js';
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
    language: {
      type: 'string',
      description: 'BCP 47 output language written to .vibeRig/project.yaml.',
      default: 'zh-CN',
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
    const requirementsArchiveRoot = resolve(docsRoot, 'archive');
    const prdRoot = resolve(root, '.vibeRig/prd');
    const prdArchiveRoot = resolve(prdRoot, 'archive');
    const runsRoot = resolve(root, '.vibeRig/runs');
    const worktreesRoot = resolve(root, '.worktrees');
    const projectYamlPath = resolve(root, '.vibeRig/project.yaml');
    const gitignorePath = resolve(root, '.gitignore');

    await ensureDir(requirementsArchiveRoot);
    await ensureDir(prdArchiveRoot);
    await ensureDir(runsRoot);
    await ensureDir(worktreesRoot);
    await ensureDir(resolve(root, '.agents/skills'));
    await ensureDir(resolve(root, '.codex/agents'));
    await ensureDir(resolve(root, '.claude/agents'));
    await ensureDir(resolve(root, '.cursor/agents'));

    if (await pathExists(projectYamlPath)) {
      consola.warn(`${projectYamlPath} already exists; leaving it unchanged.`);
    }
    else {
      await ensureDir(resolve(root, '.vibeRig'));
      await writeFile(projectYamlPath, projectYaml({ projectName, outputLanguage: args.language }), 'utf8');
      consola.success(`Created ${projectYamlPath}`);
    }

    const gitignore = await pathExists(gitignorePath) ? await readFile(gitignorePath, 'utf8') : '';
    if (!gitignore.split(/\r?\n/).includes('.worktrees/'))
      await appendFile(gitignorePath, `${gitignore && !gitignore.endsWith('\n') ? '\n' : ''}.worktrees/\n`, 'utf8');

    consola.info(`Ensured ${docsRoot}`);
    consola.info(`Ensured ${prdRoot}`);
    consola.info(`Ensured ${runsRoot}`);
    consola.info(`Ensured ${worktreesRoot}`);
    outro('VibeRig project scaffold is ready.');
  },
});
