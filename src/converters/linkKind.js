// Classifica um link convertido como 'product' ou 'coupon' a partir da URL,
// para consumidores que precisam distinguir "aponta pra um produto
// específico" de "aponta pra uma página sem produto" (cupom/campanha/
// listagem) — hoje: modo preview (banner de marca vs. foto do produto,
// bot-worker.js) e o guard de title_mismatch (mensagens de cupom não têm
// produto pra comparar título, então não podem ser bloqueadas por mismatch).
//
// shopee.js já marca `linkKind` no próprio retorno do converter (produto vs.
// cupom, decidido durante a conversão). amazon.js e mercadolivre.js NÃO
// marcam de forma confiável: amazon.js devolve string OU `{url,warning}` sem
// linkKind nenhum, e mercadolivre.js nunca tenta. Mudar o contrato de
// retorno desses dois converters pra sempre incluir linkKind quebraria as
// dezenas de testes existentes que fazem assert.equal/deepEqual no shape
// exato — por isso classificamos aqui, DE FORA, batendo regex na URL
// (original ou convertida), sem depender do converter ter cooperado.
//
// Efeito de bug real corrigido: mensagens de cupom Amazon/ML (sem código de
// afiliado com ASIN/MLB no link, ex. link genérico de campanha de cupons)
// caíam sempre no ramo "produto" — buscavam foto de produto aleatório no
// card do preview E podiam ser bloqueadas pelo guard de title_mismatch (que
// só exime mensagens de cupom).
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
