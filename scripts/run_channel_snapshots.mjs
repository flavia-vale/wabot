#!/usr/bin/env node
// Cron job: captura ChannelSnapshot de todos os canais-destino ativos.
// Pensado para rodar 1x/dia (03:00 BRT), depois do backup_prod.sh.
//
// Uso (PM2):
//   pm2 start ecosystem.config.cjs --only snapshot-cron
//
// Uso (cron manual):
//   0 3 * * * cd /home/deploy/wabot && node scripts/run_channel_snapshots.mjs
//
// Tolerante a falhas: usuários sem sessão WA ativa contam como skipped.
// Saída é JSON em stderr para consumo por log aggregator.

import db from '../src/db.js'
import { captureAllForUser } from '../src/jobs/channelSnapshot.js'
import { isRunning } from '../src/manager.js'

async function main() {
  const started = Date.now()
  const stats = { users: 0, captured: 0, skipped: 0, errors: 0 }

  const users = await db.user.findMany({
    where: { status: 'active' },
    select: { id: true },
  })
  stats.users = users.length

  for (const u of users) {
    if (!isRunning(u.id)) {
      stats.skipped++
      continue
    }
    try {
      const r = await captureAllForUser(u.id)
      stats.captured += r.captured
      stats.skipped += r.skipped
    } catch (err) {
      stats.errors++
      process.stderr.write(JSON.stringify({ level: 'error', userId: u.id, err: err.message }) + '\n')
    }
  }

  const durationMs = Date.now() - started
  process.stderr.write(JSON.stringify({ level: 'info', msg: 'channel_snapshot_cron_done', durationMs, ...stats }) + '\n')
  await db.$disconnect()
}

main().then(() => process.exit(0)).catch((err) => {
  process.stderr.write(JSON.stringify({ level: 'fatal', err: err.message, stack: err.stack }) + '\n')
  process.exit(1)
})
