// Sinais operacionais para os "gatilhos" de escala da auditoria (WABOT-010):
// ocorrências de SQLITE_BUSY e de dedup global em fail-open. O objetivo é
// tornar esses gatilhos OBSERVÁVEIS (e não subjetivos) — alimentando o
// critério de cutover SQLite->Postgres e a decisão de REDIS_DEDUP_FAIL_MODE.
//
// Este é um módulo LEAF de propósito: não importa `db.js` nem `analytics.js`
// no topo, para que `db.js` possa consumi-lo sem criar ciclo de import
// (db -> signals -> analytics -> db). A emissão durável em `AnalyticsEvent`
// é feita via dynamic import lazy e best-effort: o contador in-memory é a
// fonte confiável; a linha no banco é bônus para histórico cross-processo.

const WINDOW_24H_MS = 24 * 60 * 60 * 1000
const WINDOW_1H_MS = 60 * 60 * 1000
const MAX_TIMESTAMPS_PER_SIGNAL = 10_000 // bound defensivo de memória por sinal

const signals = new Map() // name -> { total, timestamps: number[] (ascendente) }

// Mapeia o nome curto do sinal para o evento canônico do allowlist de analytics.
const ANALYTICS_EVENT_BY_SIGNAL = {
  sqlite_busy: 'ops_sqlite_busy',
  dedup_fail_open: 'ops_dedup_fail_open',
  wa_connection_replaced: 'ops_wa_connection_replaced',
}

let cachedTrackFn = null
async function emitDurable(name, metadata) {
  const event = ANALYTICS_EVENT_BY_SIGNAL[name]
  if (!event) return
  try {
    if (!cachedTrackFn) {
      const mod = await import('../analytics.js')
      cachedTrackFn = mod.trackAnalyticsEventSafe
    }
    cachedTrackFn({ event, metadata })
  } catch {
    // best-effort: o contador in-memory já registrou. Em SQLITE_BUSY, a própria
    // escrita do AnalyticsEvent pode falhar — e tudo bem, é só durabilidade.
  }
}

export function recordOperationalSignal(name, metadata = {}) {
  const now = Date.now()
  let entry = signals.get(name)
  if (!entry) {
    entry = { total: 0, timestamps: [] }
    signals.set(name, entry)
  }
  entry.total += 1
  entry.timestamps.push(now)
  if (entry.timestamps.length > MAX_TIMESTAMPS_PER_SIGNAL) {
    entry.timestamps.splice(0, entry.timestamps.length - MAX_TIMESTAMPS_PER_SIGNAL)
  }
  emitDurable(name, metadata)
  return entry.total
}

function countWithin(timestamps, windowMs, now) {
  let n = 0
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (now - timestamps[i] <= windowMs) n += 1
    else break // ascendente: o primeiro fora da janela encerra a contagem
  }
  return n
}

export function getOperationalSignalsSnapshot(now = Date.now()) {
  const out = {}
  for (const [name, entry] of signals) {
    // Poda preguiçosa do que saiu da janela de 24h (mantém a memória limitada).
    while (entry.timestamps.length && now - entry.timestamps[0] > WINDOW_24H_MS) {
      entry.timestamps.shift()
    }
    out[name] = {
      total: entry.total,
      last1h: countWithin(entry.timestamps, WINDOW_1H_MS, now),
      last24h: entry.timestamps.length,
    }
  }
  return out
}

// Hook de teste: zera o estado in-memory entre casos.
export function __resetOperationalSignals() {
  signals.clear()
  cachedTrackFn = null
}
