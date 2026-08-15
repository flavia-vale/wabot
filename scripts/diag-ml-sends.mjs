#!/usr/bin/env node
/**
 * Diagnóstico: para onde estão indo os links de Mercado Livre de UM cliente.
 *
 * Lê `MessageLog` (read-only, não grava nada) e mostra, para cada envio de ML,
 * o link ORIGINAL que chegou do grupo monitorado e o link CONVERTIDO que o robô
 * publicou — classificando o formato do link convertido, que é o que decide em
 * qual página o cliente cai ao tocar na oferta:
 *
 *   meli_la          -> short link de afiliado gerado pela API do ML (esperado)
 *   catalogo_p       -> www.mercadolivre.com.br/p/MLB... (fallback partner_id, ok)
 *   listing_fabricado-> produto.mercadolivre.com.br/MLB<id>-x-_JM  (⚠ endereço
 *                       montado por nós, com slug inventado "-x-" e sem hífen
 *                       depois de MLB — já respondeu 404 em produção)
 *   listing_real     -> produto.mercadolivre.com.br/MLB-<id>-<nome>-_JM
 *   vitrine_social   -> /social/<handle> (vitrine/perfil, NÃO é um produto)
 *   cupom_generico   -> página do ML sem MLB nenhum (home, /ofertas, /cupom)
 *   nao_ml           -> link convertido que nem é do ML
 *
 * Não imprime segredo, cookie nem credencial. Só mostra e-mail se você passar.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-ml-sends.mjs <email> [--days=7] [--limit=40]
 *   cd ~/wabot-staging && node scripts/diag-ml-sends.mjs <email>
 */

import 'dotenv/config'
import db from '../src/db.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const email = process.argv.slice(2).find(a => !a.startsWith('--'))
const days = Number(arg('days', 7))
const limit = Number(arg('limit', 40))

if (!email) {
  console.error('Uso: node scripts/diag-ml-sends.mjs <email> [--days=7] [--limit=40]')
  process.exit(1)
}

const ML_HOST = /(^|\.)(mercadolivre\.com\.br|mercadolibre\.com|meli\.la|mlurl\.io)$/i

function isMlUrl(raw) {
  try {
    return ML_HOST.test(new URL(String(raw)).hostname)
  } catch {
    return /mercadolivre|mercadolibre|meli\.la/i.test(String(raw || ''))
  }
}

function classify(raw) {
  let u
  try {
    u = new URL(String(raw))
  } catch {
    return 'sem_url'
  }
  const host = u.hostname.toLowerCase()
  const path = u.pathname
  if (/(^|\.)meli\.la$/i.test(host) || /^\/sec\//i.test(path)) return 'meli_la'
  if (!ML_HOST.test(host)) return 'nao_ml'
  if (/^\/social\//i.test(path)) return 'vitrine_social'
  if (/^\/p\/MLB[0-9]+/i.test(path)) return 'catalogo_p'
  if (/^\/MLB[0-9]+-x-_JM$/i.test(path)) return 'listing_fabricado'
  if (/^\/MLB-[0-9]+-.+-_JM$/i.test(path)) return 'listing_real'
  if (/MLB[-_]?[0-9]{6,}/i.test(path)) return 'outro_com_mlb'
  return 'cupom_generico'
}

const SUSPEITOS = new Set(['listing_fabricado', 'vitrine_social', 'cupom_generico', 'sem_url', 'nao_ml'])

const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } })
if (!user) {
  console.error(`Usuário não encontrado: ${email}`)
  process.exit(1)
}

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
const rows = await db.messageLog.findMany({
  where: { userId: user.id, sentAt: { gte: since } },
  orderBy: { sentAt: 'desc' },
  select: {
    sentAt: true, status: true, errorMsg: true, platform: true,
    originalUrl: true, convertedUrl: true, destGroup: true,
  },
  take: 2000,
})

const mlRows = rows.filter(r => isMlUrl(r.convertedUrl) || isMlUrl(r.originalUrl) || /mercado/i.test(r.platform || ''))

console.log(`\nCliente: ${user.email}`)
console.log(`Janela: últimos ${days} dia(s)  |  envios totais: ${rows.length}  |  envios de ML: ${mlRows.length}\n`)

const tally = new Map()
for (const r of mlRows) {
  const kind = classify(r.convertedUrl)
  tally.set(kind, (tally.get(kind) || 0) + 1)
}

console.log('Formato do link publicado (o que o cliente toca):')
for (const [kind, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
  const pct = mlRows.length ? Math.round((count / mlRows.length) * 100) : 0
  console.log(`  ${SUSPEITOS.has(kind) ? '⚠' : ' '} ${kind.padEnd(18)} ${String(count).padStart(4)}  (${pct}%)`)
}

const statusTally = new Map()
for (const r of mlRows) {
  const key = `${r.status}${r.errorMsg ? ` | ${r.errorMsg}` : ''}`
  statusTally.set(key, (statusTally.get(key) || 0) + 1)
}
console.log('\nStatus / motivo:')
for (const [key, count] of [...statusTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(count).padStart(4)}  ${key}`)
}

console.log(`\nÚltimos ${Math.min(limit, mlRows.length)} envios de ML:\n`)
for (const r of mlRows.slice(0, limit)) {
  const kind = classify(r.convertedUrl)
  console.log(`${r.sentAt.toISOString()}  ${SUSPEITOS.has(kind) ? '⚠' : ' '} ${kind}  [${r.status}${r.errorMsg ? `: ${r.errorMsg}` : ''}]`)
  console.log(`   original : ${r.originalUrl || '-'}`)
  console.log(`   publicado: ${r.convertedUrl || '-'}\n`)
}

await db.$disconnect()
