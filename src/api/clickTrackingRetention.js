// Retenção do rastreio de cliques (AffiliateClick / AffiliateLink).
//
// Clique vale 90 dias (é telemetria). O link curto vale 180 dias porque
// apagar o AffiliateLink faz o /r/:hash de uma oferta antiga ainda no
// histórico do grupo responder 404 — a folga passa com sobra da vida de
// qualquer promoção. Apagar o link leva os cliques junto (onDelete: Cascade).
//
// Mora em src/api/ de propósito: src/core/ e src/jobs/ estão em
// WORKER_CODE_PATHS_RE (scripts/deploy_safe_dashboard.sh) e mexer lá faz o
// deploy reiniciar o bot-supervisor, reconectando todas as sessões.
// Chamado pela limpeza diária de src/api/server.js (cleanupOldLogs).

import defaultDb from '../db.js'

export const CLICK_RETENTION_DAYS_DEFAULT = 90
export const TRACKED_LINK_RETENTION_DAYS_DEFAULT = 180

const DAY_MS = 24 * 60 * 60 * 1000

function retentionDaysFromEnv(name, fallback) {
  const raw = process.env[name]
  return raw === undefined ? fallback : Number(raw)
}

export async function pruneClickTracking(opts = {}) {
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()
  const clickDays = opts.clickDays ?? retentionDaysFromEnv('CLICK_RETENTION_DAYS', CLICK_RETENTION_DAYS_DEFAULT)
  const linkDays = opts.linkDays ?? retentionDaysFromEnv('TRACKED_LINK_RETENTION_DAYS', TRACKED_LINK_RETENTION_DAYS_DEFAULT)
  const result = { clicks: 0, links: 0 }
  if (Number.isFinite(clickDays) && clickDays > 0) {
    const { count } = await db.affiliateClick.deleteMany({ where: { clickedAt: { lt: new Date(now - clickDays * DAY_MS) } } })
    result.clicks = count
  }
  if (Number.isFinite(linkDays) && linkDays > 0) {
    const { count } = await db.affiliateLink.deleteMany({ where: { createdAt: { lt: new Date(now - linkDays * DAY_MS) } } })
    result.links = count
  }
  return result
}
