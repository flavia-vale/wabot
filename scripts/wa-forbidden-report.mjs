#!/usr/bin/env node
// Relatório de vigilância de desconexões 403/forbidden do WhatsApp por chip.
//
// Lê os eventos duráveis `ops_wa_forbidden` (gravados em AnalyticsEvent pelo
// bot-worker quando o WA recusa a sessão com 403) e cruza com WaSession para
// mostrar telefone e estado atual. 403 costuma vir após flapping prolongado e
// é o sinal mais próximo de restrição/ban do chip — vigiar para agir antes.
//
// Uso:
//   cd ~/wabot && node scripts/wa-forbidden-report.mjs            # últimas 24h
//   cd ~/wabot && node scripts/wa-forbidden-report.mjs --hours 168 # últimos 7d
//
// Observação: os eventos duráveis só existem a partir do deploy que introduziu
// o sinal `ops_wa_forbidden`. Para o histórico anterior, conte os "code":403 no
// bot.log (BOT_LOG_DIR/bot.log).
//
// Saída com código != 0 se algum chip cruzar o limiar de alerta (--alert, default
// 3 em 24h), para encadear em cron/alertas.

import prisma, { ready } from '../src/db.js'

function parseArgs(argv) {
  const out = { hours: 24, alert: 3 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--hours') out.hours = Number(argv[++i]) || 24
    else if (a === '--alert') out.alert = Number(argv[++i]) || 3
  }
  return out
}

async function main() {
  const { hours, alert } = parseArgs(process.argv)
  await ready
  const sinceMs = Date.now() - hours * 60 * 60 * 1000
  const since = new Date(sinceMs)

  const events = await prisma.analyticsEvent.findMany({
    where: { event: 'ops_wa_forbidden', createdAt: { gte: since } },
    select: { userId: true, metadata: true, createdAt: true },
  })

  // Agrega por chip. userId pode vir top-level ou dentro da metadata (compat).
  const byUser = new Map()
  for (const e of events) {
    let userId = e.userId
    if (!userId) {
      try { userId = JSON.parse(e.metadata || '{}').userId || null } catch {}
    }
    const key = userId || '(desconhecido)'
    const entry = byUser.get(key) || { count: 0, last: 0 }
    entry.count += 1
    entry.last = Math.max(entry.last, new Date(e.createdAt).getTime())
    byUser.set(key, entry)
  }

  const userIds = [...byUser.keys()].filter(k => k !== '(desconhecido)')
  const sessions = userIds.length
    ? await prisma.waSession.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, phone: true, status: true, lastDisconnectCode: true },
      })
    : []
  const sessionByUser = new Map(sessions.map(s => [s.userId, s]))

  const rows = [...byUser.entries()]
    .map(([userId, { count, last }]) => {
      const s = sessionByUser.get(userId)
      return {
        userId,
        phone: s?.phone || '—',
        status: s?.status || '—',
        lastCode: s?.lastDisconnectCode || '—',
        count,
        ultimo: last ? new Date(last).toISOString() : '—',
        risco: count >= alert,
      }
    })
    .sort((a, b) => b.count - a.count)

  console.log(`\n=== 403/forbidden por chip — últimas ${hours}h (alerta >= ${alert}) ===`)
  if (rows.length === 0) {
    console.log('Nenhum evento ops_wa_forbidden na janela. 👍 (chips não estão sendo recusados pelo WA)')
  } else {
    console.table(
      rows.map(r => ({
        chip: r.phone,
        userId: r.userId,
        status: r.status,
        ult_code: r.lastCode,
        forbidden: r.count,
        ultimo: r.ultimo,
        ALERTA: r.risco ? '⚠️' : '',
      }))
    )
  }

  const flagged = rows.filter(r => r.risco)
  if (flagged.length) {
    console.log(`\n⚠️  ${flagged.length} chip(s) acima do limiar — investigar antes de virar ban:`)
    for (const r of flagged) console.log(`   - ${r.phone} (${r.userId}): ${r.count}x`)
    console.log('   Ação sugerida: pausar envios desse chip, reduzir cadência, e se persistir, re-parear.')
  }

  await prisma.$disconnect()
  process.exit(flagged.length ? 1 : 0)
}

main().catch(async (err) => {
  console.error('Falha no relatório:', err.message)
  try { await prisma.$disconnect() } catch {}
  process.exit(2)
})
