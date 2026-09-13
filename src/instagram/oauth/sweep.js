import { createInstagramOAuthClient } from './client.js'
import { refreshInstagramConnection } from './service.js'

const REFRESH_AHEAD_MS = 15 * 24 * 60 * 60_000

export async function runInstagramTokenSweep({ db, config, client = createInstagramOAuthClient(config), now = () => new Date(), limit = 50 } = {}) {
  const rows = await db.instagramConnection.findMany({ where: { status: 'connected', loginMethod: config.loginMethod, OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { lte: new Date(now().getTime() + REFRESH_AHEAD_MS) } }] }, select: { id: true, userId: true }, take: limit, orderBy: { tokenExpiresAt: 'asc' } })
  const result = { scanned: rows.length, refreshed: 0, failed: 0 }
  for (const row of rows) {
    try { await refreshInstagramConnection(row.userId, row.id, config, { db, client, now }); result.refreshed++ } catch { result.failed++ }
  }
  return result
}

export function startInstagramTokenSweep({ db, config, logger = console, intervalMs = 24 * 60 * 60_000 } = {}) {
  const tick = () => runInstagramTokenSweep({ db, config }).then(result => logger.info?.(result, 'Renovação preventiva de tokens Instagram concluída')).catch(error => logger.error?.({ err: error.message }, 'Falha na renovação preventiva de tokens Instagram'))
  const timer = setInterval(tick, intervalMs); timer.unref?.(); tick()
  return () => clearInterval(timer)
}
