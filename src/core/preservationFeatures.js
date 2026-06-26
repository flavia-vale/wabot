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

// shouldMutateOutgoingImage: predicado elegível (canal OU grupo) para destinos
// que poderiam receber mutação de imagem. NÃO é usado no gate de produção —
// o bot-worker aplica mutação só em canal (`isChannelDest && ...`), por decisão
// de produto, não mais por limitação técnica.
//
// A dupla compressão que antes impedia mutar grupos foi eliminada: o crop +
// qualidade variada agora vão DENTRO do encode de normalizeImageForWhatsApp
// (passo único de sharp). Reativar mutação em grupos hoje é só trocar o gate
// no bot-worker para incluir grupo — mas isso é decisão de produto separada
// (custo de CPU/RAM por destino, ganho real de anti-fingerprint em grupo).
// Esta função existe como esse ponto de extensão e para os testes unitários.
export function shouldMutateOutgoingImage(destJid, preservationActive, botConfig) {
  if (!isMirrorableJid(destJid)) return false
  return isPreservationFeatureEnabled(preservationActive, botConfig, PRESERVATION_FEATURE.IMAGE_MUTATION)
}

