// Módulo PURO (sem db/io/env): "horário de envio" do destino × "limite de
// espera na fila". Consumido pelo robô (processSendJob) e pela tela de
// Espelhamento (via dashboard/lib/painel/sendPauseNotice.js), por isso não pode
// importar channelThrottle.js (que arrasta db.js) — a leitura de hora no fuso é
// reimplementada aqui e um teste garante que ela concorda com
// `operatingHoursState` de channelThrottle.js.
//
// RCA 2026-09-24 (frota inteira, não uma conta): 45 de 48 modelos padrão têm
// horário de envio ligado (8h–22h) e limite de espera de 5h. Oferta que chega
// às 22h fica adiada até as 8h; às 8h, `shouldDropExpiredQueueJob` descarta
// tudo com mais de 5h — 547 descartes às 8h BRT em 23/09 e 855 em 24/09.
// Com janela fechada de 10h e limite de 5h, NENHUMA oferta da noite sobrevive,
// e a cliente só descobre de manhã, por linhas vermelhas na aba Envios.
//
// Decisão da dona do produto (2026-09-24, opção A): se o destino está fora do
// horário e `idade na fila + tempo até abrir > limite de espera`, descartar NA
// HORA com motivo próprio ("fora do seu horário de envio"), em vez de guardar
// por horas uma oferta que vai ser jogada fora de qualquer jeito. Fila menor,
// motivo honesto e imediato.
//
// Não regredir:
// - Limite de espera desligado (`queueMaxAgeMin` 0/null) → NUNCA descarta por
//   aqui: a oferta espera até o horário abrir, comportamento histórico.
// - Fonte com horário próprio (fila com `ignoreGlobalQuietHours`) → não
//   descarta: ela já decidiu o horário antes de despachar.
// - Sem carimbo de entrada confiável a idade conta como 0 (fail-safe parcial:
//   só descarta quando SÓ a espera até abrir já estoura o limite — nesse caso
//   o descarte às 8h seria certo de qualquer jeito).
// - Horário ilegível ou desligado → não descarta.

const MIN = 60_000

const DEFAULT_WINDOW = Object.freeze({ startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' })

export function parseSendWindow(raw) {
  if (!raw) return { ...DEFAULT_WINDOW }
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      startHour: Number.isFinite(v?.startHour) ? v.startHour : DEFAULT_WINDOW.startHour,
      endHour: Number.isFinite(v?.endHour) ? v.endHour : DEFAULT_WINDOW.endHour,
      tz: typeof v?.tz === 'string' && v.tz ? v.tz : DEFAULT_WINDOW.tz,
    }
  } catch {
    return { ...DEFAULT_WINDOW }
  }
}

function tzHourMin(nowMs, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(nowMs))
    const hour = Number(parts.find(p => p.type === 'hour')?.value) % 24
    const minute = Number(parts.find(p => p.type === 'minute')?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return { hour, minute }
  } catch {
    return null
  }
}

/**
 * Espelha `operatingHoursState` (channelThrottle.js): dentro da janela envia;
 * fora, devolve quanto falta para abrir. start == end = 24h (sempre aberto).
 * Fuso inválido devolve `open: true` (fail-safe: nunca segurar/descartar por
 * não conseguir ler o relógio).
 */
export function sendWindowState(nowMs, { startHour, endHour, tz } = DEFAULT_WINDOW) {
  if (startHour === endHour) return { open: true, waitMs: 0 }
  const hm = tzHourMin(nowMs, tz)
  if (!hm) return { open: true, waitMs: 0 }
  const { hour, minute } = hm
  const open = startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour
  if (open) return { open: true, waitMs: 0 }
  const currentMins = hour * 60 + minute
  let startMins = startHour * 60
  if (startMins <= currentMins) startMins += 24 * 60
  return { open: false, waitMs: (startMins - currentMins) * MIN }
}

/**
 * Horário efetivo de um destino, já resolvido (preservação efetiva), no formato
 * que a tela consome. `null` quando o horário está desligado.
 */
export function resolveSendWindow(preservation) {
  if (preservation?.operatingHoursEnabled !== true) return null
  const w = parseSendWindow(preservation.operatingHoursJson)
  if (w.startHour === w.endHour) return null
  return w
}

export function formatSendWindowLabel({ startHour, endHour } = DEFAULT_WINDOW) {
  return `${startHour}h–${endHour}h`
}

/**
 * @param {object} p
 * @param {number} p.now
 * @param {number|null} p.enqueuedAt      epoch ms de entrada na fila
 * @param {object|null} p.preservation    config efetiva do destino
 * @param {boolean} [p.ignoreOperatingHours]
 * @returns {{ drop:boolean, reason:string|null, waitMs:number, ageMs:number, maxAgeMs:number, window:object|null }}
 */
export function shouldDropOutsideSendWindow({ now = Date.now(), enqueuedAt, preservation, ignoreOperatingHours = false } = {}) {
  const none = (reason) => ({ drop: false, reason, waitMs: 0, ageMs: 0, maxAgeMs: 0, window: null })
  if (ignoreOperatingHours === true) return none('source_has_own_hours')
  const window = resolveSendWindow(preservation)
  if (!window) return none('hours_disabled')
  const maxMin = Number(preservation?.queueMaxAgeMin)
  const maxAgeMs = Number.isFinite(maxMin) && maxMin > 0 ? maxMin * MIN : 0
  if (maxAgeMs === 0) return { ...none('max_age_disabled'), window }
  const state = sendWindowState(now, window)
  if (state.open) return { ...none('window_open'), window }
  const enqueued = Number(enqueuedAt)
  const ageMs = Number.isFinite(enqueued) && enqueued > 0 ? Math.max(0, now - enqueued) : 0
  const drop = ageMs + state.waitMs > maxAgeMs
  return { drop, reason: drop ? 'would_expire_before_open' : 'fits_before_open', waitMs: state.waitMs, ageMs, maxAgeMs, window }
}

/** Prefixo canônico da taxonomia (ver src/errorTaxonomy.js). */
export const OUTSIDE_SEND_WINDOW_PREFIX = 'skip:outside_send_window'

export function buildOutsideSendWindowReason({ window, maxAgeMs }) {
  const w = window ?? DEFAULT_WINDOW
  return `${OUTSIDE_SEND_WINDOW_PREFIX}:hours=${w.startHour}-${w.endHour}:max=${Math.round(Number(maxAgeMs || 0) / MIN)}min`
}

export function parseOutsideSendWindowReason(errorMsg) {
  if (typeof errorMsg !== 'string' || !errorMsg.startsWith(OUTSIDE_SEND_WINDOW_PREFIX)) return null
  const m = /hours=(\d{1,2})-(\d{1,2}):max=(\d+)min/.exec(errorMsg)
  if (!m) return { startHour: null, endHour: null, maxMin: null }
  return { startHour: Number(m[1]), endHour: Number(m[2]), maxMin: Number(m[3]) }
}
