import { isMirrorableJid } from './jid.js'

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

// shouldMutateOutgoingImage: predicado elegível para destinos que devem ter
// mutação de imagem aplicada. Atualmente NÃO é usado no bot-worker —
// o gate direto `isChannelDest && isPreservationFeatureEnabled(...)` é
// mantido lá para evitar dupla compressão JPEG em grupos (vide invariante
// no bot-worker, commit image-upload-bug-fix 2026-06).
//
// Esta função existe para testes unitários de preservationFeatures e como
// ponto de extensão futuro. Para ativar em grupos será necessário antes
// combinar normalizeImageForWhatsApp + mutateChannelImage em um único passo
// de sharp (sem recompressão JPEG dupla).
export function shouldMutateOutgoingImage(destJid, preservationActive, botConfig) {
  if (!isMirrorableJid(destJid)) return false
  return isPreservationFeatureEnabled(preservationActive, botConfig, PRESERVATION_FEATURE.IMAGE_MUTATION)
}

