export const MOBILE_CONFIG_CONTRACT_KEYS = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText', 'blockedKeywords', 'platforms', 'postToStatus']

function normalizeKeywords(text) {
  const parts = String(text || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  const unique = [...new Set(parts)]
  return unique.join(',')
}

export function buildMobilePreferencesPayload(draft = {}) {
  const stringKeys = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText']
  const stringPayload = stringKeys.reduce((payload, key) => {
    payload[key] = draft?.[key] ?? ''
    return payload
  }, {})

  return {
    ...stringPayload,
    blockedKeywords: normalizeKeywords(draft?.blockedKeywords),
    platforms: Array.isArray(draft?.platforms) ? draft.platforms : [],
    postToStatus: Boolean(draft?.postToStatus),
  }
}

export function getMobileTemplatePresetNotice() {
  return 'Estes modelos são presets editáveis para montar ofertas rapidamente; eles são salvos no backend e sincronizam entre celular e computador.'
}
