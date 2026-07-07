import { defineCommand } from 'citty'
import { consola } from 'consola'

import { runLinearNativePlanAudit } from '../lib/audit-linear-native-plan.js'

export const auditCommand = defineCommand({
  meta: {
    name: 'audit-linear-native-plan',
    description: 'Audit the repository against the Linear-native VibeRig redesign plan.',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Repository root to audit.',
      default: '.',
    },
  },
  run({ args }) {
    const { checks, failed } = runLinearNativePlanAudit(args.cwd)
    for (const check of checks)
      consola.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.evidence}`)

    if (failed.length > 0) {
      consola.error(`${failed.length} check(s) failed.`)
      process.exit(1)
    }

    consola.success('Linear-native redesign local audit passed.')
    consola.info('External Linear API effects are governed by the Linear skill/plugin and require an authenticated Codex session.')
  },
})
