#!/usr/bin/env node
// Cron horário: grava a amostra de membros dos grupos-destino (painel Membros).
// PM2: app `group-member-samples` (cron_restart a cada hora, roda 1x e sai).
// Só usuários PRO/Trial com sessão WhatsApp rodando; tolera falha por usuário.

import db from '../src/db.js'
import { isRunning } from '../src/manager.js'
import { canUseGroupMembers } from '../src/billing/plans.js'
import { captureMemberSamplesForUser } from '../src/jobs/groupMemberSamples.js'

const PAUSE_BETWEEN_USERS_MS = 2000

async function main() {
  const started = Date.now()
  const stats = { users: 0, captured: 0, skipped: 0, errors: 0 }
  const users = await db.user.findMany({
    where: { status: 'active' },
    select: { id: true, plan: true, accessExpiresAt: true },
  })
  for (const u of users) {
    if (!canUseGroupMembers(u) || !isRunning(u.id)) continue
    stats.users++
    try {
      const r = await captureMemberSamplesForUser(u.id)
      stats.captured += r.captured
      stats.skipped += r.skipped
    } catch (err) {
      stats.errors++
      process.stderr.write(JSON.stringify({ level: 'error', userId: u.id, err: err.message }) + '\n')
    }
    // Espaça as sessões: nunca rajada de consultas ao WhatsApp (anti-ban).
    await new Promise(r => setTimeout(r, PAUSE_BETWEEN_USERS_MS))
  }
  process.stderr.write(JSON.stringify({ level: 'info', job: 'group-member-samples', durationMs: Date.now() - started, ...stats }) + '\n')
  await db.$disconnect()
}

main().then(() => process.exit(0)).catch(err => {
  process.stderr.write(JSON.stringify({ level: 'error', err: err.message }) + '\n')
  process.exit(1)
})
