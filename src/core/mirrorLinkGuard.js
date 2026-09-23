// Trava de publicação do ESPELHAMENTO: link de loja que não virou link da
// cliente nunca sai no grupo.
//
// No espelhamento todo link de loja que chega é de OUTRO afiliado (o dono do
// grupo de origem). Publicá-lo como veio dá a comissão ao concorrente. Medido
// em produção (2026-09-23): 774 envios de Shopee em 3 dias saíram assim numa
// conta só, e mais 20 em outra, todos gravados como "sucesso". Três caminhos
// deixavam isso acontecer:
//
//   1. O conversor pedia "remover o link" (`stripFromMessage`: cupom da Shopee
//      recusado, qualquer falha do AliExpress) e o robô fazia o contrário:
//      mantinha o link original no texto ("passthrough").
//   2. Mensagem com vários links em que UM falhou: a troca no texto só mexe nos
//      que converteram, então o que falhou ficava com o link do concorrente.
//   3. Link de loja escrito sem `https://` (`meli.la/abc`, `s.shopee.com.br/x`):
//      o detector só enxerga URL com protocolo, então ele nem entrava na
//      conversão, mas o WhatsApp o transforma em link clicável do mesmo jeito.
//
// Regra (decisão da dona do produto, 2026-09-23): se não conseguir converter,
// NÃO envia. Oferta não enviada é recuperável; oferta enviada com o link do
// concorrente não é.
//
// Módulo puro: sem banco, sem rede, sem env.

import { PATTERNS, detectLinks, normalizeDetectedUrl } from '../detector.js'
import { CONVERSION_FAILURE, buildNoValidConversionsErrorMsg } from './conversionFailureReason.js'

/** Resultado de conversão que pode ir ao grupo: link NOSSO, não o original. */
function isRealConversion(result) {
  return Boolean(result && result.converted && !result.passthrough)
}

/**
 * Decide se a mensagem pode ser publicada a partir do resultado de CADA link.
 * Publica só quando TODOS os links de loja viraram link da cliente.
 *
 * @param {Array<object|null>} linkResults um item por link detectado
 * @returns {{ publish: boolean, errorMsg: string|null, failedCount: number }}
 */
export function decideMirrorConversions(linkResults = []) {
  const results = Array.isArray(linkResults) ? linkResults : []
  const failed = results.filter(r => !isRealConversion(r))
  if (results.length && !failed.length) return { publish: true, errorMsg: null, failedCount: 0 }
  // Sem motivo conhecido (item nulo, passthrough antigo) conta como falha de
  // conversão — nunca como sucesso.
  const reasons = failed.map(r => r?.failureReason || CONVERSION_FAILURE.CONVERSION_FAILED)
  return {
    publish: false,
    errorMsg: buildNoValidConversionsErrorMsg(reasons.length ? reasons : [CONVERSION_FAILURE.CONVERSION_FAILED]),
    failedCount: failed.length,
  }
}

// Mesmo conjunto de lojas do detector, mas SEM exigir `https://`. O lookbehind
// impede casar pedaço de URL que já tem protocolo (`://meli.la/...`), e-mail
// (`@`) ou subdomínio cortado (`.`).
const BARE_STORE_LINK_RES = Object.values(PATTERNS).map(re => new RegExp(
  String.raw`(?<![\w./@:%-])` + re.source.replace(/^https\?:(?:\\\/\\\/|\/\/)/, ''),
  'gi',
))

// Domínio solto sem caminho ("compre na shopee.com.br") não carrega afiliado de
// ninguém; só vira risco quando tem caminho depois do domínio.
function hasPathAfterHost(match) {
  const slash = match.indexOf('/')
  return slash > 0 && slash < match.length - 1
}

/**
 * Links de loja que continuam no texto sem ser um link convertido da cliente.
 * Rede de segurança FINAL: qualquer item devolvido aqui é link de concorrente
 * prestes a ir para o grupo.
 *
 * @param {string} text texto que vai ser publicado
 * @param {Array<{converted?: string, passthrough?: boolean}>} conversions
 * @returns {string[]}
 */
export function findUnconvertedStoreLinks(text, conversions = []) {
  const body = String(text ?? '')
  if (!body) return []
  const allowed = new Set(
    (Array.isArray(conversions) ? conversions : [])
      .filter(isRealConversion)
      .map(c => normalizeDetectedUrl(String(c.converted))),
  )
  const leaks = []
  for (const { url } of detectLinks(body)) {
    if (!allowed.has(url)) leaks.push(url)
  }
  // Os links convertidos saem do texto antes da busca sem `https://`: o
  // endereço de afiliado pode carregar outro endereço de loja dentro dele.
  let semConvertidos = body
  for (const url of allowed) semConvertidos = semConvertidos.split(url).join(' ')
  for (const re of BARE_STORE_LINK_RES) {
    re.lastIndex = 0
    for (const m of semConvertidos.matchAll(re)) {
      const bare = normalizeDetectedUrl(m[0], semConvertidos.slice(0, m.index))
      if (hasPathAfterHost(bare)) leaks.push(bare)
    }
  }
  return [...new Set(leaks)]
}
