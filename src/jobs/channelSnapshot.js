// PR-5.F: snapshot diário de newsletterMetadata por canal-destino.
// Paraquedas: se o canal for banido, dá pra recriar e reaplicar nome/desc.
// Retenção: últimos 30 snapshots por canal.

import defaultDb from '../db.js'
import { channelMetadata as defaultGetMetadata } from '../manager.js'

export const SNAPSHOT_RETENTION = 30

export function buildSnapshotData(metadata) {
  return {
    name: metadata?.name ?? null,
    description: metadata?.description ?? null,
    inviteLink: metadata?.inviteLink ?? null,
    snapshotJson: JSON.stringify(metadata ?? {}),
  }
}

/**
 * Recebe lista de snapshots ordenados de qualquer forma e retorna os IDs
 * que excedem o limite de retenção (mantém os N mais recentes).
 */
export function pruneOldSnapshotIds(snapshots, retention = SNAPSHOT_RETENTION) {
  if (!Array.isArray(snapshots) || snapshots.length <= retention) return []
  const sorted = [...snapshots].sort((a, b) => {
    const at = a.snapshotedAt instanceof Date ? a.snapshotedAt.getTime() : new Date(a.snapshotedAt).getTime()
    const bt = b.snapshotedAt instanceof Date ? b.snapshotedAt.getTime() : new Date(b.snapshotedAt).getTime()
    return bt - at
  })
  return sorted.slice(retention).map(s => s.id)
}

/**
 * @param {string} groupId
 * @param {{ db?: any, getMetadata: (userId, opts) => Promise<object|null>, userId?: string, waJid?: string }} opts
 */
export async function captureSnapshot(groupId, opts) {
  const db = opts.db ?? defaultDb
  const getMetadata = opts.getMetadata
  if (!getMetadata) throw new Error('captureSnapshot: getMetadata obrigatório')

  const meta = await getMetadata(opts.userId, { jid: opts.waJid })
  if (!meta) return null

  const row = await db.channelSnapshot.create({
    data: { groupId, ...buildSnapshotData(meta) },
  })

  const all = await db.channelSnapshot.findMany({
    where: { groupId },
    orderBy: { snapshotedAt: 'desc' },
  })
  const toDelete = pruneOldSnapshotIds(all)
  if (toDelete.length) {
    await db.channelSnapshot.deleteMany({ where: { groupId, id: { in: toDelete } } })
  }
  return row
}

/**
 * Captura snapshot de todos os canais-destino de um usuário.
 * @returns {Promise<{ captured: number, skipped: number }>}
 */
export async function captureAllForUser(userId, opts = {}) {
  const db = opts.db ?? defaultDb
  const getMetadata = opts.getMetadata ?? defaultGetMetadata
  const channels = await db.group.findMany({
    where: { userId, role: 'post', kind: 'channel' },
    select: { id: true, waJid: true },
  })
  let captured = 0
  let skipped = 0
  for (const ch of channels) {
    try {
      const row = await captureSnapshot(ch.id, { db, getMetadata, userId, waJid: ch.waJid })
      if (row) captured++; else skipped++
    } catch {
      skipped++
    }
  }
  return { captured, skipped }
}
