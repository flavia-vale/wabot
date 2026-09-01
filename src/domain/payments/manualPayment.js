const PAID_PLANS = new Set(['basic', 'pro'])
const PAYMENT_METHODS = new Set(['pix', 'transfer', 'cash', 'card', 'other'])

export function parseManualPaymentInput(body = {}) {
  const userId = String(body.userId ?? '').trim()
  const plan = String(body.plan ?? '').trim().toLowerCase()
  const days = Number(body.days)
  const amount = typeof body.amount === 'string'
    ? Number(body.amount.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
    : Number(body.amount)
  const paymentMethod = String(body.paymentMethod ?? '').trim().toLowerCase()
  const note = String(body.note ?? '').trim()

  if (!userId) return { ok: false, error: 'Selecione o cliente que fez o pagamento.' }
  if (!PAID_PLANS.has(plan)) return { ok: false, error: 'Selecione o plano Basic ou Pro.' }
  if (!Number.isInteger(days) || days < 1 || days > 3650) return { ok: false, error: 'Informe uma quantidade de dias entre 1 e 3650.' }
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return { ok: false, error: 'Informe o valor recebido corretamente.' }
  if (!PAYMENT_METHODS.has(paymentMethod)) return { ok: false, error: 'Selecione como o pagamento foi recebido.' }
  if (note.length > 500) return { ok: false, error: 'A observação deve ter no máximo 500 caracteres.' }

  return { ok: true, data: { userId, plan, days, amount: Math.round(amount * 100) / 100, paymentMethod, note: note || null } }
}

export function calculateManualPaymentExpiry({ currentExpiry, days, now = new Date() }) {
  const expiry = currentExpiry ? new Date(currentExpiry) : null
  const base = expiry && !Number.isNaN(expiry.getTime()) && expiry > now ? expiry : now
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}
