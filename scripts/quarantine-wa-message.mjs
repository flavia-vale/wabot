#!/usr/bin/env node
import 'dotenv/config'

import { getAuthInfoDir } from '../src/paths.js'
import { createDurableStuckMessageRetryCache } from '../src/core/stuckMessageQuarantine.js'

const [userId, msgId] = process.argv.slice(2)
if (!userId || !msgId) {
  console.error('Uso: node scripts/quarantine-wa-message.mjs <userId> <msgId>')
  process.exitCode = 1
} else {
  const file = `${getAuthInfoDir(userId)}/stuck-message-quarantine.json`
  const cache = createDurableStuckMessageRetryCache({ file })
  const created = cache.quarantine(msgId)
  console.log(JSON.stringify({ ok: true, userId, msgId, file, created }))
}
