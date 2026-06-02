import db from '../../db.js'
import { getBotMetrics } from '../../manager.js'

export async function dashboardRoutes(app) {
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const [session, credCount, monitorCount, postCount, successLogCount, queue] = await Promise.all([
      db.waSession.findUnique({ where: { userId }, select: { status: true } }),
      db.credential.count({ where: { userId } }),
      db.group.count({ where: { userId, role: 'monitor' } }),
      db.group.count({ where: { userId, role: 'post' } }),
      db.messageLog.count({ where: { userId, status: 'success' } }),
      getBotMetrics(userId).catch(() => null),
    ])
    return {
      waConnected: session?.status === 'connected',
      hasCredentials: credCount > 0,
      hasMonitorGroup: monitorCount > 0,
      hasPostGroup: postCount > 0,
      hasSuccessfulLog: successLogCount > 0,
      queue,
    }
  })
}
