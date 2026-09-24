// Checkbox "Inserir cupons cadastrados" do Criar oferta (specs/017, decisões da
// dona do produto em 2026-09-23):
// - marcado (padrão): a oferta sai com o melhor cupom da loja MESMO se o
//   template não tiver {cupom} — a linha entra logo abaixo da linha do preço;
// - template que já tem {cupom}: usa esse lugar, nunca duplica;
// - desmarcado: vale o template (se ele tiver {cupom}, o cupom sai igual).
// Quem escolhe o cupom de verdade é o robô, na hora do envio. Aqui só se
// decide ONDE o marcador fica e o que a prévia/cópia mostram agora.
import { chooseCoupon, renderCouponText, applyCouponToken } from '../../src/core/clientCouponPolicy.js'

const COUPON_TOKEN_RE = /\{cupom\}/

export function hasCouponToken(text) {
  return COUPON_TOKEN_RE.test(String(text ?? ''))
}

// Garante UM lugar para o cupom: abaixo da primeira linha com o preço; sem
// linha de preço, logo antes da linha do link; sem as duas, no fim.
export function ensureCouponSlot(body, { priceMarker = '{preço}', linkMarker = '{link}' } = {}) {
  const text = String(body ?? '')
  if (!text.trim() || hasCouponToken(text)) return body
  const lines = text.split('\n')
  const priceIndex = priceMarker ? lines.findIndex((line) => line.includes(priceMarker)) : -1
  if (priceIndex >= 0) {
    lines.splice(priceIndex + 1, 0, '{cupom}')
    return lines.join('\n')
  }
  const linkIndex = linkMarker ? lines.findIndex((line) => line.includes(linkMarker)) : -1
  if (linkIndex >= 0) {
    lines.splice(linkIndex, 0, '{cupom}')
    return lines.join('\n')
  }
  return `${text.replace(/\s+$/, '')}\n{cupom}`
}

// O melhor cupom de AGORA, para a prévia e para "Copiar". '' quando não há.
export function currentCouponText({ coupons, platform, priceCents, now = Date.now() } = {}) {
  try {
    const choice = chooseCoupon({ coupons, platform, priceCents, now })
    return choice ? renderCouponText({ coupon: choice.coupon, priceCents, finalPriceCents: choice.finalPriceCents }) : ''
  } catch {
    return ''
  }
}

// Texto que sai sem passar pelo robô (prévia e Copiar): o marcador vira o
// cupom de agora, ou some sem deixar linha vazia.
export function resolveCouponForDisplay(text, couponText) {
  return applyCouponToken(String(text ?? ''), couponText || '')
}
