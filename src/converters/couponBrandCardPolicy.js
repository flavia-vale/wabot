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

// Sinal de TEXTO da blindagem tripla, decidido num lugar só (RCA 2026-09-18).
//
// O banner de cupom depende de três condições, e duas delas caem sozinhas
// quando o link é curto (`meli.la`, `/sec/`): a URL não expõe MLB/ASIN, então
// `linkKind` vira 'coupon' e `urlHasProductId` é false. Sobra o sinal de texto
// como ÚNICA trava real — e ele aceitava `ml_vitrine_fallback_used` direto.
//
// Esse aviso NÃO é sinal de texto: ele diz que a CONVERSÃO FALHOU e que a
// vitrine da cliente foi publicada no lugar do produto. Com ele, o mesmo fato
// (a conversão falhou) ligava as três blindagens de uma vez — blindagem tripla
// com causa única não blinda nada. Em produção isso pôs o banner "CUPOM" em
// ofertas de perfume, fone, panela e notebook.
//
// A vitrine só é sinal legítimo quando temos CERTEZA de que a origem era mesmo
// uma vitrine/perfil — isto é, quando o link COMPARTILHADO já era uma página
// `/social/` (isDirectVitrineShare, em converters/mercadolivre.js). Atrás de um
// encurtador pode haver produto de verdade, e foi exatamente esse o caso.
export function resolveCouponTextSignal({
  couponSkipActiveFetch,
  warning,
  vitrineConfirmed,
} = {}) {
  if (couponSkipActiveFetch === true) return true
  if (warning !== 'ml_vitrine_fallback_used') return false
  return vitrineConfirmed === true
}
