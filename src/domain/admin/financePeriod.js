// Períodos de tempo para os Cards e tabelas da aba Financeiro do admin.
//
// PURO: só data e fuso, sem banco e sem rede — mesma técnica de
// `src/email/dailyWindow.js` (deslocamento recalculado na própria fronteira,
// para não errar por uma hora quando a virada cruza troca de fuso).
//
// "Mês atual"/"mês passado" respeitam o calendário (dia 1 às 0h em
// America/Sao_Paulo), não uma janela de 30 dias corridos — é o que uma pessoa
// pensa quando lê "mês atual" no painel.

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'
const DEFAULT_PERIOD = '30d'
const FALLBACK_OFFSET_MS = -3 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

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

function startOfMonthOffsetBy(instant, timeZone, monthOffset) {
  const offset = offsetMs(instant, timeZone)
  const local = new Date(instant.getTime() + offset)
  const boundary = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, 1, 0, 0, 0, 0)
  let start = new Date(boundary - offset)
  const offsetAtStart = offsetMs(start, timeZone)
  if (offsetAtStart !== offset) start = new Date(boundary - offsetAtStart)
  return start
}

// Ordem = ordem de exibição no seletor.
export const FINANCE_PERIODS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'current_month', label: 'Mês atual' },
  { value: 'last_month', label: 'Último mês' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
]

const FINANCE_PERIOD_VALUES = new Set(FINANCE_PERIODS.map((p) => p.value))

/**
 * @param {string} period
 * @param {{ now?: Date, timeZone?: string }} [options]
 * @returns {{ period: string, label: string, start: Date, end: Date }}
 */
export function resolveFinancePeriod(period, { now = new Date(), timeZone = DEFAULT_TIME_ZONE } = {}) {
  const key = FINANCE_PERIOD_VALUES.has(period) ? period : DEFAULT_PERIOD
  const reference = Number.isNaN(new Date(now).getTime()) ? new Date() : new Date(now)
  const label = FINANCE_PERIODS.find((p) => p.value === key)?.label ?? '30 dias'

  switch (key) {
    case '7d':
      return { period: key, label, start: new Date(reference.getTime() - 7 * MS_PER_DAY), end: reference }
    case 'current_month':
      return { period: key, label, start: startOfMonthOffsetBy(reference, timeZone, 0), end: reference }
    case 'last_month':
      return {
        period: key,
        label,
        start: startOfMonthOffsetBy(reference, timeZone, -1),
        end: startOfMonthOffsetBy(reference, timeZone, 0),
      }
    case '3m':
      return { period: key, label, start: startOfMonthOffsetBy(reference, timeZone, -2), end: reference }
    case '6m':
      return { period: key, label, start: startOfMonthOffsetBy(reference, timeZone, -5), end: reference }
    case '30d':
    default:
      return { period: '30d', label: '30 dias', start: new Date(reference.getTime() - 30 * MS_PER_DAY), end: reference }
  }
}
