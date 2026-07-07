#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'

import { auditCommand } from './commands/audit.js'
import { initCommand } from './commands/init.js'
import { skillLockCommand } from './commands/skill-lock.js'

const main = defineCommand({
  meta: {
    name: 'viberig',
    version: '0.2.7',
    description: 'VibeRig project workflow CLI',
  },
  subCommands: {
    init: initCommand,
    'skill-lock': skillLockCommand,
    'audit-linear-native-plan': auditCommand,
  },
})

runMain(main)
