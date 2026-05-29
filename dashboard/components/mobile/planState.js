// Estado do plano derivado de `api.me()` — fonte única para as rotas /m.
//
// O backend expõe `plan` ('trial' | 'basic' | 'pro') e `accessExpiresAt`.
// A regra de "vencido" espelha src/api/routes/admin.js: acesso expirado
// quando `accessExpiresAt < agora`. Enquanto válido, 'trial' segue trial;
// planos pagos válidos contam como 'active'.
//
// Estados:
//  - 'expired' : accessExpiresAt no passado → espelhamento pausado, criar segue grátis
//  - 'trial'   : plano de teste ainda válido
//  - 'active'  : plano pago válido (comportamento padrão, sem realce)

export function derivePlanState(me) {
  if (!me) return 'active'
  const expiresAt = me.accessExpiresAt ? new Date(me.accessExpiresAt).getTime() : null
  if (expiresAt != null && Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return 'expired'
  }
  if (me.plan === 'trial') return 'trial'
  return 'active'
}

export function isPlanExpired(me) {
  return derivePlanState(me) === 'expired'
}

// Dias inteiros desde o vencimento (>= 0). Retorna null quando não vencido.
export function daysSinceExpiry(me) {
  if (!me?.accessExpiresAt) return null
  const expiresAt = new Date(me.accessExpiresAt).getTime()
  if (!Number.isFinite(expiresAt) || expiresAt >= Date.now()) return null
  return Math.max(0, Math.floor((Date.now() - expiresAt) / (24 * 60 * 60 * 1000)))
}
