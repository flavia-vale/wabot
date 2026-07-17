// Classifica um link convertido como 'product' ou 'coupon' a partir da URL,
// para consumidores que precisam distinguir "aponta pra um produto
// específico" de "aponta pra uma página sem produto" (cupom/campanha/
// listagem) — hoje: modo preview (banner de marca vs. foto do produto,
// bot-worker.js) e o guard de title_mismatch (mensagens de cupom não têm
// produto pra comparar título, então não podem ser bloqueadas por mismatch).
//
// shopee.js, amazon.js e mercadolivre.js já marcam `linkKind` no próprio
// retorno do converter (produto vs. cupom, decidido durante a conversão —
// eles sabem a resposta certa porque já resolveram ASIN/MLB internamente
// antes de gerar o link curto). O fallback por regex abaixo só entra em ação
// quando o converter não cooperou (plataforma sem `PRODUCT_ID_DETECTORS`, ou
// chamada fora do fluxo normal de conversão).
//
// Por que o fallback sozinho NÃO basta: amzn.to/meli.la (short links de
// afiliado) nunca expõem ASIN/MLB no texto da URL final — batendo regex só
// nela, um produto de verdade com short link virava sempre 'coupon'. Por
// isso amazon.js/mercadolivre.js foram migrados a devolver `{url, linkKind}`
// sempre, e `resolveLinkKind` prioriza esse valor explícito.
const AMAZON_ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product-reviews\/|\/exec\/obidos\/ASIN\/)([A-Z0-9]{10})/i
const MLB_ID_RE = /\bMLB[-_]?([0-9]{6,})\b/i

const PRODUCT_ID_DETECTORS = {
  amazon: (url) => AMAZON_ASIN_RE.test(url),
  mercadolivre: (url) => MLB_ID_RE.test(url),
}

// `existingLinkKind` vence sempre que presente (respeita o que o converter
// já decidiu, ex. shopee.js). Só entra em ação quando ausente/undefined.
export function resolveLinkKind(platform, { url, converted, linkKind: existingLinkKind } = {}) {
  if (existingLinkKind) return existingLinkKind
  const detector = PRODUCT_ID_DETECTORS[platform]
  if (!detector) return undefined
  if (detector(String(converted || '')) || detector(String(url || ''))) return 'product'
  return 'coupon'
}

// Detector de ID de produto reusável fora do fluxo de `resolveLinkKind`
// (ex.: blindagem tripla do banner de marca em couponBrandCardPolicy.js).
// Retorna true se a URL revela ASIN (Amazon) ou MLB (Mercado Livre); false
// para short links sem ID e para plataformas sem detector. Não tem efeito
// sobre `resolveLinkKind`, que permanece byte-a-byte inalterado (FR-010).
export function urlHasProductId(platform, url) {
  const detector = PRODUCT_ID_DETECTORS[platform]
  if (!detector) return false
  return detector(String(url || ''))
}
