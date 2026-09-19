import db from '../../db.js'
import { getBotMetrics } from '../../manager.js'
import { parseCredentialData, validateCredentialData } from '../../credentialHealth.js'

export async function dashboardRoutes(app) {
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const [session, creds, monitorCount, postCount, successLogCount, queue] = await Promise.all([
      db.waSession.findUnique({ where: { userId }, select: { status: true } }),
      db.credential.findMany({ where: { userId }, select: { platform: true, data: true } }),
      db.group.count({ where: { userId, role: 'monitor' } }),
      db.group.count({ where: { userId, role: 'post' } }),
      db.messageLog.count({ where: { userId, status: 'success' } }),
      getBotMetrics(userId).catch(() => null),
    ])

    // "Loja conectada" = credencial COMPLETA, não linha na tabela. Uma loja
    // com campo faltando não converte nada — contá-la faria o painel dizer
    // que está tudo pronto enquanto a oferta sai como `skip:no_valid_conversions`.
    // `hasCredentials` abaixo continua sendo "existe alguma linha", porque é o
    // que a checklist de ativação sempre significou (não regredir esse passo).
    const connectedStores = creds.filter((c) => {
      try {
        return validateCredentialData(c.platform, parseCredentialData(c.data)).configured === true
      } catch {
        // Fail-safe: credencial ilegível não derruba o painel inteiro — ela só
        // não conta como conectada.
        return false
      }
    }).length

    return {
      waConnected: session?.status === 'connected',
      hasCredentials: creds.length > 0,
      hasMonitorGroup: monitorCount > 0,
      hasPostGroup: postCount > 0,
      hasSuccessfulLog: successLogCount > 0,
      // Aditivo (2026-09-19): os mesmos dados que os booleanos acima já
      // carregavam, agora em número, para os cards do painel. Nenhum consumidor
      // existente lê `counts`, então nada quebra ao adicioná-lo.
      counts: {
        stores: connectedStores,
        storesSaved: creds.length,
        monitorGroups: monitorCount,
        postGroups: postCount,
      },
      queue,
    }
  })
}
