// Passada diária dos e-mails de ciclo de vida (vencimento, saúde do robô,
// afiliada). Monta a "foto" de cada cliente, pergunta à política pura qual
// e-mail cabe agora e manda pelo despachante.
//
// Onde roda: `setInterval` + `unref()` na API (mesmo padrão de
// startLeadNurtureSweep) — sem processo PM2 novo, sem worker, sem Redis.
//
// Isolamento por cliente: erro num não impede os outros (mesma lição do RCA
// "fila travava inteira quando UM item falhava"). Nunca lança para o chamador.

import { decideLifecycleEmail, resolveTriggersStartAt } from './lifecyclePolicy.js'
import { sendTemplateEmail, isDeliverableUser } from '../email/dispatcher.js'
import { resolveDashboardUrl } from '../email/layout.js'
import { loadDisconnectIntent } from '../email/accountActivity.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Monta a foto de um cliente com o que a política precisa saber.
 * Cada consulta é isolada: dado que falha vira `null` e a política decide sem
 * ele (nunca deixa de mandar um aviso de cobrança porque o saldo de afiliada
 * não carregou).
 */
export async function buildUserSnapshot({ db, user, now = new Date(), settings = null }) {
  const since = new Date(new Date(now).getTime() - 30 * MS_PER_DAY)

  const [waSession, monitorGroup, postGroup, lastSuccess, pendingPayment, affiliate] = await Promise.all([
    db.waSession.findUnique({ where: { userId: user.id } }).catch(() => null),
    db.group.findFirst({ where: { userId: user.id, role: 'monitor' }, select: { id: true } }).catch(() => null),
    db.group.findFirst({ where: { userId: user.id, role: 'post' }, select: { id: true } }).catch(() => null),
    db.messageLog.findFirst({
      where: { userId: user.id, status: 'success' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }).catch(() => null),
    db.payment.findFirst({
      where: { userId: user.id, status: 'pending', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, plan: true },
    }).catch(() => null),
    db.affiliateProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true },
    }).catch(() => null),
  ])

  let affiliateAvailableCents = 0
  if (affiliate?.status === 'approved') {
    const commissions = await db.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id, status: { in: ['eligible', 'approved'] } },
      select: { commissionAmountCents: true },
    }).catch(() => [])
    affiliateAvailableCents = commissions.reduce((total, row) => total + (Number(row.commissionAmountCents) || 0), 0)
  }

  const connected = waSession?.status === 'connected'
  // Só consulta quem pediu para desconectar quando de fato está desconectado —
  // é a única situação em que a resposta muda alguma decisão.
  const intent = connected ? { stoppedByUserAt: null, lastConnectedAt: null } : await loadDisconnectIntent({ db, userId: user.id })
  return {
    ...intent,
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    plan: user.plan,
    accessExpiresAt: user.accessExpiresAt,
    createdAt: user.createdAt,
    waEverConnected: Boolean(waSession?.phone || waSession?.lastHeartbeatAt || connected),
    waConnected: connected,
    // Sem coluna de "caiu quando", o melhor sinal disponível é a última
    // atualização da sessão — que muda a cada transição de estado.
    waDisconnectedSince: connected ? null : (waSession?.updatedAt ?? null),
    hasMonitorGroup: Boolean(monitorGroup),
    hasPostGroup: Boolean(postGroup),
    lastSuccessAt: lastSuccess?.sentAt ?? null,
    pendingPaymentAt: pendingPayment?.createdAt ?? null,
    pendingPaymentPlan: pendingPayment?.plan ?? null,
    isAffiliate: affiliate?.status === 'approved',
    affiliateAvailableCents,
    minPayoutCents: settings?.minPayoutCents ?? 5000,
    commissionPercent: settings?.commissionPercent ?? 30,
  }
}

/**
 * Uma passada completa. Devolve o resumo para o log da API.
 * @returns {Promise<{scanned:number, sent:number, skipped:number, failed:number, bySlug:Record<string,number>}>}
 */
export async function runLifecycleEmailSweep({
  db,
  sendMail,
  now = new Date(),
  logger = console,
  secret = process.env.JWT_SECRET,
  triggersStartAt = resolveTriggersStartAt(),
} = {}) {
  const summary = { scanned: 0, sent: 0, skipped: 0, failed: 0, bySlug: {} }

  let users = []
  try {
    users = await db.user.findMany({
      where: { status: { notIn: ['banned', 'suspended'] } },
      select: { id: true, name: true, email: true, status: true, plan: true, accessExpiresAt: true, createdAt: true },
    })
  } catch (err) {
    logger?.error?.({ err: err?.message }, 'e-mails de ciclo de vida: falha ao carregar clientes')
    return summary
  }

  const settings = await db.affiliateSettings.findUnique({ where: { id: 1 } }).catch(() => null)
  const dashboardUrl = resolveDashboardUrl()

  for (const user of users) {
    summary.scanned += 1
    try {
      // Corta cedo quem não pode receber: evita consulta de foto à toa.
      if (!isDeliverableUser(user)) {
        summary.skipped += 1
        continue
      }

      const snapshot = await buildUserSnapshot({ db, user, now, settings })
      const decision = decideLifecycleEmail(snapshot, now, { triggersStartAt })
      if (!decision) {
        summary.skipped += 1
        continue
      }

      const result = await sendTemplateEmail({
        db,
        sendMail,
        slug: decision.slug,
        user,
        vars: {
          ...decision.vars,
          link_whatsapp: `${dashboardUrl}/painel/whatsapp`,
          link_grupos: `${dashboardUrl}/painel/grupos`,
          link_historico: `${dashboardUrl}/painel/logs`,
          link_afiliados: `${dashboardUrl}/painel/afiliados`,
          link_credenciais: `${dashboardUrl}/painel/ids-afiliada`,
        },
        mode: 'auto',
        now,
        secret,
        logger,
      })

      if (result.sent) {
        summary.sent += 1
        summary.bySlug[decision.slug] = (summary.bySlug[decision.slug] ?? 0) + 1
      } else {
        summary.skipped += 1
      }
    } catch (err) {
      summary.failed += 1
      logger?.error?.({ err: err?.message, userId: user?.id }, 'e-mails de ciclo de vida: falha isolada num cliente')
    }
  }

  return summary
}
