export const MOBILE_CONFIG_CONTRACT_KEYS = ['welcomeMsg', 'brandingGroupLink', 'brandingCtaText']

export function buildMobilePreferencesPayload(draft = {}) {
  return MOBILE_CONFIG_CONTRACT_KEYS.reduce((payload, key) => {
    payload[key] = draft?.[key] ?? ''
    return payload
  }, {})
}

export function getMobileTemplatePresetNotice() {
  return 'Estes modelos são presets locais para montar ofertas rapidamente; eles não são salvos no backend ainda.'
}
