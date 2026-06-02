export const MOBILE_CONFIG_CONTRACT_KEYS = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText', 'delayMin', 'delayMax', 'blockedKeywords', 'platforms', 'feedGlobal', 'postToStatus']

function normalizeKeywords(text) {
  const parts = String(text || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  const unique = [...new Set(parts)]
  return unique.join(',')
}

function clampDelayInt(value, fallback) {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(300, Math.max(0, parsed))
}

export function buildMobilePreferencesPayload(draft = {}) {
  const stringKeys = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText']
  const stringPayload = stringKeys.reduce((payload, key) => {
    payload[key] = draft?.[key] ?? ''
    return payload
  }, {})

  const delayMin = clampDelayInt(draft?.delayMin, 5)
  const delayMaxRaw = clampDelayInt(draft?.delayMax, 15)
  const delayMax = delayMaxRaw < delayMin ? delayMin : delayMaxRaw

  return {
    ...stringPayload,
    delayMin,
    delayMax,
    blockedKeywords: normalizeKeywords(draft?.blockedKeywords),
    platforms: Array.isArray(draft?.platforms) ? draft.platforms : [],
    feedGlobal: Boolean(draft?.feedGlobal),
    postToStatus: Boolean(draft?.postToStatus),
  }
}

export function getMobileTemplatePresetNotice() {
  return 'Estes modelos são presets editáveis para montar ofertas rapidamente; eles são salvos no backend e sincronizam entre celular e computador.'
}
