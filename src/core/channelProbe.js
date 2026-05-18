// PR-5.C.3 (parcial): foundation do probe ativo.
//
// Esta implementação cobre:
//   1. recordProbeSeen(groupId) — registra que "alguém" (probe externa ou
//      sessão interna) viu uma mensagem nesse canal.
//   2. runProbeWatchdog() — periódico: se um canal teve post recente mas
//      nenhum probe seen depois disso, marca yellow (shadowban heurístico).
//
// O que NÃO está aqui (deferido):
//   - Spawn de 2ª sessão WA por tenant (multi-session no manager.js).
//   - UI para selecionar conta-probe.
// Sem isso, o watchdog só funciona se houver uma fonte externa de
// `recordProbeSeen` (ex.: cliente roda outra sessão num probe externo
// que bate na API, ou cross-tenant monitor que casualmente vê o canal).
//
// Mesmo sem a 2ª sessão, o watchdog em si já é útil: dá o vocabulário
// (`lastProbeSeenAt`) e a UI para um shadowban detector evoluir.

import defaultDb from '../db.js'

export const PROBE_STALE_WINDOW_MS = 60 * 60 * 1000 // 1h
const NON_OVERRIDABLE = new Set(['red', 'critical'])

/**
 * @param {string} groupId
 * @param {{ db?: any, now?: number }} [opts]
 */
export async function recordProbeSeen(groupId, opts = {}) {
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()
  const seenAt = new Date(now)
  return db.channelHealth.upsert({
    where: { groupId },
    create: { groupId, lastProbeSeenAt: seenAt },
    update: { lastProbeSeenAt: seenAt },
  })
}

function toMs(v) {
  if (v == null) return null
  return v instanceof Date ? v.getTime() : new Date(v).getTime()
}

/**
 * Identifica canais com post recente sem probe correspondente, marca yellow.
 * Conservador: nunca rebaixa para red/critical; nunca sobreescreve red/critical.
 *
 * @param {{ db?: any, now?: number }} [opts]
 * @returns {Promise<{ checked: number, flagged: number }>}
 */
export async function runProbeWatchdog(opts = {}) {
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()

  const channels = await db.group.findMany({
    where: { kind: 'channel', role: 'post' },
    select: { id: true, userId: true },
  })

  let flagged = 0
  for (const ch of channels) {
    const health = await db.channelHealth.findUnique({ where: { groupId: ch.id } })
    if (!health) continue
    if (NON_OVERRIDABLE.has(health.status)) continue

    const lastPostMs = toMs(health.lastPostedAt)
    if (!lastPostMs) continue
    if (now - lastPostMs < PROBE_STALE_WINDOW_MS) continue

    const lastProbeMs = toMs(health.lastProbeSeenAt)
    // Stale se: nunca viu, OU viu antes do último post.
    const stale = lastProbeMs == null || lastProbeMs < lastPostMs
    if (!stale) continue

    if (health.status !== 'yellow') {
      await db.channelHealth.updateMany({
        where: { groupId: { in: [ch.id] } },
        data: { status: 'yellow', lastError: 'probe_watchdog:stale' },
      })
    }
    flagged++
  }

  return { checked: channels.length, flagged }
}
