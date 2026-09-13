// Carrega quem tentou conectar e não conseguiu, e manda UM aviso interno.
//
// Roda no mesmo tick diário dos e-mails de ciclo de vida — nenhum processo PM2
// novo, nenhum timer novo (política de memória do AGENTS.md).
//
// Um aviso agregado, nunca um por conta: o cooldown de `sendAdminAlert` é por
// assunto, então uma rajada de dez contas viraria dez e-mails com a mesma
// notícia se cada uma fosse um assunto diferente.

import { sendAdminAlert } from '../email/adminAlerts.js'
import { describeStalledPairings, selectStalledPairings } from './pairingStalled.js'

export const PAIRING_STALLED_ALERT_KEY = 'conexao_falhou'

/**
 * @param {object} args
 * @param {object} args.db
 * @param {Date} [args.now]
 * @param {object} [args.logger]
 * @returns {Promise<{ found: number, alerted: boolean, reason: string }>}
 */
export async function runPairingStalledSweep({ db, now = new Date(), logger, sendMail } = {}) {
  try {
    const sessions = await db.waSession.findMany({
      where: { status: { not: 'connected' }, phone: null, lastHeartbeatAt: null },
      select: {
        userId: true,
        status: true,
        phone: true,
        lastHeartbeatAt: true,
        updatedAt: true,
        user: { select: { email: true, name: true, status: true } },
      },
    })

    const candidatas = sessions
      // Conta banida ou suspensa não é obstáculo nosso a resolver.
      .filter((s) => s.user && s.user.status !== 'banned' && s.user.status !== 'suspended')
      .map((s) => ({
        userId: s.userId,
        email: s.user?.email ?? null,
        name: s.user?.name ?? null,
        status: s.status,
        phone: s.phone,
        lastHeartbeatAt: s.lastHeartbeatAt,
        updatedAt: s.updatedAt,
      }))

    const achados = selectStalledPairings({ sessions: candidatas, now })
    if (!achados.length) return { found: 0, alerted: false, reason: 'ninguem_travado' }

    const { resumo, lista } = describeStalledPairings(achados)
    const resultado = await sendAdminAlert({
      db,
      sendMail,
      slug: 'admin_conexao_falhou',
      key: PAIRING_STALLED_ALERT_KEY,
      vars: { resumo, lista },
      now,
      logger,
    })
    return { found: achados.length, alerted: Boolean(resultado?.sent), reason: resultado?.reason ?? 'enviado' }
  } catch (err) {
    // Alerta é acessório: nunca pode derrubar a passada de e-mails da cliente.
    logger?.warn?.({ err: err?.message }, 'aviso de conexão travada: passada falhou')
    return { found: 0, alerted: false, reason: 'falhou' }
  }
}
