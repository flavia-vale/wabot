// Política única de conversão de link de cupom (não-produto), válida para todos
// os conversores que implementam um caminho seguro de conversão.
//
// Default OFF: mantém o comportamento histórico (cupom não convertido) até a env
// ser ligada. Lido em runtime de propósito — rollout/rollback em prod é só mexer
// na env (sem redeploy). É um interruptor de rollout SEGURO: cada conversor
// remove o tracking do afiliado de origem e gera o link de afiliado próprio
// PRESERVANDO o caminho original do cupom (na Shopee, o short link da API abre
// direto o app — reescrever para uma landing web era o que disparava "navegador
// não aceito" no WebView do WhatsApp). Quando ligado, a conversão de cupom NÃO
// tem fallback de substituição/hardcode — converte ou (no pior caso, p/ nunca
// vazar link de terceiro) cai no strip seguro do próprio conversor.
export function shouldConvertCouponLinks() {
  return String(process.env.COUPON_LINK_CONVERT || '').trim().toLowerCase() === 'true'
}
