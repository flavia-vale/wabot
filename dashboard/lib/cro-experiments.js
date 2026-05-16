import { sanitizeAttributionValue } from './marketing-attribution.js'

const HOME_HERO_TONES = new Set(['amigavel', 'direto', 'animado'])

function firstValue(value) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return String(value ?? '')
}

function normalizeForcedTone(rawValue) {
  const tone = sanitizeAttributionValue(firstValue(rawValue), 24).toLowerCase()
  return HOME_HERO_TONES.has(tone) ? tone : ''
}

function stableToneFromSeed(seed) {
  const safeSeed = sanitizeAttributionValue(seed || 'direct', 96)
  const hash = Array.from(safeSeed).reduce((acc, char) => (acc + char.charCodeAt(0)) % 3, 0)
  return hash === 0 ? 'amigavel' : hash === 1 ? 'direto' : 'animado'
}

export function selectHomeHeroVariant(searchParams = {}) {
  const forcedTone = normalizeForcedTone(searchParams?.ab_home_hero)
  if (forcedTone) return { variant: `forced-${forcedTone}`, tone: forcedTone }

  const seed = firstValue(searchParams?.utm_campaign) || firstValue(searchParams?.utm_content) || 'direct'
  const tone = stableToneFromSeed(seed)
  return { variant: `campaign-${tone}`, tone }
}
