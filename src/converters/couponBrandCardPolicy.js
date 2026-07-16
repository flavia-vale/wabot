// Blindagem tripla do banner de marca "CUPOM + loja" no modo preview
// (bot-worker.js, buildManualLinkPreview). Módulo LEAF puro: sem I/O, sem
// import de bot-worker.js/db.js/sockets — mesma família de couponPolicy.js/
// reconnectPolicy.js/mlVitrinePolicy.js, testável isoladamente.
//
// Contexto (não regredir): #1205/#1208 — produto Amazon/ML compartilhado por
// short link (amzn.to, meli.la) tem `linkKind === 'coupon'` só porque a URL
// curta não expõe ASIN/MLB (resolveLinkKind não tem como saber que é produto
// sem raspar). Se o banner disparasse só por `linkKind === 'coupon'`, produto
// real por short link sairia com banner em vez de foto — regressão grave.
// Por isso a decisão exige, além de `linkKind === 'coupon'`, um SINAL DE
// TEXTO independente (mensagem confirma cupom/vitrine) e ausência de ID de
// produto na URL final. Na dúvida (qualquer condição ausente/falsa), a
// resposta é sempre `false` — comportamento atual (foto do produto).
import { isBrandCardPlatform } from './storeBrandCard.js'
import { urlHasProductId } from './linkKind.js'

export function shouldUseCouponBrandCard({
  enabled,
  platform,
  linkKind,
  couponTextSignal,
  resolvedUrl,
} = {}) {
  if (enabled !== true) return false
  if (!isBrandCardPlatform(platform)) return false
  if (linkKind !== 'coupon') return false
  if (couponTextSignal !== true) return false
  if (urlHasProductId(platform, resolvedUrl)) return false
  return true
}
