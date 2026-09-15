export const SHARD_POC_PRIMARY_EMAIL = 'flavia.vale@usp.br'

const score = row => Number(row.messages24h || 0) + (Number(row.mediaMessages24h || 0) * 4)

/** Selects a useful four-account canary without hard-coding production users. */
export function selectShardPocCandidates(rows, primaryEmail = SHARD_POC_PRIMARY_EMAIL) {
  const connected = rows.filter(row => row?.session?.status === 'connected')
  const primary = rows.find(row => String(row.email).toLowerCase() === primaryEmail.toLowerCase())
  const pool = connected.filter(row => row.id !== primary?.id).sort((a, b) => score(a) - score(b))
  const picks = []
  const add = (row, profile) => {
    if (row && !picks.some(item => item.id === row.id)) picks.push({ ...row, selectionProfile: profile })
  }
  add(primary, 'conta obrigatória')
  add(pool[0], 'atividade leve')
  add(pool[Math.floor((pool.length - 1) / 2)], 'atividade mediana')
  add([...pool].sort((a, b) => Number(b.mediaMessages24h || 0) - Number(a.mediaMessages24h || 0) || score(b) - score(a))[0], 'maior uso de mídia')
  for (const row of [...pool].reverse()) add(row, 'atividade alta')
  return picks.slice(0, 4)
}

export function presentShardRuntimeMetrics(metrics) {
  const runtime = metrics?.runtime
  if (!runtime) return null
  return {
    pid: runtime.pid,
    uptimeSeconds: runtime.uptimeSeconds,
    rssBytes: runtime.rssBytes,
    heapUsedBytes: runtime.heapUsedBytes,
    heapTotalBytes: runtime.heapTotalBytes,
    externalBytes: runtime.externalBytes,
    arrayBuffersBytes: runtime.arrayBuffersBytes,
    eventLoopDelayMs: runtime.eventLoopDelayMs,
    incomingQueue: metrics.incomingQueue || null,
    sessionHealth: metrics.sessionHealth || null,
  }
}
