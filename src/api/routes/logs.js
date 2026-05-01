import db from '../../db.js'

export async function logsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const { status = 'all', page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))

    const where = { userId, ...(status !== 'all' ? { status } : {}) }

    const [total, logs] = await Promise.all([
      db.messageLog.count({ where }),
      db.messageLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
      }),
    ])

    const groups = await db.group.findMany({ where: { userId } })
    const groupMap = Object.fromEntries(groups.map(g => [g.waJid, g.name]))

    return {
      total,
      page: pageNum,
      limit: limitNum,
      logs: logs.map(log => ({
        ...log,
        sourceGroupName: groupMap[log.sourceGroup] || log.sourceGroup,
        destGroupName: groupMap[log.destGroup] || log.destGroup,
      })),
    }
  })

  app.delete('/clear', { onRequest: [app.authenticate] }, async (req) => {
    await db.messageLog.deleteMany({ where: { userId: req.user.sub } })
    return { ok: true }
  })
}
