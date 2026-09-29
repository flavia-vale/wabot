// Diagnóstico read-only do Sprint 0 do TikTok Shop.
//
// O banco atual preserva a demanda total de lojas ainda não suportadas apenas
// de forma agregada por domínio. MessageLog pode complementar formato/cliente,
// mas não guarda o link TikTok removido antes do envio. Por isso o relatório
// separa explicitamente "demanda registrada" de "amostra observável" e nunca
// apresenta a segunda como se fosse o total.
//
// Uso (na VPS, dentro do diretório do ambiente):
//   node scripts/diag-tiktok-links.mjs
//   node scripts/diag-tiktok-links.mjs --dias 30
//
// Nada é escrito. URLs, textos, grupos, e-mails e IDs de produto não saem no
// relatório. A conta é representada por um hash curto, estável só neste script.

import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const EVENT = 'ops_unsupported_store_daily'
const TIKTOK_DOMAIN = 'tiktok.com'
const URL_RE = /(?:https?:\/\/)?(?:www\.|shop\.)?(?:vt\.|vm\.)?tiktok\.com\/[^\s<>()\[\]{}"']*/gi

export function classifyTiktokUrl(raw) {
  const input = String(raw || '').trim()
  if (!input) return null
  let url
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') return 'curto_ambiguo'
  if (host !== 'tiktok.com' && host !== 'shop.tiktok.com') return null
  const path = url.pathname.toLowerCase()
  if (/^\/(?:view\/)?product\/[^/]+/.test(path)) return 'produto'
  if (/^\/@[^/]+\/video\/[^/]+/.test(path) || /^\/video\/[^/]+/.test(path)) return 'video'
  if (/^\/(?:shop|mall|campaign|promotion)(?:\/|$)/.test(path)) return 'vitrine_campanha'
  if (/^\/@[^/]+(?:\/|$)/.test(path)) return 'perfil'
  return 'outro'
}

export function extractTiktokShapes(row) {
  const combined = [row.originalUrl, row.convertedUrl, row.messageText].filter(Boolean).join('\n')
  const seen = new Set()
  const shapes = []
  for (const match of combined.matchAll(URL_RE)) {
    const kind = classifyTiktokUrl(match[0])
    if (kind && !seen.has(kind)) {
      seen.add(kind)
      shapes.push(kind)
    }
  }
  return shapes
}

export function anonymizeUser(userId) {
  return `conta-${createHash('sha256').update(`tiktok-s0:${userId}`).digest('hex').slice(0, 8)}`
}

function parseMetadata(metadata) {
  try { return JSON.parse(metadata || '{}') } catch { return {} }
}

function readArgs(argv) {
  const at = argv.indexOf('--dias')
  const raw = at >= 0 ? argv[at + 1] : '30'
  const days = Number(raw)
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new Error('--dias deve ser um inteiro entre 1 e 30')
  }
  return { days }
}

export async function buildTiktokReport(db, { days = 30, now = Date.now() } = {}) {
  const since = new Date(now - days * 864e5)
  const [events, rows] = await Promise.all([
    db.analyticsEvent.findMany({
      where: { event: EVENT, createdAt: { gte: since } },
      select: { metadata: true },
      take: 5000,
    }),
    db.messageLog.findMany({
      where: {
        sentAt: { gte: since },
        OR: [
          { originalUrl: { contains: 'tiktok.com' } },
          { convertedUrl: { contains: 'tiktok.com' } },
          { messageText: { contains: 'tiktok.com' } },
        ],
      },
      select: { userId: true, originalUrl: true, convertedUrl: true, messageText: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
      take: 5000,
    }),
  ])

  let demandTotal = 0
  for (const event of events) {
    const data = parseMetadata(event.metadata)
    if (data.domain === TIKTOK_DOMAIN && Number(data.count) > 0) demandTotal += Number(data.count)
  }

  const byKind = new Map()
  const byUser = new Map()
  const samples = []
  for (const row of rows) {
    const kinds = extractTiktokShapes(row)
    if (!kinds.length) continue
    const user = anonymizeUser(row.userId)
    byUser.set(user, (byUser.get(user) || 0) + 1)
    for (const kind of kinds) byKind.set(kind, (byKind.get(kind) || 0) + 1)
    if (samples.length < 20) {
      samples.push({ day: row.sentAt.toISOString().slice(0, 10), user, formats: kinds })
    }
  }

  return { days, demandTotal, observableRows: rows.length, byKind, byUser, samples }
}

export function printTiktokReport(report, out = console.log) {
  out(`TikTok Shop — descoberta dos últimos ${report.days} dia(s)`)
  out(`Demanda registrada (tiktok.com): ${report.demandTotal} mensagem(ns)`)
  out('')
  out('Amostra observável no MessageLog (não é o total de recebidas)')
  out(`Linhas: ${report.observableRows}`)
  if (!report.observableRows) out('Nenhuma. O link de loja não suportada é removido antes do MessageLog.')
  for (const [kind, count] of [...report.byKind].sort((a, b) => b[1] - a[1])) out(`  ${kind}: ${count}`)
  out('')
  out('Por cliente anonimizada (somente amostra observável)')
  if (!report.byUser.size) out('  sem dados')
  for (const [user, count] of [...report.byUser].sort((a, b) => b[1] - a[1])) out(`  ${user}: ${count}`)
  out('')
  out('Até 20 amostras anonimizadas (sem URL, texto ou ID de produto)')
  if (!report.samples.length) out('  sem dados')
  for (const sample of report.samples) out(`  ${sample.day} | ${sample.user} | ${sample.formats.join(',')}`)
  out('')
  out('Gate H2/H3: INCONCLUSIVO se a amostra observável não cobrir a demanda registrada.')
  out('O banco atual agrega tiktok.com e não preserva host/caminho do link removido.')
}

async function main() {
  const { days } = readArgs(process.argv.slice(2))
  const { default: db } = await import('../src/db.js')
  try {
    printTiktokReport(await buildTiktokReport(db, { days }))
  } finally {
    await db.$disconnect().catch(() => {})
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Falha ao ler o diagnóstico TikTok:', err?.message || err)
    process.exitCode = 1
  })
}
