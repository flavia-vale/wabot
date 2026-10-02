// `/ready/bots`: os robôs estão de pé? Decisão pura.
//
// RCA 2026-10-01: o `/ready` respondeu 200 enquanto o bot-supervisor nem
// existia no pm2 e as 71 sessões estavam paradas — ele só olha o banco. Este
// endpoint existe para um monitor EXTERNO (que avisa mesmo com a VPS fora)
// enxergar "robôs parados". O `/ready` antigo fica igual: o deploy usa ele.
//
// 503 quando: (remote) o heartbeat do supervisor sumiu, ou metade ou mais das
// sessões que deveriam estar ligadas está sem sinal há > 5 min (o worker grava
// o sinal a cada ~60 s). Contagem que falhou não afirma nada (fica 200 com
// `unknown`), para o monitor não gritar por falha de leitura isolada.

export const BOTS_STALE_MS = 5 * 60_000
export const BOTS_STALE_RED_RATIO = 0.5

export function decideBotsReadiness({ mode = 'inline', supervisorAlive = null, live = null, stale = null } = {}) {
  const remote = String(mode).toLowerCase() === 'remote'
  if (remote && supervisorAlive === false) {
    return { ok: false, reason: 'supervisor_sem_sinal', live, stale }
  }
  if (Number.isFinite(live) && Number.isFinite(stale) && live > 0 && stale / live >= BOTS_STALE_RED_RATIO) {
    return { ok: false, reason: 'sessoes_sem_sinal', live, stale }
  }
  const unknown = (remote && supervisorAlive === null) || !Number.isFinite(live) || !Number.isFinite(stale)
  return { ok: true, reason: unknown ? 'unknown' : 'ok', live, stale }
}
