export const PIX_KEY = 'd80c705f-3893-4802-939b-cce5c9338c66'

export const SUPPORT_WA_NUMBER = '5532999844020'

export const SUPPORT_PHONE_LABEL = '(32) 99984-4020'

export function buildPixWaLink(planName, price, email) {
  const safePlanName = planName || '—'
  const safePrice = price || '—'
  const safeEmail = email || '—'
  const message = `Olá, acabei de fazer o PIX do ${safePlanName} (${safePrice}/30 dias). Segue o comprovante para ativação da conta ${safeEmail}.`
  return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(message)}`
}
