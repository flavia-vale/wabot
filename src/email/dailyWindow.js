// Quando o "dia" do teto de envio começa.
//
// O teto era uma janela deslizante de 24h: bateu o limite às 15h de terça, os
// e-mails só voltavam a sair de 15h em diante na quarta, e cada dia a fila
// andava mais tarde que o anterior. Agora o dia tem hora certa — 8h da manhã no
// horário de Brasília — então a fila do dia começa a sair de manhã, que é
// quando a cliente lê e quando o provedor gosta de ver tráfego regular.
//
// PURO: só data e fuso, sem banco e sem rede. O fuso é resolvido pelo Intl (o
// Brasil não tem mais horário de verão desde 2019, mas o cálculo não depende
// disso — o deslocamento é recalculado na própria fronteira).

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'
const DEFAULT_RESET_HOUR = 8
// Se o fuso for inválido, cai no deslocamento fixo de Brasília em vez de
// quebrar o envio: teto na hora errada é bem menos grave que fila parada.
const FALLBACK_OFFSET_MS = -3 * 60 * 60 * 1000

export function resolveEmailTimeZone(env = process.env) {
  const raw = String(env.EMAIL_TIMEZONE ?? '').trim()
  return raw || DEFAULT_TIME_ZONE
}

export function resolveDailyResetHour(env = process.env) {
  const raw = Number(env.EMAIL_DAILY_RESET_HOUR)
  if (!Number.isFinite(raw)) return DEFAULT_RESET_HOUR
  const hour = Math.floor(raw)
  return hour >= 0 && hour <= 23 ? hour : DEFAULT_RESET_HOUR
}

/** Quanto o relógio local está adiantado/atrasado em relação ao UTC naquele instante. */
function offsetMs(instant, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(instant)
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const asUtc = Date.UTC(
      Number(value.year),
      Number(value.month) - 1,
      Number(value.day),
      Number(value.hour) % 24,
      Number(value.minute),
      Number(value.second),
    )
    return Number.isFinite(asUtc) ? asUtc - instant.getTime() : FALLBACK_OFFSET_MS
  } catch {
    return FALLBACK_OFFSET_MS
  }
}

/**
 * Início do dia de envio vigente: a última passagem pela hora de virada.
 * Antes das 8h, o dia vigente ainda é o que começou às 8h de ontem.
 *
 * @param {Date|number|string} now
 * @param {{hour?: number, timeZone?: string}} options
 * @returns {Date}
 */
export function resolveDailyWindowStart(now = new Date(), { hour, timeZone } = {}) {
  const instant = new Date(now)
  const reference = Number.isNaN(instant.getTime()) ? new Date() : instant
  const zone = timeZone ?? resolveEmailTimeZone()
  const resetHour = Number.isFinite(hour) ? Math.min(Math.max(Math.floor(hour), 0), 23) : resolveDailyResetHour()

  const offset = offsetMs(reference, zone)
  const local = new Date(reference.getTime() + offset)
  const boundary = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), resetHour, 0, 0, 0)
  const localStart = boundary <= local.getTime() ? boundary : boundary - MS_PER_DAY

  // Recalcula o deslocamento NA fronteira: se houver mudança de fuso entre os
  // dois instantes, o primeiro cálculo erraria por uma hora.
  let start = new Date(localStart - offset)
  const offsetAtStart = offsetMs(start, zone)
  if (offsetAtStart !== offset) start = new Date(localStart - offsetAtStart)
  return start
}

/** Quando o teto zera de novo — usado só para dizer no log a que horas a fila volta. */
export function nextDailyWindowStart(now = new Date(), options = {}) {
  const start = resolveDailyWindowStart(now, options)
  return resolveDailyWindowStart(new Date(start.getTime() + MS_PER_DAY + 60 * 60 * 1000), options)
}

/** "8h de 18/08" — para o log e para a tela do painel. */
export function describeWindowStart(date, timeZone = resolveEmailTimeZone()) {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value)
  } catch {
    return value.toISOString()
  }
}
