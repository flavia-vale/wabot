// Amostra horária do total de membros dos grupos-destino (painel "Membros").
// Custo: 1 chamada `listGroups` (groupFetchAllParticipating) por sessão por
// hora — a mesma que o painel já faz ao listar grupos. Só grava quantidade.

import defaultDb from '../db.js'
import { listGroups as defaultListGroups } from '../manager.js'
import { pruneMemberSampleIds } from '../core/groupMemberStats.js'
import { canUseGroupMembers } from '../billing/plans.js'
import { MEASURABLE_MAX_AGE_MS, isHotLink } from '../core/smartLinkOccupancy.js'
import { isValidInviteCode } from '../core/smartLinkPicker.js'
import { isSmartLinkOwnerEligible } from '../core/smartLinkAccess.js'
import { isRunning as defaultIsRunning } from '../manager.js'

export function normalizeSize(size) {
  // 0 é impossível (o próprio robô é membro): vem de resposta truncada do
  // WhatsApp. Gravar 0 faria o grupo parecer vazio e receber TODO o tráfego.
  return Number.isInteger(size) && size >= 1 ? size : null
}

/**
 * @returns {Promise<{ captured: number, skipped: number }>}
 * `skipped` = grupo sem tamanho no retorno (worker antigo, ainda sem `size`).
 */
export async function captureMemberSamplesForUser(userId, { db = defaultDb, listGroups = defaultListGroups, now = new Date() } = {}) {
  const groups = await db.group.findMany({
    where: { userId, role: 'post', kind: 'group' },
    select: { id: true, waJid: true },
  })
  if (groups.length === 0) return { captured: 0, skipped: 0 }

  const live = await listGroups(userId)
  const sizeByJid = new Map((Array.isArray(live) ? live : []).map(g => [g.waJid, normalizeSize(g.size)]))

  let captured = 0
  let skipped = 0
  for (const group of groups) {
    const size = sizeByJid.get(group.waJid) ?? null
    if (size == null) { skipped++; continue }
    await db.groupMemberSample.create({ data: { groupId: group.id, size, sampledAt: now } })
    captured++

    const all = await db.groupMemberSample.findMany({
      where: { groupId: group.id },
      select: { id: true, sampledAt: true },
    })
    const toDelete = pruneMemberSampleIds(all, now)
    if (toDelete.length) await db.groupMemberSample.deleteMany({ where: { groupId: group.id, id: { in: toDelete } } })
  }
  return { captured, skipped }
}

/**
 * Passada horária sobre todos os usuários elegíveis (PRO/Trial com sessão viva).
 * Roda DENTRO da API: em modo `inline` só o processo da API enxerga as sessões
 * (um processo PM2 separado via `users:0`, RCA 2026-09-30). `isRunning` é
 * assíncrono no modo `remote`, por isso o `await`.
 * Espaça as sessões (`pauseMs`) — nunca rajada de consultas ao WhatsApp.
 */
export async function runGroupMemberSampleSweep({ db = defaultDb, isRunning = defaultIsRunning, listGroups = defaultListGroups, now = new Date(), pauseMs = 2000, logger } = {}) {
  const stats = { users: 0, captured: 0, skipped: 0, errors: 0 }
  const users = await db.user.findMany({
    where: { status: 'active' },
    select: { id: true, plan: true, accessExpiresAt: true },
  })
  for (const u of users) {
    if (!canUseGroupMembers(u)) continue
    let running = false
    try { running = Boolean(await isRunning(u.id)) } catch { running = false }
    if (!running) continue
    stats.users++
    try {
      const r = await captureMemberSamplesForUser(u.id, { db, listGroups, now })
      stats.captured += r.captured
      stats.skipped += r.skipped
    } catch (err) {
      stats.errors++
      logger?.warn?.({ userId: u.id, err: err.message }, 'amostra de membros falhou')
    }
    if (pauseMs > 0) await new Promise(resolve => setTimeout(resolve, pauseMs))
  }
  return stats
}

/**
 * Medição adaptativa do Link Inteligente: quem tem grupo com mais de 80% da
 * capacidade é medido a cada poucos minutos (não de hora em hora), para a troca
 * de grupo na margem de 95% não ficar cega por até 60 min. Só esses usuários, só
 * com sessão viva, e 1 consulta (`listGroups`) por usuário por passada, com
 * pausa entre eles (anti-ban). O caminho comum segue sendo a passada horária.
 *
 * @returns {Promise<{ users: number, captured: number, skipped: number, errors: number }>}
 */
export async function runHotSampleSweep({ db = defaultDb, isRunning = defaultIsRunning, listGroups = defaultListGroups, now = new Date(), pauseMs = 2000, logger } = {}) {
  const stats = { users: 0, captured: 0, skipped: 0, errors: 0 }
  const links = await db.smartLink.findMany({
    where: { enabled: true, deletedAt: null },
    select: {
      userId: true,
      capPerGroup: true,
      user: { select: { plan: true, accessExpiresAt: true, status: true } },
      groups: {
        select: {
          enabled: true,
          inviteCode: true,
          group: { select: { memberSamples: { orderBy: { sampledAt: 'desc' }, take: 1, select: { size: true, sampledAt: true } } } },
        },
      },
    },
  })

  const hotUsers = new Set()
  for (const link of links) {
    if (hotUsers.has(link.userId) || link.user?.status !== 'active' || !isSmartLinkOwnerEligible(link.user, now)) continue
    const groups = link.groups.map(g => {
      const sample = g.group?.memberSamples?.[0] ?? null
      const ageMs = sample ? now.getTime() - new Date(sample.sampledAt).getTime() : Infinity
      return { size: sample?.size ?? null, enabled: g.enabled, hasInvite: isValidInviteCode(g.inviteCode), measurable: ageMs <= MEASURABLE_MAX_AGE_MS }
    })
    if (isHotLink(groups, link.capPerGroup)) hotUsers.add(link.userId)
  }

  for (const userId of hotUsers) {
    let running = false
    try { running = Boolean(await isRunning(userId)) } catch { running = false }
    if (!running) continue
    stats.users++
    try {
      const r = await captureMemberSamplesForUser(userId, { db, listGroups, now })
      stats.captured += r.captured
      stats.skipped += r.skipped
    } catch (err) {
      stats.errors++
      logger?.warn?.({ userId, err: err.message }, 'medição adaptativa falhou')
    }
    if (pauseMs > 0) await new Promise(resolve => setTimeout(resolve, pauseMs))
  }
  return stats
}
