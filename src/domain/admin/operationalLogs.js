// Janelas operacionais do admin (Observabilidade e resumo de logs) — PURO.
//
// RCA Q2 da auditoria (2026-10-02): `/system/observability` e `/logs/summary`
// faziam `messageLog.findMany` SEM `take` (24 h e até 30 dias) e carregavam a
// tabela inteira na memória da API só para contar. O sucesso é a maioria das
// linhas e não precisa vir uma a uma: ele entra por `count` no banco; só as
// linhas que precisam de classificação por texto (`errorMsg`) são trazidas,
// com teto. Este módulo só classifica e monta as janelas.

import { categorizeErrorMsg, ERROR_CATEGORIES } from '../../errorTaxonomy.js'

export const OBSERVABILITY_WINDOWS = Object.freeze([
  { key: '5m', label: '5 minutos', ms: 5 * 60 * 1000 },
  { key: '30m', label: '30 minutos', ms: 30 * 60 * 1000 },
  { key: '1h', label: '1 hora', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 horas', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 horas', ms: 24 * 60 * 60 * 1000 },
])

/** Teto de linhas NÃO-sucesso trazidas para classificar (mesmo valor de /errors/observability). */
export const OPERATIONAL_LOG_ROW_LIMIT = 20_000

export function emptyOperationalLogCounts() {
  return { success: 0, skippedDedup: 0, skippedConfig: 0, timeoutTotal: 0, errorOther: 0, inFlight: 0 }
}

export function classifyOperationalLogIntoCounts(counts, log) {
  if (log.status === 'queued' || log.status === 'sending') { counts.inFlight++; return }
  if (log.status === 'success') { counts.success++; return }
  const category = categorizeErrorMsg(log.errorMsg)
  if (category === ERROR_CATEGORIES.DEDUP) { counts.skippedDedup++; return }
  if (category === ERROR_CATEGORIES.CONFIG_BLOCK) { counts.skippedConfig++; return }
  if (category === ERROR_CATEGORIES.TIMEOUT) counts.timeoutTotal++
  else if (log.status === 'error') counts.errorOther++
}

/** Início real de uma janela: nunca antes do `from` do período pedido. */
export function windowStart(now, windowMs, from = null) {
  const start = now.getTime() - windowMs
  const floor = from ? new Date(from).getTime() : -Infinity
  return new Date(Math.max(start, floor))
}

/**
 * @param recentLogs linhas já filtradas (idealmente só as não-sucesso)
 * @param successByWindow { [key]: número de sucessos contado NO BANCO } — quando
 *   presente, substitui a contagem de sucesso feita linha a linha.
 */
export function buildOperationalWindows(recentLogs, now = new Date(), { successByWindow = null, from = null } = {}) {
  const nowMs = now.getTime()
  const windows = {}
  for (const window of OBSERVABILITY_WINDOWS) {
    const counts = emptyOperationalLogCounts()
    const start = windowStart(now, window.ms, from).getTime()
    for (const log of recentLogs) {
      const sentAt = new Date(log.sentAt).getTime()
      if (Number.isFinite(sentAt) && sentAt >= start && sentAt <= nowMs) classifyOperationalLogIntoCounts(counts, log)
    }
    if (successByWindow && Number.isFinite(Number(successByWindow[window.key]))) {
      counts.success = Number(successByWindow[window.key])
    }
    windows[window.key] = {
      label: window.label,
      from: new Date(Math.max(nowMs - window.ms, from ? new Date(from).getTime() : -Infinity)).toISOString(),
      to: now.toISOString(),
      logs: counts,
    }
  }
  return windows
}
