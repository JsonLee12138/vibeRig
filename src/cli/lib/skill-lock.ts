import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { z } from 'zod'

export const STORE = join(homedir(), '.vb-skills')
export const LOCK_PATH = join(STORE, 'vb-skill-lock.json')

const skillLockSchema = z.object({
  skills: z.record(z.string(), z.object({
    skillPath: z.string(),
    computedHash: z.string(),
  })),
})

export type SkillLock = z.infer<typeof skillLockSchema>

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      out.push(...walk(full))
    else
      out.push(full)
  }
  return out
}

export function skillDirPath(skillName: string): string {
  return join(STORE, skillName)
}

export function isDir(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

/** SHA-256 over every file in a skill directory, sorted by relative path — stable regardless of walk order. */
export function hashSkillDir(skillDir: string): string {
  const manifestParts = walk(skillDir).map((full) => {
    const rel = relative(skillDir, full)
    return `${rel}:${sha256(readFileSync(full))}`
  })
  manifestParts.sort()
  return `sha256:${sha256(manifestParts.join('\n'))}`
}

export function readSkillLock(): SkillLock {
  if (!existsSync(LOCK_PATH))
    throw new Error(`lock file not found: ${LOCK_PATH}`)
  return skillLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, 'utf-8')))
}

export function writeSkillLock(lock: SkillLock): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`)
}
