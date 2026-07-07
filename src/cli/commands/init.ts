import { confirm, intro, isCancel, outro, text } from '@clack/prompts'
import { defineCommand } from 'citty'
import { consola } from 'consola'
import { ensureDir, pathExists } from 'fs-extra/esm'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { cancelPrompt } from '../utils/prompts.js'
import { projectYaml } from '../utils/project-yaml.js'

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
  },
  async run({ args }) {
    const root = resolve(args.cwd)
    const defaultName = root.split('/').filter(Boolean).at(-1) ?? 'project'
    let projectName = args.name

    intro('VibeRig init')

    if (!projectName && !args.yes) {
      const answer = await text({
        message: 'Project name',
        placeholder: defaultName,
        defaultValue: defaultName,
      })

      if (isCancel(answer)) {
        cancelPrompt()
      }

      projectName = typeof answer === 'string' ? answer : defaultName
    }

    projectName ||= defaultName

    if (!args.yes) {
      const answer = await confirm({
        message: `Initialize VibeRig in ${root}?`,
        initialValue: true,
      })

      if (isCancel(answer)) {
        cancelPrompt()
      }

      if (!answer) {
        cancelPrompt('Initialization skipped.')
      }
    }

    const docsRoot = resolve(root, '.vibeRig/requirements')
    const worktreesRoot = resolve(root, '.worktrees')
    const projectYamlPath = resolve(root, '.vibeRig/project.yaml')

    await ensureDir(docsRoot)
    await ensureDir(worktreesRoot)

    if (await pathExists(projectYamlPath)) {
      consola.warn(`${projectYamlPath} already exists; leaving it unchanged.`)
    } else {
      await ensureDir(resolve(root, '.vibeRig'))
      await writeFile(projectYamlPath, projectYaml({ projectName }), 'utf8')
      consola.success(`Created ${projectYamlPath}`)
    }

    consola.info(`Ensured ${docsRoot}`)
    consola.info(`Ensured ${worktreesRoot}`)
    outro('VibeRig project scaffold is ready.')
  },
})
