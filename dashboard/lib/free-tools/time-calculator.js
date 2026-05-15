const MONTH_WEEKS = 4.33
const MINUTES_PER_HOUR = 60

const DEFAULT_INPUTS = Object.freeze({
  monitorGroups: 5,
  destinationGroups: 3,
  offersPerDay: 12,
  minutesPerOffer: 4,
  daysPerWeek: 6,
  hourlyValue: 25,
})

const INPUT_LIMITS = Object.freeze({
  monitorGroups: { min: 1, max: 500 },
  destinationGroups: { min: 1, max: 500 },
  offersPerDay: { min: 1, max: 500 },
  minutesPerOffer: { min: 1, max: 60 },
  daysPerWeek: { min: 1, max: 7 },
  hourlyValue: { min: 0, max: 1000 },
})

function toFiniteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function clampCalculatorInput(key, value) {
  const limits = INPUT_LIMITS[key]
  const fallback = DEFAULT_INPUTS[key] ?? 0
  if (!limits) return toFiniteNumber(value, fallback)
  const number = toFiniteNumber(value, fallback)
  return Math.min(limits.max, Math.max(limits.min, number))
}

export function sanitizeCalculatorInputs(inputs = {}) {
  return Object.fromEntries(
    Object.keys(DEFAULT_INPUTS).map((key) => [key, clampCalculatorInput(key, inputs[key])])
  )
}

export function formatHours(value) {
  const number = Number(value || 0)
  if (number >= 100) return Math.round(number).toLocaleString('pt-BR')
  return number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function resolveRiskLevel({ offersPerDay, destinationGroups, manualHoursMonth }) {
  const dailyPosts = offersPerDay * destinationGroups
  if (dailyPosts >= 120 || manualHoursMonth >= 120) {
    return {
      id: 'high',
      label: 'Alto atrito operacional',
      tone: 'red',
      description: 'O volume tende a exigir cadência, filtros e logs antes de aumentar a escala.',
    }
  }
  if (dailyPosts >= 45 || manualHoursMonth >= 45) {
    return {
      id: 'medium',
      label: 'Rotina em zona de atenção',
      tone: 'amber',
      description: 'Já existe espaço relevante para padronizar revisão, horários e grupos de destino.',
    }
  }
  return {
    id: 'low',
    label: 'Rotina leve, boa para organizar cedo',
    tone: 'emerald',
    description: 'O ganho principal é criar consistência antes que a operação fique pesada.',
  }
}

function resolveCadence({ offersPerDay, destinationGroups }) {
  const dailyPosts = offersPerDay * destinationGroups
  if (dailyPosts >= 120) return 'Comece testando janelas de envio e intervalos de 20–35 min entre postagens por grupo.'
  if (dailyPosts >= 45) return 'Use blocos de horário e intervalos de 12–20 min para reduzir ruído e retrabalho.'
  return 'Mantenha uma cadência simples, com revisão manual e intervalo mínimo configurado antes de escalar.'
}

export function calculateWhatsAppGroupTimeSavings(inputs = {}) {
  const safe = sanitizeCalculatorInputs(inputs)
  const weeklyOfferReviews = safe.offersPerDay * safe.daysPerWeek
  const monthlyOfferReviews = weeklyOfferReviews * MONTH_WEEKS
  const destinationComplexityMultiplier = 1 + Math.max(0, safe.destinationGroups - 1) * 0.35
  const sourceMonitoringMinutesMonth = safe.monitorGroups * safe.daysPerWeek * MONTH_WEEKS * 2
  const manualMinutesMonth = (monthlyOfferReviews * safe.minutesPerOffer * destinationComplexityMultiplier) + sourceMonitoringMinutesMonth
  const organizedMinutesMonth = manualMinutesMonth * 0.35
  const savedMinutesMonth = Math.max(0, manualMinutesMonth - organizedMinutesMonth)
  const manualHoursMonth = manualMinutesMonth / MINUTES_PER_HOUR
  const organizedHoursMonth = organizedMinutesMonth / MINUTES_PER_HOUR
  const savedHoursMonth = savedMinutesMonth / MINUTES_PER_HOUR
  const opportunityCost = savedHoursMonth * safe.hourlyValue
  const dailyPosts = safe.offersPerDay * safe.destinationGroups

  return {
    inputs: safe,
    monthlyOfferReviews: Math.round(monthlyOfferReviews),
    dailyPosts,
    manualHoursMonth,
    organizedHoursMonth,
    savedHoursMonth,
    opportunityCost,
    riskLevel: resolveRiskLevel({ offersPerDay: safe.offersPerDay, destinationGroups: safe.destinationGroups, manualHoursMonth }),
    cadenceRecommendation: resolveCadence({ offersPerDay: safe.offersPerDay, destinationGroups: safe.destinationGroups }),
  }
}

export { DEFAULT_INPUTS, INPUT_LIMITS }
