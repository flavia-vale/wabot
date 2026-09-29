// Contador agregado de loja não suportada (P1-4 — ver src/core/unsupportedStore.js
// e docs/produto/backlog-p1-4-loja-nao-suportada.md).
//
// Instrução da dona do produto, ao pé da letra: "instrumente sem guardar
// informações irrelevantes, apague logo em seguida o que não precisar".
//
// O que É gravado: UMA linha de `AnalyticsEvent` por (dia, domínio), evento
// `ops_unsupported_store_daily`, metadata exatamente `{ domain, day, count }`,
// sem userId. N mensagens do mesmo domínio no mesmo dia viram UMA linha com
// `count = N` — nunca N linhas. O `id` é determinístico (`uss:<dia>:<domínio>`)
// e é isso que garante a agregação entre processos.
//
// O que NUNCA é gravado: URL, caminho, query, texto da mensagem, userId, grupo.
//
// Poda: linhas com mais de 30 dias são apagadas, no máximo uma vez por dia por
// processo, pegando carona no flush (sem timer novo). O flush também pega
// carona num timer que já existe no bot-worker (watchdog de 5 min).
//
// Memória: um Map com no máximo MAX_PENDING_KEYS chaves curtas, esvaziado a
// cada flush. Domínio novo além do teto cai em `outros` — o Map nunca cresce
// sem limite.

import { ANALYTICS_EVENTS, analyticsEnabled } from '../analytics.js'
import { distinctRegistrableDomains, PERSISTABLE_DOMAIN_RE } from '../core/unsupportedStore.js'

export const UNSUPPORTED_STORE_EVENT = 'ops_unsupported_store_daily'
export const UNSUPPORTED_STORE_RETENTION_DAYS = 30
export const OVERFLOW_DOMAIN = 'outros'
const DAY_MS = 24 * 60 * 60 * 1000
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000 // Brasil sem horário de verão desde 2019
const DEFAULT_FLUSH_INTERVAL_MS = 10 * 60 * 1000
const MAX_PENDING_KEYS = 50
const MAX_CAS_ATTEMPTS = 3

/** Dia (fuso de Brasília) no formato YYYY-MM-DD. PURA. */
export function brtDay(nowMs) {
  return new Date(nowMs - BRT_OFFSET_MS).toISOString().slice(0, 10)
}

/** Início do dia de Brasília em UTC (00:00 BRT = 03:00Z). PURA. */
export function brtDayStart(day) {
  return new Date(`${day}T03:00:00.000Z`)
}

export function aggregateRowId(day, domain) {
  return `uss:${day}:${domain}`
}

function buildMetadata(domain, day, count) {
  // Chaves FIXAS. Qualquer campo novo aqui precisa passar pela guarda de
  // privacidade em test/unsupported-store-signal.test.js.
  return JSON.stringify({ domain, day, count })
}

function readCount(metadata) {
  try {
    const n = Number(JSON.parse(metadata || '{}').count)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function isUniqueViolation(err) {
  return err?.code === 'P2002' || /unique constraint/i.test(String(err?.message || ''))
}

/**
 * Soma `delta` à linha (dia, domínio). Compare-and-swap sobre a metadata:
 * dois robôs gravando o mesmo domínio no mesmo instante não perdem contagem —
 * o perdedor relê e tenta de novo. Funciona igual em SQLite e Postgres, sem
 * SQL cru.
 */
export async function incrementDailyCount(db, { day, domain, delta }) {
  if (!PERSISTABLE_DOMAIN_RE.test(domain) && domain !== OVERFLOW_DOMAIN) return false
  const id = aggregateRowId(day, domain)
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const existing = await db.analyticsEvent.findUnique({ where: { id }, select: { metadata: true } })
    if (!existing) {
      try {
        await db.analyticsEvent.create({
          data: {
            id,
            userId: null,
            event: UNSUPPORTED_STORE_EVENT,
            metadata: buildMetadata(domain, day, delta),
            createdAt: brtDayStart(day),
          },
        })
        return true
      } catch (err) {
        if (isUniqueViolation(err)) continue // outro processo criou antes: soma nela
        throw err
      }
    }
    const next = buildMetadata(domain, day, readCount(existing.metadata) + delta)
    const res = await db.analyticsEvent.updateMany({
      where: { id, metadata: existing.metadata },
      data: { metadata: next },
    })
    if (res?.count === 1) return true
  }
  throw new Error('unsupported_store: contagem disputada, fica para o próximo flush')
}

/** Apaga as linhas com mais de 30 dias. Devolve quantas saíram. */
export async function pruneOldCounts(db, nowMs) {
  const cutoff = new Date(nowMs - UNSUPPORTED_STORE_RETENTION_DAYS * DAY_MS)
  const res = await db.analyticsEvent.deleteMany({
    where: { event: UNSUPPORTED_STORE_EVENT, createdAt: { lt: cutoff } },
  })
  return res?.count ?? 0
}

export function createUnsupportedStoreSignal({
  db,
  logger = null,
  now = () => Date.now(),
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  enabled = () => analyticsEnabled() && ANALYTICS_EVENTS.has(UNSUPPORTED_STORE_EVENT),
} = {}) {
  let pending = new Map() // `${day}|${domain}` -> count
  let lastFlushAt = 0 // 0: o primeiro registro grava na hora
  let lastPruneDay = null
  let inFlight = null

  function add(day, domain, n) {
    const key = `${day}|${domain}`
    if (!pending.has(key) && pending.size >= MAX_PENDING_KEYS) {
      const overflowKey = `${day}|${OVERFLOW_DOMAIN}`
      pending.set(overflowKey, (pending.get(overflowKey) || 0) + n)
      return
    }
    pending.set(key, (pending.get(key) || 0) + n)
  }

  async function doFlush() {
    const nowMs = now()
    lastFlushAt = nowMs
    const batch = pending
    pending = new Map()
    for (const [key, count] of batch) {
      const [day, domain] = key.split('|')
      try {
        await incrementDailyCount(db, { day, domain, delta: count })
      } catch (err) {
        add(day, domain, count) // devolve para o próximo flush; nada se perde
        logger?.warn?.({ err: err?.message, domain }, 'Loja não suportada: contagem não gravada, tenta no próximo flush')
      }
    }
    const today = brtDay(nowMs)
    if (lastPruneDay !== today) {
      try {
        const removed = await pruneOldCounts(db, nowMs)
        lastPruneDay = today
        if (removed > 0) logger?.info?.({ removed }, 'Loja não suportada: contagens com mais de 30 dias apagadas')
      } catch (err) {
        logger?.warn?.({ err: err?.message }, 'Loja não suportada: poda falhou, tenta no próximo flush')
      }
    }
  }

  function flush() {
    // O que chegou durante um flush em andamento sai no flush seguinte.
    if (inFlight) return inFlight.then(() => flush())
    if (pending.size === 0) return Promise.resolve()
    inFlight = doFlush().finally(() => { inFlight = null })
    return inFlight
  }

  function flushIfDue() {
    if (pending.size === 0) return Promise.resolve()
    if (now() - lastFlushAt < flushIntervalMs) return Promise.resolve()
    return flush()
  }

  /**
   * Registra os links de loja não suportada de UMA mensagem. Só o domínio
   * registrável sai daqui; cada domínio conta uma vez por mensagem.
   */
  function record(urls) {
    try {
      if (!enabled()) return 0
      const domains = distinctRegistrableDomains(urls)
      if (!domains.length) return 0
      const day = brtDay(now())
      for (const domain of domains) add(day, domain, 1)
      void flushIfDue().catch(() => {})
      return domains.length
    } catch {
      return 0 // instrumentação nunca derruba o processamento da mensagem
    }
  }

  return {
    record,
    flush,
    flushIfDue,
    pendingSize: () => pending.size,
  }
}
