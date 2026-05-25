const DEFAULT_RISK_INPUTS = Object.freeze({
  channels: 3,
  groups: 5,
  offersPerDay: 18,
  identicalMessageRate: 70,
  minimumIntervalMinutes: 5,
  usesDedicatedChip: 'no',
  monitorsClicks: 'partial',
  hasRecoveryPlan: 'no',
})

const RISK_INPUT_LIMITS = Object.freeze({
  channels: { min: 0, max: 300 },
  groups: { min: 0, max: 500 },
  offersPerDay: { min: 1, max: 500 },
  identicalMessageRate: { min: 0, max: 100 },
  minimumIntervalMinutes: { min: 0, max: 240 },
})

function toFiniteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(key, value) {
  const limits = RISK_INPUT_LIMITS[key]
  const fallback = DEFAULT_RISK_INPUTS[key] ?? 0
  if (!limits) return value
  const number = toFiniteNumber(value, fallback)
  return Math.min(limits.max, Math.max(limits.min, number))
}

export function sanitizeRiskInputs(inputs = {}) {
  const safe = Object.fromEntries(
    Object.keys(RISK_INPUT_LIMITS).map((key) => [key, clamp(key, inputs[key])])
  )

  return {
    ...safe,
    usesDedicatedChip: ['yes', 'no'].includes(inputs.usesDedicatedChip) ? inputs.usesDedicatedChip : DEFAULT_RISK_INPUTS.usesDedicatedChip,
    monitorsClicks: ['yes', 'partial', 'no'].includes(inputs.monitorsClicks) ? inputs.monitorsClicks : DEFAULT_RISK_INPUTS.monitorsClicks,
    hasRecoveryPlan: ['yes', 'partial', 'no'].includes(inputs.hasRecoveryPlan) ? inputs.hasRecoveryPlan : DEFAULT_RISK_INPUTS.hasRecoveryPlan,
  }
}

function scoreVolume({ channels, groups, offersPerDay }) {
  const destinations = channels + groups
  const dailyPosts = destinations * offersPerDay
  if (dailyPosts >= 250) return 26
  if (dailyPosts >= 120) return 20
  if (dailyPosts >= 50) return 13
  return 6
}

function scoreInterval(minutes) {
  if (minutes >= 25) return 0
  if (minutes >= 12) return 6
  if (minutes >= 5) return 13
  return 20
}

function scoreVariation(rate) {
  if (rate <= 20) return 0
  if (rate <= 45) return 8
  if (rate <= 75) return 16
  return 22
}

function scoreDedicatedChip(value) {
  return value === 'yes' ? 0 : 18
}

function scoreMonitoring(value) {
  if (value === 'yes') return 0
  if (value === 'partial') return 8
  return 16
}

function scoreRecovery(value) {
  if (value === 'yes') return 0
  if (value === 'partial') return 7
  return 14
}

function resolveRiskBand(score) {
  if (score >= 72) {
    return {
      id: 'critico',
      label: 'Risco operacional crítico',
      tone: 'red',
      summary: 'Antes de ampliar volume, reduza rajadas, separe chip dedicado e crie plano de recuperação. A operação está concentrada demais em padrões frágeis.',
    }
  }
  if (score >= 50) {
    return {
      id: 'alto',
      label: 'Risco operacional alto',
      tone: 'orange',
      summary: 'A operação já precisa de limites, variações e monitoramento mais claros antes de escalar canais e grupos.',
    }
  }
  if (score >= 28) {
    return {
      id: 'moderado',
      label: 'Risco operacional moderado',
      tone: 'amber',
      summary: 'Há pontos bons, mas cadência, variação ou recuperação ainda podem virar gargalo quando o volume crescer.',
    }
  }
  return {
    id: 'baixo',
    label: 'Risco operacional baixo',
    tone: 'emerald',
    summary: 'Sua rotina parece mais controlada. Mantenha documentação, limites e monitoramento antes de aumentar destinos.',
  }
}

function buildRecommendations(inputs, scoreParts) {
  const recommendations = []
  if (scoreParts.chip > 0) recommendations.push('Separar um chip dedicado para a operação antes de ampliar canais ou grupos.')
  if (scoreParts.interval >= 13) recommendations.push('Aumentar intervalo mínimo entre publicações e criar janelas de envio por destino.')
  if (scoreParts.variation >= 16) recommendations.push('Reduzir mensagens idênticas com variação de chamada, emojis, ordem e contexto por destino.')
  if (scoreParts.monitoring >= 8) recommendations.push('Monitorar cliques, erros e sinais de queda por canal para pausar antes do prejuízo.')
  if (scoreParts.recovery >= 7) recommendations.push('Documentar canais, fontes, destinos e rotina de recriação para recuperação rápida.')
  if (recommendations.length < 3) recommendations.push('Revisar o checklist de preservação antes de cada aumento de volume.')
  return recommendations.slice(0, 5)
}

export function calculateWhatsAppRisk(inputs = {}) {
  const safe = sanitizeRiskInputs(inputs)
  const destinations = safe.channels + safe.groups
  const dailyPosts = destinations * safe.offersPerDay
  const scoreParts = {
    volume: scoreVolume(safe),
    interval: scoreInterval(safe.minimumIntervalMinutes),
    variation: scoreVariation(safe.identicalMessageRate),
    chip: scoreDedicatedChip(safe.usesDedicatedChip),
    monitoring: scoreMonitoring(safe.monitorsClicks),
    recovery: scoreRecovery(safe.hasRecoveryPlan),
  }
  const score = Math.min(100, Object.values(scoreParts).reduce((total, value) => total + value, 0))
  const band = resolveRiskBand(score)

  return {
    inputs: safe,
    destinations,
    dailyPosts,
    score,
    scoreParts,
    band,
    recommendations: buildRecommendations(safe, scoreParts),
  }
}

export { DEFAULT_RISK_INPUTS, RISK_INPUT_LIMITS }
