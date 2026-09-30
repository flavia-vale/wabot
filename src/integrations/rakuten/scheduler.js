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

export function rakutenSyncEnabled(env = process.env) {
  return String(env.RAKUTEN_SYNC_ENABLED ?? 'true').toLowerCase() !== 'false'
}

export async function tickRakutenSync(deps = {}) {
  if (ticking) return { skipped: 'busy' }
  ticking = true
  const db = deps.db ?? dbDefault
  const now = deps.now ?? (() => new Date())
  const sync = deps.syncFn ?? syncRakutenAccount
  const logger = deps.logger ?? console
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
      select: { id: true },
    })
    for (const { id } of due) {
      summary.checked++
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
    ticking = false
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
