#!/usr/bin/env node
/**
 * Diagnóstico: por que o código de acesso do Mercado Livre de um cliente vence
 * tantas vezes?
 *
 * A pergunta que este script responde com DADO, e não com suposição, é:
 * a recusa do ML foi só com ESSE cliente (problema da credencial dele) ou
 * atingiu vários clientes na MESMA janela de horário (problema do nosso IP /
 * do lado do ML)? Essa distinção muda completamente a correção.
 *
 * Mostra, por hora (horário de Brasília):
 *   A) do cliente: link curto gerado x plano B (recusa) x avisos de código vencido
 *   B) dos DEMAIS clientes com Mercado Livre: os mesmos números, para comparar
 *   C) quando o cliente salvou credencial (evento credential_saved) — mostra se a
 *      recuperação veio de ele recolar o código ou se curou sozinha
 *
 * Read-only: não grava nada, não fala com o Mercado Livre, não imprime credencial.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-ml-ssid-expiry.mjs <email> [--days=7]
 */

import 'dotenv/config'
import db from '../src/db.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const email = process.argv.slice(2).find(a => !a.startsWith('--'))
const days = Number(arg('days', 7))

// Horário de Brasília para a saída ficar comparável com o relato do cliente.
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000
const hourKey = (date) => new Date(date.getTime() + BRT_OFFSET_MS).toISOString().slice(0, 13).replace('T', ' ') + 'h'

const ML_URL = /mercadolivre|mercadolibre|meli\.la/i

function classify(row) {
  if (row.errorMsg === 'warning:ml_ssid_expired') return 'recusa'
  if (/Credencial Mercado Livre inv[aá]lida/i.test(row.errorMsg || '')) return 'recusa'
  if (row.status !== 'success') return null
  if (/meli\.la/i.test(row.convertedUrl || '')) return 'curto'
  if (/partner_id=/i.test(row.convertedUrl || '')) return 'planoB'
  return null
}

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

// Sem e-mail: ranking de quem mais é recusado pelo ML. Serve para achar a conta
// com código de acesso morto há semanas, que fica batendo na API do Mercado
// Livre 24h por dia sem nunca dar certo (desperdício e risco para o nosso IP).
if (!email) {
  const all = await db.messageLog.findMany({
    where: { sentAt: { gte: since } },
    select: { userId: true, sentAt: true, status: true, errorMsg: true, convertedUrl: true, originalUrl: true },
  })
  const perUser = new Map()
  for (const r of all) {
    if (!ML_URL.test(r.convertedUrl || '') && !ML_URL.test(r.originalUrl || '') && !/ml_ssid_expired/.test(r.errorMsg || '')) continue
    const kind = classify(r)
    if (!kind) continue
    if (!perUser.has(r.userId)) perUser.set(r.userId, { curto: 0, planoB: 0, recusa: 0, primeira: r.sentAt, ultima: r.sentAt })
    const u = perUser.get(r.userId)
    u[kind] += 1
    if (kind === 'recusa') {
      if (r.sentAt < u.primeira) u.primeira = r.sentAt
      if (r.sentAt > u.ultima) u.ultima = r.sentAt
    }
  }
  const ranked = [...perUser.entries()].filter(([, u]) => u.recusa > 0).sort((a, b) => b[1].recusa - a[1].recusa)
  const users = await db.user.findMany({ where: { id: { in: ranked.map(([id]) => id) } }, select: { id: true, email: true, name: true } })
  const byId = new Map(users.map(u => [u.id, u]))

  console.log(`\nQuem o Mercado Livre mais recusou nos últimos ${days} dia(s):\n`)
  console.log('recusas  curto  planoB  cliente                                  1a recusa         ultima recusa')
  for (const [id, u] of ranked) {
    const who = byId.get(id)
    console.log(
      `${String(u.recusa).padStart(7)}  ${String(u.curto).padStart(5)}  ${String(u.planoB).padStart(6)}  ` +
      `${(who?.email || id).padEnd(38)}  ${u.primeira.toISOString().slice(0, 16)}  ${u.ultima.toISOString().slice(0, 16)}`,
    )
  }
  console.log('\nRecusa espalhada por muitos dias = código de acesso morto e nunca recadastrado:')
  console.log('essa conta bate na API do ML o dia inteiro sem nunca dar certo. Vale avisar o cliente.\n')
  await db.$disconnect()
  process.exit(0)
}

const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, createdAt: true } })
if (!user) {
  console.error(`Cliente não encontrado: ${email}`)
  process.exit(1)
}

const rows = await db.messageLog.findMany({
  where: { sentAt: { gte: since } },
  select: { userId: true, sentAt: true, status: true, errorMsg: true, convertedUrl: true, originalUrl: true },
})

const mlRows = rows.filter(r => ML_URL.test(r.convertedUrl || '') || ML_URL.test(r.originalUrl || '') || /ml_ssid_expired/.test(r.errorMsg || ''))

const buckets = new Map() // hora -> { dele:{...}, outros:{...}, outrosUsers:Set }
const bump = (hour, scope, kind, userId) => {
  if (!buckets.has(hour)) {
    buckets.set(hour, {
      dele: { curto: 0, planoB: 0, recusa: 0 },
      outros: { curto: 0, planoB: 0, recusa: 0 },
      outrosRecusaUsers: new Set(),
      outrosUsers: new Set(),
    })
  }
  const b = buckets.get(hour)
  b[scope][kind] += 1
  if (scope === 'outros') {
    b.outrosUsers.add(userId)
    if (kind === 'recusa') b.outrosRecusaUsers.add(userId)
  }
}

for (const r of mlRows) {
  const kind = classify(r)
  if (!kind) continue
  bump(hourKey(r.sentAt), r.userId === user.id ? 'dele' : 'outros', kind, r.userId)
}

console.log(`\nCliente: ${user.name} <${user.email}>  (cadastro em ${user.createdAt.toISOString().slice(0, 10)})`)
console.log(`Janela: últimos ${days} dia(s). Horários em Brasília (UTC-3).\n`)

console.log('                        ---- ESSE CLIENTE ----   ---- DEMAIS CLIENTES ----')
console.log('hora (BRT)              curto  planoB  recusa    curto  planoB  recusa  (clientes recusados / ativos)')
for (const hour of [...buckets.keys()].sort()) {
  const b = buckets.get(hour)
  const d = b.dele
  const o = b.outros
  if (d.curto + d.planoB + d.recusa === 0) continue
  const flag = d.recusa > 0 && o.recusa === 0 ? '  <== só ele' : ''
  console.log(
    `${hour}   ${String(d.curto).padStart(5)}  ${String(d.planoB).padStart(6)}  ${String(d.recusa).padStart(6)}    ` +
    `${String(o.curto).padStart(5)}  ${String(o.planoB).padStart(6)}  ${String(o.recusa).padStart(6)}  ` +
    `(${b.outrosRecusaUsers.size}/${b.outrosUsers.size})${flag}`,
  )
}

console.log('\nLegenda: curto = link curto de afiliado gerado (tudo certo) |')
console.log('         planoB = ML recusou e caiu no link longo | recusa = aviso de código vencido')
console.log('         (clientes recusados / ativos) = quantos OUTROS clientes tiveram recusa naquela hora,')
console.log('         de quantos estavam enviando Mercado Livre. Se for 0/N com N alto e ele estiver')
console.log('         recusando, o problema é da credencial DELE. Se muitos recusam junto, é do lado do ML.\n')

const saves = await db.analyticsEvent.findMany({
  where: { userId: user.id, event: 'credential_saved', createdAt: { gte: since } },
  orderBy: { createdAt: 'asc' },
  select: { createdAt: true, metadata: true },
})
console.log(`Vezes que ele salvou credencial no painel (${saves.length}):`)
for (const s of saves) {
  let plat = ''
  try { plat = JSON.parse(s.metadata || '{}').platform || '' } catch { /* ignore */ }
  console.log(`  ${hourKey(s.createdAt)}  ${new Date(s.createdAt.getTime() + BRT_OFFSET_MS).toISOString().slice(11, 19)}  ${plat}`)
}
if (saves.length === 0) console.log('  (nenhum registro na janela — a credencial não foi recolada por ele aqui)')

console.log()
await db.$disconnect()
