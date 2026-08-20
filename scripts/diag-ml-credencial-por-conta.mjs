#!/usr/bin/env node
/**
 * Diagnóstico: QUAIS contas estão com o código de acesso do Mercado Livre
 * sendo recusado — e há quanto tempo.
 *
 * O `bot.log` mostra a recusa (`"status":401`) mas não diz de quem é: cada bot
 * é um processo, e depois de um restart o pid morre e o rastro se perde. Aqui a
 * conta vem do banco (`MessageLog`), que guarda userId em toda linha.
 *
 * Read-only: não grava nada e não imprime código de acesso nenhum.
 *
 * Uso:
 *   cd ~/wabot && node scripts/diag-ml-credencial-por-conta.mjs [--days=7]
 */

import 'dotenv/config'
import db from '../src/db.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const days = Number(arg('days', 7))
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

const rows = await db.messageLog.findMany({
  where: { sentAt: { gte: since }, platform: { contains: 'mercadolivre' } },
  select: { userId: true, sentAt: true, status: true, errorMsg: true, convertedUrl: true },
  take: 200000,
})

// Sinais que importam, por conta:
//  recusado  -> a loja recusou o código (aviso ml_ssid_expired) ou a conversão
//               voltou vazia ("não retornou link convertido")
//  curto     -> saiu link curto de afiliado (meli.la) = credencial funcionando
//  comprido  -> saiu link com partner_id = plano B (comissão preservada, link feio)
const porConta = new Map()
for (const r of rows) {
  const acc = porConta.get(r.userId) || { total: 0, recusado: 0, curto: 0, comprido: 0, primeiraRecusa: null, ultimaRecusa: null }
  acc.total++
  const motivo = String(r.errorMsg || '')
  const recusado = /ml_ssid_expired/.test(motivo) || /não retornou link convertido/i.test(motivo)
  if (recusado) {
    acc.recusado++
    if (!acc.primeiraRecusa || r.sentAt < acc.primeiraRecusa) acc.primeiraRecusa = r.sentAt
    if (!acc.ultimaRecusa || r.sentAt > acc.ultimaRecusa) acc.ultimaRecusa = r.sentAt
  }
  const url = String(r.convertedUrl || '')
  if (/meli\.la/i.test(url)) acc.curto++
  else if (/partner_id=/i.test(url)) acc.comprido++
  porConta.set(r.userId, acc)
}

const users = await db.user.findMany({
  where: { id: { in: [...porConta.keys()] } },
  select: { id: true, email: true, name: true },
})
const nome = new Map(users.map(u => [u.id, `${u.name} <${u.email}>`]))

console.log(`\n=== Mercado Livre por conta — últimos ${days} dia(s) ===`)
console.log('recusado = a loja recusou o código | curto = meli.la (código vivo) | comprido = plano B\n')

const linhas = [...porConta.entries()].sort((a, b) => b[1].recusado - a[1].recusado)
for (const [userId, acc] of linhas) {
  const pct = acc.total ? Math.round((acc.recusado / acc.total) * 100) : 0
  const alerta = acc.curto === 0 && acc.recusado > 0 ? '⚠ ' : '  '
  console.log(`${alerta}${(nome.get(userId) || userId).padEnd(46)} envios ${String(acc.total).padStart(5)} | recusado ${String(acc.recusado).padStart(5)} (${pct}%) | curto ${String(acc.curto).padStart(5)} | comprido ${String(acc.comprido).padStart(5)}`)
  if (acc.recusado) {
    console.log(`    1ª recusa: ${acc.primeiraRecusa.toISOString().slice(0, 16).replace('T', ' ')}   última: ${acc.ultimaRecusa.toISOString().slice(0, 16).replace('T', ' ')}`)
  }
}

console.log('\n⚠ = nenhuma oferta saiu com link curto na janela: o código dessa conta')
console.log('  provavelmente está morto e ela precisa colar um novo (sem sair da conta do ML depois).')

await db.$disconnect()
