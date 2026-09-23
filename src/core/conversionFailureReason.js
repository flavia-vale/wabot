// Por que NENHUM link da mensagem virou link de afiliado.
//
// Historicamente essa linha era gravada como `skip:no_valid_conversions` seca,
// sem motivo nenhum, e o painel traduzia isso para "faltou cadastrar a loja".
// A etiqueta era usada para TODAS as causas — inclusive quando a loja estava
// cadastrada e funcionando. Caso real (2026-09-09): 398 ofertas de Shopee
// marcadas como "faltou cadastrar a loja" numa conta cuja chave respondia
// `alive: true` na sondagem e que teve 248 envios de Shopee com sucesso na
// MESMA janela. A cliente foi mexer num cadastro que estava certo.
//
// O motivo passa a viajar junto no próprio errorMsg (sufixo), então painel,
// aviso e diagnóstico contam a mesma história a partir de um lugar só.
//
// Módulo puro: sem banco, sem rede, sem env.

export const NO_VALID_CONVERSIONS_PREFIX = 'skip:no_valid_conversions'

export const CONVERSION_FAILURE = Object.freeze({
  /** Falta cadastrar (ou completar) a loja. É o ÚNICO caso que a etiqueta
   *  "faltou cadastrar a loja" pode afirmar. */
  MISSING_CREDENTIAL: 'missing_credential',
  /** A loja está desligada nas configurações DESTE grupo monitorado. O cadastro
   *  pode estar perfeito — o robô nem chegou a tentar converter. */
  STORE_DISABLED: 'store_disabled',
  /** O robô tentou converter e não conseguiu agora (a loja não respondeu, o
   *  link não pôde ser lido, a resposta veio incompleta). Costuma ser passageiro
   *  e a mesma oferta converte na tentativa seguinte. */
  CONVERSION_FAILED: 'conversion_failed',
})

// Mais acionável primeiro: falta de cadastro é o que a cliente resolve em um
// minuto; loja desligada é uma chave no painel; falha de conversão pode nem
// exigir ação dela. Uma mensagem com vários links reporta o mais acionável.
const PRECEDENCE = [
  CONVERSION_FAILURE.MISSING_CREDENTIAL,
  CONVERSION_FAILURE.STORE_DISABLED,
  CONVERSION_FAILURE.CONVERSION_FAILED,
]

const KNOWN = new Set(PRECEDENCE)

/**
 * Escolhe o motivo que representa a mensagem inteira.
 * @param {Array<string|null|undefined>} reasons um motivo por link que falhou
 * @returns {string|null} motivo canônico, ou null quando nenhum é conhecido
 */
export function pickConversionFailureReason(reasons = []) {
  const presentes = new Set((Array.isArray(reasons) ? reasons : []).filter(r => KNOWN.has(r)))
  for (const candidato of PRECEDENCE) {
    if (presentes.has(candidato)) return candidato
  }
  return null
}

/**
 * Monta o `errorMsg` da linha. Sem motivo conhecido devolve o prefixo seco —
 * o formato histórico —, porque inventar um motivo é o defeito que este módulo
 * existe para corrigir.
 */
export function buildNoValidConversionsErrorMsg(reasons = []) {
  const motivo = pickConversionFailureReason(reasons)
  return motivo ? `${NO_VALID_CONVERSIONS_PREFIX}:${motivo}` : NO_VALID_CONVERSIONS_PREFIX
}

/**
 * Prefixo exato das linhas que PODEM afirmar falta de cadastro. Serve para
 * filtrar no banco sem trazer as demais causas junto.
 */
export const MISSING_CREDENTIAL_ERROR_PREFIX = `${NO_VALID_CONVERSIONS_PREFIX}:${CONVERSION_FAILURE.MISSING_CREDENTIAL}`

/** Lê o motivo de volta a partir do errorMsg gravado. */
export function parseConversionFailureReason(errorMsg) {
  if (typeof errorMsg !== 'string') return null
  if (!errorMsg.startsWith(NO_VALID_CONVERSIONS_PREFIX)) return null
  const resto = errorMsg.slice(NO_VALID_CONVERSIONS_PREFIX.length)
  if (!resto.startsWith(':')) return null
  const motivo = resto.slice(1)
  return KNOWN.has(motivo) ? motivo : null
}

/**
 * A linha pode AFIRMAR que faltou cadastrar a loja?
 *
 * Só quando o motivo gravado diz isso. Linha antiga (sem motivo) NÃO afirma:
 * ela é anterior a esta medição e não sabemos a causa — e afirmar por dúvida
 * foi exatamente o que mandou a cliente refazer um cadastro que estava certo.
 */
export function isMissingCredentialFailure(errorMsg) {
  return parseConversionFailureReason(errorMsg) === CONVERSION_FAILURE.MISSING_CREDENTIAL
}

/** A linha é "nenhum link pôde ser convertido", de qualquer causa? */
export function isNoValidConversionsErrorMsg(errorMsg) {
  return typeof errorMsg === 'string' && errorMsg.startsWith(NO_VALID_CONVERSIONS_PREFIX)
}

/**
 * A mensagem tem pelo menos um link convertido com a credencial da cliente?
 *
 * Link que a loja não deixou converter volta do worker como "passthrough", com
 * o endereço ORIGINAL do grupo de origem, que é o link de afiliado de outra
 * pessoa. Ele pode acompanhar um link convertido na mesma mensagem, mas sozinho
 * não pode sair: seria publicar a oferta com a comissão indo para o
 * concorrente. RCA 2026-09-23: com a chave da Shopee recusada, 774 envios de
 * uma conta saíram assim em 3 dias, todos registrados como sucesso.
 */
export function hasPublishableConversion(conversions = []) {
  return (Array.isArray(conversions) ? conversions : []).some(c => c && c.converted && !c.passthrough)
}
