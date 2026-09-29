#!/usr/bin/env node
/**
 * Diagnóstico: QUANTO TEMPO cada código de acesso do Mercado Livre viveu, por
 * conta — medido só pelo banco (MessageLog), sem tocar no ML.
 *
 * Pergunta que ele responde: o código morre num tempo FIXO (~75–95 min em toda
 * conta, independente de volume e hora) ou morre em tempos espalhados (o que
 * apontaria para uso do ML no navegador da cliente, volume de chamadas etc.)?
 *
 * Como mede: para cada conta, ordena os envios do ML por data e separa
 * "gerações" do código: uma geração começa no 1º link curto (meli.la) depois de
 * uma recusa (`ml_ssid_expired`) e termina na 1ª recusa depois desse link curto.
 *   - vida mínima = último link curto − 1º link curto (o robô só registra
 *     quando há oferta; a morte real é DEPOIS do último curto)
 *   - vida máxima = 1ª recusa − 1º link curto
 *   - o momento da colagem fica entre a última recusa anterior e o 1º curto
 *     (a tabela Credential não tem updatedAt).
 *
 * Read-only: não grava nada, não chama o ML, não imprime código de acesso.
 *
 * Uso:
 *   cd ~/wabot && node scripts/diag-ml-vida-codigo.mjs [--days=7] [--email=x@y] [--min-curtos=3]
 */

import 'dotenv/config'
import db from '../src/db.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const days = Number(arg('days', 7))
const email = arg('email', null)
const minCurtos = Number(arg('min-curtos', 3))
const TZ_OFFSET_MIN = Number(arg('tz', -180)) // -3h (Brasília) por padrão
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

function local(d) {
  const t = new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000)
  return t.toISOString().slice(5, 16).replace('T', ' ')
}
function minutes(a, b) { return Math.round((b.getTime() - a.getTime()) / 60000) }

function classify(row) {
  const motivo = String(row.errorMsg || '')
  if (/ml_ssid_expired/.test(motivo)) return 'recusa'
  if (/meli\.la/i.test(String(row.convertedUrl || ''))) return 'curto'
  return null // comprido sem recusa explícita, vazio, skip etc. — não decide nada
}

// Separa a sequência (já ordenada) em gerações do código.
export function splitGenerations(events) {
  const gens = []
  let cur = null
  let lastRecusaBefore = null
  for (const ev of events) {
    if (ev.kind === 'curto') {
      if (!cur) cur = { first: ev.at, last: ev.at, curtos: 0, recusaAntes: lastRecusaBefore, recusaDepois: null }
      cur.last = ev.at
      cur.curtos++
    } else if (ev.kind === 'recusa') {
      if (cur) {
        cur.recusaDepois = ev.at
        gens.push(cur)
        cur = null
      }
      lastRecusaBefore = ev.at
    }
  }
  if (cur) gens.push(cur) // ainda viva no fim da janela
  return gens
}

const where = { sentAt: { gte: since }, platform: { contains: 'mercadolivre' } }
if (email) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) { console.error(`Usuário não encontrado: ${email}`); process.exit(2) }
  where.userId = user.id
}

const rows = await db.messageLog.findMany({
  where,
  select: { userId: true, sentAt: true, errorMsg: true, convertedUrl: true },
  orderBy: { sentAt: 'asc' },
  take: 300000,
})

const porConta = new Map()
for (const r of rows) {
  const kind = classify(r)
  if (!kind) continue
  if (!porConta.has(r.userId)) porConta.set(r.userId, [])
  porConta.get(r.userId).push({ at: r.sentAt, kind })
}

const users = await db.user.findMany({
  where: { id: { in: [...porConta.keys()] } },
  select: { id: true, email: true, name: true },
})
const nome = new Map(users.map(u => [u.id, `${u.name} <${u.email}>`]))

console.log(`\n=== Vida do código de acesso do ML por conta — últimos ${days} dia(s), horário local (${TZ_OFFSET_MIN / 60}h) ===`)
console.log('vida = do 1º link curto até o último curto (mínima) / até a 1ª recusa (máxima). curtos/h = volume de chamadas na geração.\n')

const todas = []
for (const [userId, events] of porConta) {
  const gens = splitGenerations(events).filter(g => g.curtos >= minCurtos)
  if (!gens.length) continue
  console.log(`${nome.get(userId) || userId}`)
  for (const g of gens) {
    const vidaMin = minutes(g.first, g.last)
    const vidaMax = g.recusaDepois ? minutes(g.first, g.recusaDepois) : null
    const horas = Math.max(vidaMin, 1) / 60
    const porHora = (g.curtos / horas).toFixed(1)
    const colagem = g.recusaAntes ? `colou entre ${local(g.recusaAntes)} e ${local(g.first)}` : 'sem recusa antes (início da janela)'
    const fim = g.recusaDepois ? `1ª recusa ${local(g.recusaDepois)} (≤${vidaMax} min)` : 'AINDA VIVA no fim da janela'
    console.log(`  ${local(g.first)} → ${local(g.last)}  vida ≥${String(vidaMin).padStart(4)} min | ${fim} | curtos ${String(g.curtos).padStart(4)} (${porHora}/h) | ${colagem}`)
    todas.push({ userId, vidaMin, vidaMax, curtos: g.curtos, porHora: Number(porHora), viva: !g.recusaDepois })
  }
}

const mortas = todas.filter(t => !t.viva)
if (mortas.length) {
  const sorted = mortas.map(t => t.vidaMin).sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  console.log(`\n--- Resumo (${mortas.length} gerações mortas, ${todas.length - mortas.length} vivas, ${new Set(todas.map(t => t.userId)).size} contas) ---`)
  console.log(`vida mínima: menor ${sorted[0]} min | mediana ${med} min | maior ${sorted[sorted.length - 1]} min`)
  const buckets = [['baixo volume (<10 curtos/h)', t => t.porHora < 10], ['médio (10–40/h)', t => t.porHora >= 10 && t.porHora < 40], ['alto (≥40/h)', t => t.porHora >= 40]]
  for (const [label, fn] of buckets) {
    const b = mortas.filter(fn).map(t => t.vidaMin).sort((a, b) => a - b)
    if (!b.length) continue
    console.log(`  ${label.padEnd(30)} n=${b.length} | mediana ${b[Math.floor(b.length / 2)]} min | faixa ${b[0]}–${b[b.length - 1]} min`)
  }
  console.log('\nComo ler: mediana parecida em todos os volumes e faixa estreita (ex.: 60–100 min) = prazo FIXO do ML (hipótese H1/H6).')
  console.log('Faixa larga (ex.: 10–600 min) sem relação com volume = algo externo (navegador da cliente, H2). Vida menor no alto volume = H4.')
} else {
  console.log('\nNenhuma geração morta com pelo menos', minCurtos, 'links curtos na janela.')
}

await db.$disconnect()
