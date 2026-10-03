#!/usr/bin/env node
// Vários números por conta (docs/rca/multi-numero.md) — read-only, roda no
// diretório do ambiente.
//
//   cd ~/wabot && node scripts/diag-rodizio.mjs                 # todas as contas com número extra
//   cd ~/wabot && node scripts/diag-rodizio.mjs --email=x@y.com # uma conta
//   cd ~/wabot && node scripts/diag-rodizio.mjs --horas=24      # janela dos envios
//
// Responde: qual número envia, quanto cada número enviou na janela, trocas dos
// últimos 14 dias (e por quê), estado de recepção do número ativo e, com o
// rodízio, quem é o dono de cada grupo; e em quais grupos de origem cada
// número está (Fase 2.1). Só findMany/groupBy — não escreve nada.
import 'dotenv/config'
import db from '../src/db.js'

const args = process.argv.slice(2)
const arg = (name, fallback) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=').slice(1).join('=')
const email = arg('email', '')
const horas = Math.max(1, Number(arg('horas', '24')) || 24)
const desde = new Date(Date.now() - horas * 3600_000)
const desdeTrocas = new Date(Date.now() - 14 * 86400_000)

const where = email ? { email } : { extraNumbers: { gt: 0 } }
const users = await db.user.findMany({
  where,
  select: {
    id: true, email: true, plan: true, extraNumbers: true, activeWaSlot: true, waSlotSwitchedAt: true,
    waSession: { select: { phone: true, status: true, receptionState: true, receptionStateAt: true } },
    waExtraSessions: { select: { slot: true, phone: true, status: true, lifecycle: true, lastHeartbeatAt: true } },
  },
  take: 200,
})
console.log(`contas: ${users.length} | flag MULTI_NUMBER_ENABLED=${process.env.MULTI_NUMBER_ENABLED ?? '(vazia)'} | janela de envios: ${horas}h`)

for (const u of users) {
  const reserva = u.waExtraSessions.find(r => r.slot === 2)
  console.log(`\n== ${u.email} | plano ${u.plan} | extras ${u.extraNumbers} | envia agora: número ${u.activeWaSlot}`)
  console.log(`   ativo:    ${u.waSession?.phone ?? '—'} ${u.waSession?.status ?? '—'} | recepção: ${u.waSession?.receptionState ?? '—'} (${u.waSession?.receptionStateAt?.toISOString?.() ?? 'sem dado'})`)
  console.log(`   reserva:  ${reserva?.phone ?? '—'} ${reserva?.status ?? '—'} ${reserva?.lifecycle ?? ''} | último sinal: ${reserva?.lastHeartbeatAt?.toISOString?.() ?? '—'}`)

  const porNumero = await db.messageLog.groupBy({
    by: ['senderSlot'],
    where: { userId: u.id, status: 'success', sentAt: { gte: desde } },
    _count: { _all: true },
  })
  const linha = porNumero.map(r => `número ${r.senderSlot ?? '?'}=${r._count._all}`).join(' | ') || 'nenhum envio'
  console.log(`   envios (${horas}h): ${linha}  (? = antes do rastreio ou flag desligada)`)

  const trocas = await db.analyticsEvent.findMany({
    where: { userId: u.id, event: 'multi_number_switched', createdAt: { gte: desdeTrocas } },
    select: { createdAt: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  for (const t of trocas) {
    let m = {}
    try { m = JSON.parse(t.metadata) } catch {}
    console.log(`   troca ${t.createdAt.toISOString()}: ${m.from}→${m.to} motivo=${m.reason} (${m.mode})`)
  }
  if (!trocas.length) console.log('   trocas (14 dias): nenhuma')

  // Rodízio (Fase 2): dono de cada grupo e grupos sem nenhum número.
  const rot = await db.user.findUnique({ where: { id: u.id }, select: { rotationEnabled: true } }).catch(() => null)
  const donos = await db.destinationSender.groupBy({ by: ['slot'], where: { userId: u.id }, _count: { _all: true } }).catch(() => [])
  const membros = await db.waGroupMembership.groupBy({ by: ['slot'], where: { userId: u.id }, _count: { _all: true }, _max: { refreshedAt: true } }).catch(() => [])
  console.log(`   rodízio: ${rot?.rotationEnabled ? 'LIGADO' : 'desligado'} (env MULTI_NUMBER_ROTATION_ENABLED=${process.env.MULTI_NUMBER_ROTATION_ENABLED ?? '(vazia)'}, espelhamento=${process.env.MULTI_NUMBER_ROTATION_RELAY ?? '(vazia)'})`)
  console.log(`   donos dos grupos: ${donos.map(d => `${d.slot == null ? 'nenhum número' : 'número ' + d.slot}=${d._count._all}`).join(' | ') || '—'}`)
  console.log(`   grupos por número: ${membros.map(m => `número ${m.slot}=${m._count._all} (gravado ${m._max.refreshedAt?.toISOString?.() ?? '—'})`).join(' | ') || '—'}`)

  // Origens (Fase 2.1): grupo de origem fora do número = para de copiar se ele
  // assumir. Canal só dá para conferir perguntando ao robô (painel).
  const origens = await db.group.findMany({ where: { userId: u.id, role: 'monitor' }, select: { waJid: true, name: true } }).catch(() => [])
  const origemGrupos = [...new Set(origens.map(o => o.waJid).filter(j => j.endsWith('@g.us')))]
  const canais = new Set(origens.map(o => o.waJid).filter(j => j.endsWith('@newsletter'))).size
  for (const slot of [1, 2]) {
    const dele = new Set((await db.waGroupMembership.findMany({ where: { userId: u.id, slot }, select: { waJid: true } }).catch(() => [])).map(r => r.waJid))
    if (!dele.size) { console.log(`   origens número ${slot}: sem pertença gravada`); continue }
    const faltam = origens.filter(o => o.waJid.endsWith('@g.us') && !dele.has(o.waJid))
    const nomes = [...new Map(faltam.map(f => [f.waJid, f.name])).values()].slice(0, 5).join(', ')
    console.log(`   origens número ${slot}: grupos ${origemGrupos.length - new Set(faltam.map(f => f.waJid)).size}/${origemGrupos.length}${faltam.length ? ` (faltam: ${nomes})` : ''} | canais ${canais} (conferir no painel)`)
  }
}

await db.$disconnect()
