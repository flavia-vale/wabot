// Agendador in-process das sincronizações Awin: setInterval + unref na API,
// mesmo padrão dos sweeps de src/api/server.js. Sem processo PM2, worker,
// Redis ou fila novos (política de memória — docs/rca/memoria-e-capacidade.md).
//
// Contas saem UMA de cada vez (fila sequencial): o limite da Awin é por token
// e várias contas podem dividir o mesmo token; o limitador do cliente segura
// o ritmo (≤15/min por token). Erro de uma conta não para as outras.
//
// Desligar sem deploy: AWIN_SYNC_ENABLED=false (vale no próximo start).

import dbDefault from '../../db.js'
import { syncAwinAccount } from './syncService.js'
import { AWIN_ACCOUNT_STATUS } from './accountService.js'

export const AWIN_SYNC_TICK_MS = 5 * 60_000
const FIRST_TICK_DELAY_MS = 60_000
const ACCOUNTS_PER_TICK = 20

let ticking = false

export function awinSyncEnabled(env = process.env) {
  return String(env.AWIN_SYNC_ENABLED ?? 'true').toLowerCase() !== 'false'
}

export async function tickAwinSync(deps = {}) {
  if (ticking) return { skipped: 'busy' }
  ticking = true
  const db = deps.db ?? dbDefault
  const now = deps.now ?? (() => new Date())
  const sync = deps.syncFn ?? syncAwinAccount
  const logger = deps.logger ?? console
  const summary = { checked: 0, synced: 0, failed: 0 }
  try {
    const at = now()
    const due = await db.awinAccount.findMany({
      where: {
        syncEnabled: true,
        status: { not: AWIN_ACCOUNT_STATUS.INVALID_CREDENTIAL },
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
        logger.error?.(`[awin-sync] conta ${id} falhou: ${error?.message}`)
      }
    }
    return summary
  } finally {
    ticking = false
  }
}

export function startAwinSyncScheduler(deps = {}) {
  if (!awinSyncEnabled(deps.env)) return null
  const logger = deps.logger ?? console
  const run = () => tickAwinSync(deps).catch((error) => logger.error?.(`[awin-sync] tick falhou: ${error?.message}`))
  const first = setTimeout(run, FIRST_TICK_DELAY_MS)
  first.unref?.()
  const timer = setInterval(run, AWIN_SYNC_TICK_MS)
  timer.unref?.()
  return timer
}
