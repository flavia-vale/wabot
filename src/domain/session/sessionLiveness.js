// Fonte ÚNICA das janelas de "sessão viva" e "conectada e cega" que o admin usa.
//
// Antes (auditoria do painel admin, M1): o heartbeat "fresco" valia 2 min na
// listagem do Online e 5 min em `resolveSessionOwner`, no readiness e no
// vigia — a mesma cliente aparecia online num lugar e parada em outro. A
// cegueira também tinha duas janelas. Aqui há uma de cada; quem precisa
// decidir "vivo" ou "cego" importa daqui, nunca redeclara o número.
//
// Puro: sem I/O, sem relógio implícito.

/** O worker grava o heartbeat a cada ~15-60 s; 5 min sem sinal = ninguém batendo ponto. */
export const HEARTBEAT_FRESH_MS = 5 * 60_000

/**
 * Janela em que um `ops_wa_reception_blind` ainda conta como "cega agora".
 * Precisa ser bem maior que o throttle do sinal no worker (1 h) — com margem
 * zero a conta some do card entre uma emissão e a seguinte.
 */
export const RECEPTION_BLIND_WINDOW_MS = Math.max(10 * 60_000, Number(process.env.ADMIN_RECEPTION_BLIND_WINDOW_MS || 3 * 60 * 60_000))

export function isHeartbeatFresh(lastHeartbeatAt, now = Date.now(), freshMs = HEARTBEAT_FRESH_MS) {
  if (lastHeartbeatAt == null) return false
  const at = new Date(lastHeartbeatAt).getTime()
  if (!Number.isFinite(at) || at <= 0) return false
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  return nowMs - at <= freshMs
}

/** Online = conectada, ou subindo/reconectando com heartbeat fresco. */
export function isSessionLive(session, now = Date.now()) {
  if (!session) return false
  if (session.status === 'connected') return true
  return session.status === 'connecting'
    && ['connecting', 'reconnecting'].includes(session.lifecycle)
    && isHeartbeatFresh(session.lastHeartbeatAt, now)
}
