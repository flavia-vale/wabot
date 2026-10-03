// Quando o número reserva assume os envios (docs/rca/multi-numero.md, Fase 1).
// Função pura: quem chama traz o estado do banco e o "caído desde".
//
// Promove a reserva quando o número ativo:
//   - foi deslogado/bloqueado pelo WhatsApp (401/403 ou re-pareamento exigido)
//     → na hora; ou
//   - está desconectado há mais de `failoverMs` (padrão 10 min).
// Nunca promove: com o ativo conectado, sem reserva conectada e viva, ou
// dentro do intervalo mínimo desde a última troca (evita pingue-pongue).

export const DEFAULT_FAILOVER_MS = 10 * 60_000
export const DEFAULT_MIN_SWITCH_INTERVAL_MS = 30 * 60_000
export const DEFAULT_STANDBY_FRESH_MS = 3 * 60_000
const BANNED_CODES = new Set(['401', '403'])

export function failoverSettings(env = process.env) {
  const minutes = (name, fallbackMs, floorMs) => Math.max(floorMs, Number(env?.[name]) > 0 ? Number(env[name]) * 60_000 : fallbackMs)
  return {
    failoverMs: minutes('MULTI_NUMBER_FAILOVER_MINUTES', DEFAULT_FAILOVER_MS, 2 * 60_000),
    minSwitchIntervalMs: minutes('MULTI_NUMBER_MIN_SWITCH_MINUTES', DEFAULT_MIN_SWITCH_INTERVAL_MS, 5 * 60_000),
    standbyFreshMs: DEFAULT_STANDBY_FRESH_MS,
  }
}

export function isActiveBanned(active = {}) {
  if (active?.status === 'connected') return false
  return BANNED_CODES.has(String(active?.lastDisconnectCode ?? '')) || active?.lifecycle === 'auth_reset_required'
}

export function decideFailover({
  active,
  standby,
  user,
  downSinceMs = null,
  now = Date.now(),
  failoverMs = DEFAULT_FAILOVER_MS,
  minSwitchIntervalMs = DEFAULT_MIN_SWITCH_INTERVAL_MS,
  standbyFreshMs = DEFAULT_STANDBY_FRESH_MS,
} = {}) {
  if (!active || active.status === 'connected') return { promote: false, reason: 'active_ok' }
  if (!standby || standby.status !== 'connected') return { promote: false, reason: 'no_standby' }
  const standbyBeat = standby.lastHeartbeatAt ? new Date(standby.lastHeartbeatAt).getTime() : 0
  if (now - standbyBeat > standbyFreshMs) return { promote: false, reason: 'standby_stale' }
  const lastSwitch = user?.waSlotSwitchedAt ? new Date(user.waSlotSwitchedAt).getTime() : 0
  if (lastSwitch && now - lastSwitch < minSwitchIntervalMs) return { promote: false, reason: 'cooldown' }
  if (isActiveBanned(active)) return { promote: true, reason: 'logged_out' }
  if (downSinceMs != null && now - downSinceMs >= failoverMs) return { promote: true, reason: 'down_too_long' }
  return { promote: false, reason: 'waiting' }
}
