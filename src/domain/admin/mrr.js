// MRR canônico do admin: UMA conta, usada pela visão geral e pelo ROI.
//
// Só entra quem é pagante AGORA pela regra de `payingLoader.currentPayingWhere`
// (pagamento aprovado + acesso em dia), nunca quem só tem `plan` preenchido
// (cortesia, liberação manual e trial também escrevem `plan`). O valor é o
// preço ATUAL do plano de cada pagante.

import { currentPayingWhere } from './payingLoader.js'
import { excludeUserIdsWhere } from './testAccounts.js'

export const MRR_PLANS = ['basic', 'pro', 'premium']

/** PURA: `{ basic, pro, premium }` (pagantes por plano) × preços → MRR e contagens. */
export function computeCanonicalMrr(counts = {}, prices = {}) {
  const n = plan => Math.max(0, Number(counts?.[plan]) || 0)
  const p = plan => Number(prices?.[plan]) || 0
  const activeBasic = n('basic')
  const activePro = n('pro')
  const activePremium = n('premium')
  return {
    activeBasic,
    activePro,
    activePremium,
    paidActiveUsers: activeBasic + activePro + activePremium,
    activeMrr: activeBasic * p('basic') + activePro * p('pro') + activePremium * p('premium'),
  }
}

/** Uma consulta agrupada por plano (sem N+1). Contas de teste ficam de fora. */
export async function loadCanonicalMrr(db, { now = new Date(), prices, testAccountIds = [] } = {}) {
  const rows = await db.user.groupBy({
    by: ['plan'],
    where: { ...currentPayingWhere(now), plan: { in: MRR_PLANS }, ...excludeUserIdsWhere(testAccountIds, 'id') },
    _count: { _all: true },
  })
  const counts = {}
  for (const row of rows) counts[row.plan] = row._count?._all ?? 0
  return computeCanonicalMrr(counts, prices)
}
