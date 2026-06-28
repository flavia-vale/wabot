// Política única de conversão de link de cupom (não-produto), válida para TODOS
// os conversores (Shopee, Amazon, Mercado Livre, Magalu).
//
// Default OFF: mantém o comportamento histórico (cupom não convertido) até a env
// ser ligada. Lido em runtime de propósito — rollout/rollback em prod é só mexer
// na env (sem redeploy). É um interruptor de rollout SEGURO: os caminhos com
// risco real (Shopee pode disparar "navegador não aceito" no WebView; ML pode
// não creditar comissão em página não-produto) só passam a valer aqui DEPOIS de
// validados em staging. Quando ligado, a conversão de cupom NÃO tem fallback de
// substituição/hardcode — converte ou (no pior caso, p/ nunca vazar link de
// terceiro) cai no strip seguro do próprio conversor.
export function shouldConvertCouponLinks() {
  return String(process.env.COUPON_LINK_CONVERT || '').trim().toLowerCase() === 'true'
}
