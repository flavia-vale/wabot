// Agendador in-process das sincronizações Rakuten: setInterval + unref na API,
// mesmo padrão dos sweeps de src/api/server.js. Sem processo PM2, worker,
// Redis ou fila novos (política de memória — docs/rca/memoria-e-capacidade.md).
//
// Contas saem UMA de cada vez (fila sequencial); o limitador do cliente segura
// o ritmo (≤60/min por conta; a Rakuten aceita 100). Erro de uma conta não
// para as outras. Espelho de src/integrations/awin/scheduler.js.
//
// Desligar sem deploy: RAKUTEN_SYNC_ENABLED=false (vale no próximo start).

import dbDefault from '../../db.js'
import { syncRakutenAccount } from './syncService.js'
import { RAKUTEN_ACCOUNT_STATUS } from './accountService.js'

export const RAKUTEN_SYNC_TICK_MS = 5 * 60_000
const FIRST_TICK_DELAY_MS = 60_000
const ACCOUNTS_PER_TICK = 20

let ticking = false
let tickingSince = 0
// Rede de segurança (revisão 2026-10-03, R1): cada chamada e cada conta já têm
// prazo, mas se um tick ficar preso por qualquer motivo, depois deste tempo o
// próximo roda mesmo assim (a mesma conta nunca roda duas vezes: syncService
// segura por conta).
export const RAKUTEN_TICK_STUCK_MS = 30 * 60_000
// Cliente sem acesso (plano vencido há mais de 3 dias, conta banida/suspensa)
// não gasta chamada à Rakuten nem gravação no banco: a conta é só reagendada
// para daqui a 6 h e volta sozinha quando o plano renovar. Nada é apagado.
// Sem data de vencimento = segue sincronizando (revisão 2026-10-03, R12).
export const RAKUTEN_NO_ACCESS_GRACE_MS = 3 * 24 * 60 * 60_000
export const RAKUTEN_NO_ACCESS_RECHECK_MS = 6 * 60 * 60_000

export function userHasNoAccess(user, now = new Date()) {
  if (!user) return false
  if (user.status === 'banned' || user.status === 'suspended') return true
  if (!user.accessExpiresAt) return false
  const expiresAt = new Date(user.accessExpiresAt).getTime()
  return Number.isFinite(expiresAt) && now.getTime() - expiresAt > RAKUTEN_NO_ACCESS_GRACE_MS
}

export function rakutenSyncEnabled(env = process.env) {
  return String(env.RAKUTEN_SYNC_ENABLED ?? 'true').toLowerCase() !== 'false'
}

export async function tickRakutenSync(deps = {}) {
  const logger = deps.logger ?? console
  if (ticking && Date.now() - tickingSince < RAKUTEN_TICK_STUCK_MS) return { skipped: 'busy' }
  if (ticking) logger.warn?.('[rakuten-sync] tick anterior preso há mais de 30 min; seguindo mesmo assim')
  ticking = true
  tickingSince = Date.now()
  const myTick = tickingSince
  const db = deps.db ?? dbDefault
  const now = deps.now ?? (() => new Date())
  const sync = deps.syncFn ?? syncRakutenAccount
  const summary = { checked: 0, synced: 0, failed: 0 }
  try {
    const at = now()
    const due = await db.rakutenAccount.findMany({
      where: {
        syncEnabled: true,
        status: { not: RAKUTEN_ACCOUNT_STATUS.INVALID_CREDENTIAL },
        OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: at } }],
      },
      orderBy: { nextSyncAt: 'asc' },
      take: deps.limit ?? ACCOUNTS_PER_TICK,
      select: { id: true, user: { select: { status: true, accessExpiresAt: true } } },
    })
    for (const { id, user } of due) {
      summary.checked++
      if (userHasNoAccess(user, at)) {
        summary.skipped = (summary.skipped || 0) + 1
        await db.rakutenAccount.update({ where: { id }, data: { nextSyncAt: new Date(at.getTime() + RAKUTEN_NO_ACCESS_RECHECK_MS) } }).catch(() => {})
        continue
      }
      try {
        const result = await sync(id, { db, now, trigger: 'schedule', client: deps.client })
        if (result?.status === 'success' || result?.status === 'partial') summary.synced++
        else if (result?.status) summary.failed++
      } catch (error) {
        summary.failed++
        logger.error?.(`[rakuten-sync] conta ${id} falhou: ${error?.message}`)
      }
    }
    return summary
  } finally {
    if (tickingSince === myTick) ticking = false
  }
}

export function startRakutenSyncScheduler(deps = {}) {
  if (!rakutenSyncEnabled(deps.env)) return null
  const logger = deps.logger ?? console
  const run = () => tickRakutenSync(deps).catch((error) => logger.error?.(`[rakuten-sync] tick falhou: ${error?.message}`))
  const first = setTimeout(run, FIRST_TICK_DELAY_MS)
  first.unref?.()
  const timer = setInterval(run, RAKUTEN_SYNC_TICK_MS)
  timer.unref?.()
  return timer
}
