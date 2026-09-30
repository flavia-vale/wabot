// Link rastreado (clique contado) no texto da oferta — integração do
// clickTracker (src/core/clickTracker.js + GET /r/:hash) com o envio do robô.
//
// Onde entra: DEPOIS da conversão e da trava do espelhamento
// (core/mirrorLinkGuard.js), no passo de montar o payload do envio. Os
// conversores (src/converters/, bloco protegido) não mudam: eles continuam
// devolvendo o link de afiliado da cliente, e é ESSE link, byte a byte, que o
// shortlink guarda e para onde o /r/:hash redireciona.
//
// Regras (docs/rca/lojas-conversao.md, "Link rastreado"):
//   - Desligado por padrão. Só liga com as três coisas juntas: a cliente tem o
//     flag `BotConfig.clickTrackingEnabled`, o plano dá acesso (PRO/Trial) e o
//     servidor tem `SHORTLINK_BASE_URL` válido. Faltou uma → texto intacto,
//     exatamente o mesmo objeto string de hoje.
//   - Só troca link CONVERTIDO de verdade (nunca passthrough/original), de loja
//     conhecida (host ancorado na lista abaixo) e público (ssrfGuard). O hash
//     só aponta para link que nós mesmos geramos.
//   - Qualquer falha ao criar o shortlink = aquele link sai como sai hoje
//     (link de afiliado direto). Rastreio nunca derruba nem atrasa oferta.
//   - A foto/card continua vindo do link REAL: quem monta o card recebe o
//     shortlink só como âncora de texto (`anchorFor`).
//
// Módulo puro: sem banco, sem rede, sem env direto (tudo injetado).

import { isHostInDomainList } from '../detector.js'
import { isSafePublicUrl } from './ssrfGuard.js'

// Domínios OFICIAIS das lojas que os conversores devolvem. Encurtador de
// terceiro (amzn.divulgador.link etc.) fica de fora de propósito: não é link
// que nós geramos.
export const TRACKABLE_STORE_DOMAINS = Object.freeze([
  // Mercado Livre
  'mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com', 'meli.la', 'mluvem.com',
  // Amazon
  'amazon.com.br', 'amzn.to', 'amzn.la', 'a.co',
  // Shopee
  'shopee.com.br', 'shope.ee',
  // Magalu
  'magazineluiza.com.br', 'magazinevoce.com.br', 'mlz.me',
  // SHEIN
  'shein.com', 'shein.top',
  // AliExpress
  'aliexpress.com', 'aliexpress.us',
])

// Teto por mensagem: limita escrita no banco numa mensagem com muitos links.
export const MAX_TRACKED_LINKS_PER_MESSAGE = 5

/** Link de afiliado de loja conhecida, http(s) e público. */
export function isTrackableAffiliateUrl(url) {
  if (typeof url !== 'string' || !url) return false
  if (!isSafePublicUrl(url)) return false
  let parsed
  try { parsed = new URL(url) } catch { return false }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (parsed.username || parsed.password) return false
  return isHostInDomainList(parsed.hostname, TRACKABLE_STORE_DOMAINS)
}

/**
 * Normaliza `SHORTLINK_BASE_URL`. Devolve '' (recurso desligado) quando falta
 * ou não é uma URL http(s) sem caminho de consulta.
 */
export function normalizeShortlinkBaseUrl(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  let parsed
  try { parsed = new URL(value) } catch { return '' }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
  if (parsed.search || parsed.hash || parsed.username || parsed.password) return ''
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
}

/**
 * Decide se o link rastreado vale para esta conta.
 *
 * @param {{ botConfig?: object, planAllows?: boolean, baseUrl?: string }} input
 * @returns {{ enabled: boolean, baseUrl: string, reason: string|null }}
 */
export function resolveTrackedLinkSettings({ botConfig, planAllows, baseUrl } = {}) {
  if (botConfig?.clickTrackingEnabled !== true) return { enabled: false, baseUrl: '', reason: 'flag_off' }
  if (planAllows !== true) return { enabled: false, baseUrl: '', reason: 'plan' }
  const normalized = normalizeShortlinkBaseUrl(baseUrl)
  if (!normalized) return { enabled: false, baseUrl: '', reason: 'no_base_url' }
  return { enabled: true, baseUrl: normalized, reason: null }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Fim do link no texto: fim/espaço, fechamento/formatação do WhatsApp, ou
// pontuação seguida de fim/espaço (a mesma que normalizeDetectedUrl tira).
// Impede que `https://amzn.to/abc` case dentro de `https://amzn.to/abcd`.
const URL_END = String.raw`(?=$|\s|[)\]}'"*_~\x60>]|[.,;:!?](?:$|\s|[)\]}'"*_~\x60>.,;:!?]))`

function replaceExactUrl(text, url, replacement) {
  const re = new RegExp(escapeRegExp(url) + URL_END, 'g')
  return text.replace(re, () => replacement)
}

/**
 * Troca, no texto, cada link convertido pelo shortlink rastreado.
 *
 * @param {string} text texto que vai sair (já convertido e já checado pela trava)
 * @param {Array<{converted?: string, passthrough?: boolean}>} conversions
 * @param {{ enabled: boolean, createLink?: (url: string) => Promise<{shortUrl: string}>, onError?: (err: Error, url: string) => void }} opts
 * @returns {Promise<{ text: string, anchors: Map<string, string> }>}
 *   `anchors`: link convertido → shortlink que entrou no texto.
 */
export async function applyTrackedLinks(text, conversions, { enabled, createLink, onError } = {}) {
  const anchors = new Map()
  if (!enabled || typeof createLink !== 'function' || typeof text !== 'string' || !text) {
    return { text, anchors }
  }
  const candidates = [...new Set(
    (Array.isArray(conversions) ? conversions : [])
      .filter(c => c && !c.passthrough && typeof c.converted === 'string')
      .map(c => c.converted),
  )]
    .filter(isTrackableAffiliateUrl)
    .filter(url => new RegExp(escapeRegExp(url) + URL_END).test(text))
    // Mais longo primeiro: um link que é prefixo de outro não pode ser trocado
    // antes do maior (a âncora URL_END já impede, isto é redundância barata).
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_TRACKED_LINKS_PER_MESSAGE)

  if (!candidates.length) return { text, anchors }

  let out = text
  for (const url of candidates) {
    let shortUrl = null
    try {
      const created = await createLink(url)
      shortUrl = typeof created?.shortUrl === 'string' ? created.shortUrl : null
    } catch (err) {
      try { onError?.(err, url) } catch { /* best-effort */ }
      continue
    }
    if (!shortUrl || !/^https?:\/\//i.test(shortUrl)) continue
    out = replaceExactUrl(out, url, shortUrl)
    anchors.set(url, shortUrl)
  }
  return { text: anchors.size ? out : text, anchors }
}

/**
 * Âncora de texto do card para um link convertido: o shortlink quando ele
 * entrou no texto, senão undefined (o card usa o link convertido, como hoje).
 */
export function anchorFor(anchors, convertedUrl) {
  if (!anchors || typeof anchors.get !== 'function' || !convertedUrl) return undefined
  return anchors.get(convertedUrl)
}
