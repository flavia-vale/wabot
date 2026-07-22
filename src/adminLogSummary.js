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
