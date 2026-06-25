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

// Issue #1033 (escopo revisado 2026-06-24): a mutação de imagem permanece um
// toggle GLOBAL (configurações avançadas / BotConfig.imageMutationActive), mas
// deixa de ser exclusiva de CANAL. O anti-fingerprint de imagem repetida
// também protege GRUPO-destino, então o gate passa a aceitar canal OU grupo.
//
// A exclusão dos envios de grupo que usam o caminho de relay (mídia original
// já hospedada, não mutável) é ESTRUTURAL no bot-worker (early-return antes do
// bloco de mutação) — não cabe a este predicado. Aqui só decidimos se o destino
// é elegível e se o opt-in global está ligado.
export function shouldMutateOutgoingImage(destJid, preservationActive, botConfig) {
  if (!isMirrorableJid(destJid)) return false
  return isPreservationFeatureEnabled(preservationActive, botConfig, PRESERVATION_FEATURE.IMAGE_MUTATION)
}

