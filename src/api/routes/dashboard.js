import db from '../../db.js'
import { getBotMetrics, isRunning } from '../../manager.js'

export async function dashboardRoutes(app) {
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const running = isRunning(userId)
    const [session, credCount, monitorCount, postCount, metrics] = await Promise.all([
      db.waSession.findUnique({ where: { userId }, select: { status: true } }),
      db.credential.count({ where: { userId } }),
      db.group.count({ where: { userId, role: 'monitor' } }),
      db.group.count({ where: { userId, role: 'post' } }),
      running ? getBotMetrics(userId).catch(() => null) : Promise.resolve(null),
    ])
    return {
      waConnected: session?.status === 'connected',
      hasCredentials: credCount > 0,
      hasMonitorGroup: monitorCount > 0,
      hasPostGroup: postCount > 0,
      botRunning: running,
      queue: metrics,
    }
  })
}
