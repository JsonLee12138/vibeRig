import { defineCommand } from 'citty'
import { consola } from 'consola'

import { hashSkillDir, isDir, readSkillLock, skillDirPath, writeSkillLock } from '../lib/skill-lock.js'

function requireSkillDir(name: string): string {
  const skillDir = skillDirPath(name)
  if (!isDir(skillDir)) {
    consola.error(`skill directory not found: ${skillDir}`)
    process.exit(1)
  }
  return skillDir
}

const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description: 'Add or update one skill entry in ~/.vb-skills/vb-skill-lock.json.',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Skill name under ~/.vb-skills/',
      required: true,
    },
  },
  run({ args }) {
    const skillDir = requireSkillDir(args.name)
    const lock = readSkillLock()
    const computed = hashSkillDir(skillDir)
    lock.skills[args.name] = { skillPath: `${args.name}/SKILL.md`, computedHash: computed }
    writeSkillLock(lock)
    consola.success(`lock updated: ${args.name} → ${computed}`)
  },
})

const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate ~/.vb-skills/vb-skill-lock.json integrity. Exit codes: 0 = ok, 1 = drift/error.',
  },
  run() {
    const lock = readSkillLock()
    const errors: string[] = []

    for (const [name, entry] of Object.entries(lock.skills)) {
      const skillDir = skillDirPath(name)
      if (!isDir(skillDir)) {
        errors.push(`  ${name}: directory missing (${skillDir})`)
        continue
      }
      const actual = hashSkillDir(skillDir)
      if (actual !== entry.computedHash)
        errors.push(`  ${name}: hash mismatch\n    expected ${entry.computedHash}\n    actual   ${actual}`)
    }

    if (errors.length > 0) {
      consola.error('FAIL: skill lock integrity check failed')
      for (const e of errors) consola.error(e)
      process.exit(1)
    }

    consola.success(`OK: ${Object.keys(lock.skills).length} skill(s) verified`)
  },
})

const computeCommand = defineCommand({
  meta: {
    name: 'compute',
    description: 'Print sha256:<hash> for a skill directory.',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Skill name under ~/.vb-skills/',
      required: true,
    },
  },
  run({ args }) {
    const skillDir = requireSkillDir(args.name)
    console.log(hashSkillDir(skillDir))
  },
})

export const skillLockCommand = defineCommand({
  meta: {
    name: 'skill-lock',
    description: 'Manage ~/.vb-skills/vb-skill-lock.json integrity.',
  },
  subCommands: {
    update: updateCommand,
    validate: validateCommand,
    compute: computeCommand,
  },
})
