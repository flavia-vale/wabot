const DEFAULT_PLANS = {
  basic: { title: 'BOTinho Basic - acesso por 30 dias', price: 39 },
  pro: { title: 'BOTinho Pro - acesso por 30 dias', price: 69 },
}

function parseCurrencyAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = String(value ?? '').replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function inferPlanFromAmountWithPlans(amount, plans) {
  for (const [key, info] of Object.entries(plans || {})) {
    if (info.price === Number(amount)) return key
  }
  return null
}

export function resolvePlanForPayment({ preferredPlan = null, amount = null, plans = {} } = {}) {
  const plan = String(preferredPlan ?? '').trim().toLowerCase()
  if (plan && plans[plan]) return plan
  return inferPlanFromAmountWithPlans(amount, plans)
}

export function createPaymentsService({ db, now = () => new Date() } = {}) {
  if (!db) throw new Error('createPaymentsService: db é obrigatório')

  async function getBillingPlans() {
    try {
      const rows = await db.lpPlan.findMany({ where: { id: { in: ['basic', 'pro'] } } })
      if (!rows.length) return DEFAULT_PLANS
      const dynamic = { ...DEFAULT_PLANS }
      for (const row of rows) {
        const fallback = DEFAULT_PLANS[row.id]
        if (!fallback) continue
        const parsedPrice = parseCurrencyAmount(row.price)
        dynamic[row.id] = {
          title: String(row.title || fallback.title),
          price: parsedPrice ?? fallback.price,
        }
      }
      return dynamic
    } catch {
      return DEFAULT_PLANS
    }
  }

  async function activatePaymentAccess(tx, { userId, plan, mpPaymentId, amount }) {
    const nowDate = now()
    const user = await tx.user.findUnique({ where: { id: userId }, select: { accessExpiresAt: true } })
    const currentExpiry = user?.accessExpiresAt ? new Date(user.accessExpiresAt) : null
    const baseDate = currentExpiry && currentExpiry > nowDate ? currentExpiry : nowDate
    const expiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const existing = await tx.payment.findUnique({ where: { mpPaymentId: String(mpPaymentId) } })

    if (existing?.status === 'approved') {
      if (existing.userId === userId) {
        return { alreadyActivated: true, expiresAt: existing.expiresAt }
      }
      const err = new Error('Este pagamento já foi utilizado por outra conta')
      err.code = 'PAYMENT_ALREADY_USED'
      throw err
    }
    if (existing) {
      await tx.payment.update({ where: { id: existing.id }, data: { status: 'approved', expiresAt, lastSyncedAt: nowDate } })
    } else {
      await tx.payment.create({
        data: { userId, mpPaymentId: String(mpPaymentId), plan, status: 'approved', amount, expiresAt, lastSyncedAt: nowDate },
      })
    }
    await tx.user.update({ where: { id: userId }, data: { plan, accessExpiresAt: expiresAt } })
    return { alreadyActivated: false, expiresAt }
  }

  return { getBillingPlans, activatePaymentAccess, DEFAULT_PLANS }
}

export { DEFAULT_PLANS }
