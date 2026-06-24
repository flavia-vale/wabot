export const PRESERVATION_FEATURE = Object.freeze({
  CHANNEL_THROTTLE: 'channelThrottleEnabled',
  QUIET_HOURS: 'quietHoursEnabled',
  FOLLOW_GUARD: 'followGuardEnabled',
  COPY_VARIATION: 'copyVariationEnabled',
  IMAGE_MUTATION: 'imageMutationActive',
  PROBE: 'probeEnabled',
})

// Plano B / Fase 3: a cadência/janela (throttle + quiet hours) deixou de ser
// global e passou a ser POR DESTINO (preset/HARD_DEFAULT), sempre ativa — então
// CHANNEL_THROTTLE/QUIET_HOURS não definem mais "preservação ativa" da CONTA.
// O sinal de conta agora deriva só das features opcionais que continuam globais.
export const ACCOUNT_PRESERVATION_FEATURES = Object.freeze([
  PRESERVATION_FEATURE.FOLLOW_GUARD,
  PRESERVATION_FEATURE.COPY_VARIATION,
  PRESERVATION_FEATURE.IMAGE_MUTATION,
  PRESERVATION_FEATURE.PROBE,
])

export function isPreservationFeatureEnabled(preservationActive, botConfig, feature) {
  return preservationActive === true && botConfig?.[feature] === true
}

