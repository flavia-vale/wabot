import { categorizeErrorMsg } from './errorTaxonomy.js'

export function normalizeAdminErrorGroupKey(errorMsg) {
  const value = String(errorMsg ?? '').trim()
  if (!value) return 'unknown'
  if (value.startsWith('timeout:send:')) return 'timeout:send:*'
  if (value.startsWith('skip:incoming_error:')) return 'skip:incoming_error:*'
  if (value.startsWith('skip:decrypt_failed:')) return 'skip:decrypt_failed:*'
  if (value.startsWith('error:conversion:')) return 'error:conversion:*'
  if (value.startsWith('error:other:')) return 'error:other:*'
  return value
}

function toIsoOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function bumpErrorMessageGroup(groups, log) {
  const errorMsg = String(log?.errorMsg ?? '').trim()
  if (!errorMsg) return
  const key = normalizeAdminErrorGroupKey(errorMsg)
  const category = categorizeErrorMsg(errorMsg)
  const status = String(log?.status || 'unknown')
  const sentAtIso = toIsoOrNull(log?.sentAt)
  const current = groups.get(key) || {
    errorMsg: key,
    sampleErrorMsg: key === errorMsg ? errorMsg : null,
    category,
    count: 0,
    lastSeenAt: null,
    statusBreakdown: {},
  }
  current.count += 1
  current.statusBreakdown[status] = (current.statusBreakdown[status] || 0) + 1
  if (sentAtIso && (!current.lastSeenAt || sentAtIso > current.lastSeenAt)) {
    current.lastSeenAt = sentAtIso
    current.sampleErrorMsg = key === errorMsg ? errorMsg : null
  }
  groups.set(key, current)
}

// Agrega os eventos duráveis de dessincronização de grupo (ops_wa_group_desync_*)
// por jid, para o painel admin mostrar QUAL grupo não-monitorado está derrubando
// a sessão do cliente — sem a operadora precisar grepar log. `unresolved: true`
// marca o grupo que o auto-refresh não curou (recomendação: cliente sair dele).
export function summarizeDesyncGroups(events = [], { limit = 10 } = {}) {
  const groups = new Map()
  for (const event of events) {
    let metadata = {}
    try { metadata = typeof event?.metadata === 'string' ? JSON.parse(event.metadata) : (event?.metadata || {}) } catch { metadata = {} }
    const jid = metadata?.jid
    if (!jid) continue
    const createdAtIso = toIsoOrNull(event?.createdAt)
    const isUnresolved = event?.event === 'ops_wa_group_desync_unresolved'
    const current = groups.get(jid) || {
      jid,
      name: null,
      autoheals: 0,
      unresolved: false,
      lastSeenAt: null,
    }
    if (event?.event === 'ops_wa_group_desync_autoheal') current.autoheals += 1
    if (isUnresolved) current.unresolved = true
    if (metadata?.name && !current.name) current.name = metadata.name
    if (createdAtIso && (!current.lastSeenAt || createdAtIso > current.lastSeenAt)) current.lastSeenAt = createdAtIso
    groups.set(jid, current)
  }
  return Array.from(groups.values())
    .sort((a, b) =>
      (Number(b.unresolved) - Number(a.unresolved)) ||
      (b.autoheals - a.autoheals) ||
      String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''))
    )
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)))
}

export function buildErrorsByMessage(logs = [], { limit = 50 } = {}) {
  const groups = new Map()
  for (const log of logs) {
    if (log?.status === 'success' || log?.status === 'queued' || log?.status === 'sending') continue
    bumpErrorMessageGroup(groups, log)
  }
  return Array.from(groups.values())
    .sort((a, b) => (b.count - a.count) || String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 50)))
}

const INCIDENT_CATEGORIES = new Set([
  'timeout', 'channel_forbidden', 'channel_throttled', 'queue_full',
  'worker_restart', 'decrypt', 'baileys', 'incoming_error', 'conversion', 'other', 'unknown',
])

function hourBucket(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCMinutes(0, 0, 0)
  return date.toISOString()
}

// Contrato puro da central de erros: separa falha real de bloqueio esperado,
// detecta assinaturas novas contra a janela anterior e agrega impacto por cliente.
export function buildErrorObservability(currentLogs = [], baselineLogs = [], users = [], { from, to } = {}) {
  const baselineKeys = new Set(baselineLogs.map(log => normalizeAdminErrorGroupKey(log?.errorMsg)).filter(key => key !== 'unknown'))
  const userById = new Map(users.map(user => [user.id, user]))
  const groups = new Map()
  const categories = new Map()
  const impactedUsers = new Map()
  const trend = new Map()
  let incidents = 0
  let expectedBlocks = 0

  for (const log of currentLogs) {
    if (!log?.errorMsg || ['success', 'queued', 'sending'].includes(log.status)) continue
    const key = normalizeAdminErrorGroupKey(log.errorMsg)
    const category = categorizeErrorMsg(log.errorMsg)
    const isIncident = INCIDENT_CATEGORIES.has(category)
    if (isIncident) incidents += 1
    else expectedBlocks += 1

    const group = groups.get(key) || { key, category, count: 0, affectedUsers: new Set(), firstSeenAt: null, lastSeenAt: null, sample: null }
    group.count += 1
    if (log.userId) group.affectedUsers.add(log.userId)
    const at = toIsoOrNull(log.sentAt)
    if (at && (!group.firstSeenAt || at < group.firstSeenAt)) group.firstSeenAt = at
    if (at && (!group.lastSeenAt || at > group.lastSeenAt)) { group.lastSeenAt = at; group.sample = log.errorMsg }
    groups.set(key, group)

    const categoryRow = categories.get(category) || { category, count: 0, affectedUsers: new Set() }
    categoryRow.count += 1
    if (log.userId) categoryRow.affectedUsers.add(log.userId)
    categories.set(category, categoryRow)

    if (isIncident && log.userId) {
      const row = impactedUsers.get(log.userId) || { userId: log.userId, count: 0, categories: new Set(), lastSeenAt: null }
      row.count += 1
      row.categories.add(category)
      if (at && (!row.lastSeenAt || at > row.lastSeenAt)) row.lastSeenAt = at
      impactedUsers.set(log.userId, row)
    }

    const bucket = hourBucket(log.sentAt)
    if (bucket) {
      const row = trend.get(bucket) || { at: bucket, incidents: 0, expectedBlocks: 0 }
      if (isIncident) row.incidents += 1
      else row.expectedBlocks += 1
      trend.set(bucket, row)
    }
  }

  const presentedGroups = Array.from(groups.values()).map(group => ({
    ...group,
    affectedUsers: group.affectedUsers.size,
    isNew: !baselineKeys.has(group.key),
    kind: INCIDENT_CATEGORIES.has(group.category) ? 'incident' : 'expected_block',
  })).sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.count - a.count)

  return {
    range: { from: toIsoOrNull(from), to: toIsoOrNull(to) },
    totals: {
      incidents,
      expectedBlocks,
      affectedUsers: impactedUsers.size,
      newSignatures: presentedGroups.filter(group => group.isNew && group.kind === 'incident').length,
    },
    groups: presentedGroups,
    categories: Array.from(categories.values()).map(row => ({ ...row, affectedUsers: row.affectedUsers.size })).sort((a, b) => b.count - a.count),
    impactedUsers: Array.from(impactedUsers.values()).map(row => {
      const user = userById.get(row.userId) || {}
      return { ...row, categories: Array.from(row.categories), name: user.name || null, email: user.email || null, plan: user.plan || null }
    }).sort((a, b) => b.count - a.count),
    trend: Array.from(trend.values()).sort((a, b) => a.at.localeCompare(b.at)),
  }
}
