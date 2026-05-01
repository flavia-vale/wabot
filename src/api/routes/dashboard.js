import db from '../../db.js'

export async function dashboardRoutes(app) {
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const [session, credCount, monitorCount, postCount] = await Promise.all([
      db.waSession.findUnique({ where: { userId }, select: { status: true } }),
      db.credential.count({ where: { userId } }),
      db.group.count({ where: { userId, role: 'monitor' } }),
      db.group.count({ where: { userId, role: 'post' } }),
    ])
    return {
      waConnected: session?.status === 'connected',
      hasCredentials: credCount > 0,
      hasMonitorGroup: monitorCount > 0,
      hasPostGroup: postCount > 0,
    }
  })
}
