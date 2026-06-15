// Restart budget por sessão: evita que um tenant com auth_info corrompido (ou
// qualquer falha permanente) entre em churn infinito de kill/ressuscita no
// health monitor — cada ciclo consome CPU/disco do host e gera tempestade de
// reconexão no WhatsApp (padrão associado a ban). Após estourar o orçamento
// dentro da janela, a sessão entra em quarentena e só volta a ser ressuscitada
// quando a quarentena expira (com orçamento zerado) ou via start manual.

export const RESTART_BUDGET_WINDOW_MS = Math.max(60_000, Number(process.env.RESTART_BUDGET_WINDOW_MS || 15 * 60_000))
export const RESTART_BUDGET_MAX = Math.max(1, Number(process.env.RESTART_BUDGET_MAX || 5))
export const RESTART_QUARANTINE_MS = Math.max(60_000, Number(process.env.RESTART_QUARANTINE_MS || 30 * 60_000))

export function createRestartBudget({
  windowMs = RESTART_BUDGET_WINDOW_MS,
  maxRestarts = RESTART_BUDGET_MAX,
  quarantineMs = RESTART_QUARANTINE_MS,
  now = () => Date.now(),
} = {}) {
  const history = new Map() // userId -> timestamps de restart dentro da janela
  const quarantinedUntil = new Map() // userId -> epoch ms

  function isQuarantined(userId) {
    const until = quarantinedUntil.get(userId)
    if (!until) return false
    if (now() >= until) {
      // quarentena expirou: orçamento zerado para a próxima rodada
      quarantinedUntil.delete(userId)
      history.delete(userId)
      return false
    }
    return true
  }

  // Registra uma tentativa de restart automático. Devolve allowed=false quando
  // o orçamento estourou (a sessão acabou de entrar em quarentena ou já estava).
  function registerRestart(userId) {
    if (isQuarantined(userId)) {
      return { allowed: false, quarantined: true, remainingMs: quarantinedUntil.get(userId) - now() }
    }
    const ts = now()
    const cutoff = ts - windowMs
    const entries = (history.get(userId) ?? []).filter((t) => t > cutoff)
    entries.push(ts)
    history.set(userId, entries)
    if (entries.length > maxRestarts) {
      quarantinedUntil.set(userId, ts + quarantineMs)
      history.delete(userId)
      return { allowed: false, quarantined: true, justQuarantined: true, count: entries.length, remainingMs: quarantineMs }
    }
    return { allowed: true, quarantined: false, count: entries.length }
  }

  // Start manual (comando explícito do usuário/admin) limpa a quarentena —
  // intervenção humana é o caminho documentado para sair dela antes do prazo.
  function clear(userId) {
    quarantinedUntil.delete(userId)
    history.delete(userId)
  }

  function listQuarantined() {
    const ts = now()
    return [...quarantinedUntil.entries()]
      .filter(([, until]) => until > ts)
      .map(([userId, until]) => ({ userId, remainingMs: until - ts }))
  }

  return { registerRestart, isQuarantined, clear, listQuarantined }
}
