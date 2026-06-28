// Política única de conversão de link de cupom (não-produto), válida para todos
// os conversores que implementam um caminho seguro de conversão.
//
// Default OFF: mantém o comportamento histórico (cupom não convertido) até a env
// ser ligada. Lido em runtime de propósito — rollout/rollback em prod é só mexer
// na env (sem redeploy). É um interruptor de rollout SEGURO: cada conversor deve
// normalizar sua URL de origem antes da API quando a plataforma tiver rotas
// problemáticas (ex.: Shopee força cupom para `/m/cupom-de-desconto` para não abrir
// rotas app-only com "navegador não aceito"). Quando ligado, a conversão de
// cupom NÃO tem fallback de substituição/hardcode — converte ou (no pior caso,
// p/ nunca vazar link de terceiro) cai no strip seguro do próprio conversor.
export function shouldConvertCouponLinks() {
  return String(process.env.COUPON_LINK_CONVERT || '').trim().toLowerCase() === 'true'
}
