// Quando a mensagem de origem já traz uma foto BOA, vale a pena trocar pela
// foto oficial da loja? — módulo puro.
//
// RCA 2026-08-27 (cliente julianepumuceno16@gmail.com): duas origens dela
// ("Ofertas Mamãe Bebê #3" e "PROMO DO BEBÊ #12") anexam foto de verdade nas
// ofertas — e essa foto é do CONCORRENTE, com a marca d'água dele queimada em
// cima. Em `resolveMonitoredImage` (modo 'original') havia um atalho: foto
// cheia da origem é republicada direto, sem nem tentar a loja. Resultado: a
// cliente divulgava a marca de outra pessoa.
//
// Medido em produção: as origens que mandam SÓ a miniatura do card (Ofertas da
// Gio, OFERTAS BABY #2) já passavam pelo caminho de upgrade e voltaram a
// receber a foto limpa da loja depois do conserto de 26/08; as que anexam foto
// de verdade (348 e 370 `imageMessage` no log) nunca chegavam lá.
//
// Por que NÃO trocar sempre: buscar a foto da loja para qualquer link já nos
// mordeu antes — cupom genérico e link que não corresponde ao texto fazem o
// robô publicar a foto de um produto ALEATÓRIO (regressão da camiseta branca,
// 2026-06; banner de cupom em produto, #1205/#1208). A troca só é segura
// quando o link aponta para UM produto identificado.
//
// A trava é a mesma blindagem que o resto do pipeline já usa:
//   - `linkKind === 'product'`: o conversor resolveu ASIN/MLB/(shopId,itemId)
//     antes de gerar o link curto. É a afirmação mais forte que temos de que
//     o link aponta para um produto específico — e cobre a Shopee, que não tem
//     detector por regex mas marca `linkKind` no próprio converter.
//   - mensagem de cupom nunca troca: ali a ausência de produto é o normal.
//   - `titleOverlap === 'mismatch'`: o título raspado não bate com o texto da
//     oferta; trocar a foto pelo produto do link publicaria a foto errada.
//     'unknown' (Shopee e afins, fora do guard de scrape) NÃO bloqueia — a
//     garantia ali vem do `linkKind`, não do título.

export function isStorePhotoPreferenceEnabled(env = process.env) {
  // Ligado por padrão: a marca d'água do concorrente é dano ativo à cliente.
  // `STORE_PHOTO_OVER_ORIGIN=false` volta ao atalho histórico sem redeploy.
  return String(env?.STORE_PHOTO_OVER_ORIGIN ?? 'true') !== 'false'
}

/**
 * @returns {boolean} true = vale tentar a foto da loja no lugar da foto que
 * veio na mensagem de origem. A troca é sempre BEST-EFFORT: se a loja não
 * devolver foto, quem chama mantém a foto da origem (nunca perder imagem).
 */
export function shouldPreferStorePhoto({ linkKind, titleOverlap, isCouponMsg = false, enabled = true } = {}) {
  if (!enabled) return false
  if (isCouponMsg) return false
  if (linkKind !== 'product') return false
  if (titleOverlap === 'mismatch') return false
  return true
}
