import db from '../../db.js'

export async function logsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const { status = 'all', page = '1', limit = '20', search = '' } = req.query
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const rawQuery = String(search).trim()
    const query = rawQuery.length >= 3 ? rawQuery : ''

    const normalizedQuery = query.toLowerCase()
    const statusSearchMap = {
      sucesso: 'success',
      enviado: 'success',
      erro: 'error',
      falha: 'error',
      fila: 'queued',
      enviando: 'sending',
    }
    const statusMatches = Object.entries(statusSearchMap)
      .filter(([label, value]) => label.includes(normalizedQuery) || value.includes(normalizedQuery))
      .map(([, value]) => value)

    const groups = await db.group.findMany({ where: { userId } })
    const groupMap = Object.fromEntries(groups.map(g => [g.waJid, g.name]))
    const matchingGroupJids = query
      ? groups
        .filter(g => g.name.toLowerCase().includes(normalizedQuery) || g.waJid.toLowerCase().includes(normalizedQuery))
        .map(g => g.waJid)
      : []

    const searchWhere = query
      ? {
          OR: [
            { messageText: { contains: query } },
            { platform: { contains: query } },
            { sourceGroup: { contains: query } },
            { destGroup: { contains: query } },
            { originalUrl: { contains: query } },
            { convertedUrl: { contains: query } },
            { status: { contains: query } },
            { errorMsg: { contains: query } },
            ...(statusMatches.length ? [{ status: { in: statusMatches } }] : []),
            ...(matchingGroupJids.length ? [
              { sourceGroup: { in: matchingGroupJids } },
              { destGroup: { in: matchingGroupJids } },
            ] : []),
          ],
        }
      : {}

    const where = {
      userId,
      ...(status !== 'all' ? { status } : {}),
      ...searchWhere,
    }

    const [total, logs] = await Promise.all([
      db.messageLog.count({ where }),
      db.messageLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
      }),
    ])

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
