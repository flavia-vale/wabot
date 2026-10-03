// Corpo do `GET /health` (decisão PURA). Antes: `{ ok: true }` sem olhar nada.
// Em `BOT_SUPERVISOR_MODE=remote` passa a incluir
// `supervisor: { alive, lastHeartbeatAt }` para quem olha o JSON ver
// "API viva, supervisor morto" (auditoria do admin, 3.3). `ok` continua true e
// o status HTTP continua 200 — o smoke test do deploy depende disso; o 503 é
// do `/ready/bots` (`src/ops/botsReadiness.js`).

/**
 * @param {{ mode?: string, supervisorAlive?: boolean|null, heartbeatAtMs?: number|null }} input
 *   supervisorAlive null = não deu para saber (Redis lento/fora).
 */
export function buildHealthPayload({ mode = 'inline', supervisorAlive = null, heartbeatAtMs = null } = {}) {
  if (mode !== 'remote') return { ok: true }
  const at = Number(heartbeatAtMs)
  return {
    ok: true,
    supervisor: {
      alive: supervisorAlive === null || supervisorAlive === undefined ? null : Boolean(supervisorAlive),
      lastHeartbeatAt: Number.isFinite(at) && at > 0 ? new Date(at).toISOString() : null,
    },
  }
}

/** Corta uma promessa que demora: /health nunca pode pendurar por causa do Redis. */
export function withTimeout(promise, ms) {
  let timer
  const limite = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms) })
  return Promise.race([promise, limite]).finally(() => clearTimeout(timer))
}
