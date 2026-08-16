// Descadastro de e-mail por categoria (LGPD).
//
// Só 'marketing' é descadastrável: e-mail transacional (cobrança, vencimento,
// código de acesso vencido, segurança) é obrigação de serviço e não pode ser
// desligado — quem não quer mais nada disso cancela a conta.
//
// O token do link é o MESMO esquema já usado na trilha de nutrição (HMAC do
// userId com o JWT_SECRET) — sem estado, sem tabela de token, sem link que
// vence sozinho no meio de uma campanha.

import { signUnsubscribeToken, verifyUnsubscribeToken } from '../leadNurture/unsubscribeToken.js'

export const OPT_OUT_CATEGORY = 'marketing'

export { signUnsubscribeToken, verifyUnsubscribeToken }

export function buildUnsubscribeUrl({ userId, secret, baseUrl }) {
  const base = String(baseUrl || process.env.DASHBOARD_URL || process.env.API_URL || 'https://espelhagrupos.com.br').replace(/\/+$/, '')
  const token = signUnsubscribeToken(userId, secret)
  return `${base}/api/emails/unsubscribe?token=${encodeURIComponent(token)}`
}

/**
 * @returns {Promise<boolean>}
 */
export async function isOptedOut({ db, userId, category = OPT_OUT_CATEGORY }) {
  if (!userId) return false
  // Tabela ainda não migrada: cai no descadastro antigo (evento) em vez de
  // quebrar o envio.
  const found = db?.emailOptOut?.findUnique ? await db.emailOptOut.findUnique({
    where: { userId_category: { userId, category } },
  }).catch(() => null) : null
  if (found) return true
  // Quem já pediu para sair da trilha de nutrição não pode voltar a receber
  // divulgação por outra porta — o pedido dela vale para marketing inteiro.
  if (!db?.analyticsEvent?.count) return false
  const legacy = await db.analyticsEvent.count({
    where: { userId, event: 'nurture_unsubscribed' },
  }).catch(() => 0)
  return legacy > 0
}

/**
 * Idempotente: descadastrar duas vezes não duplica linha nem falha.
 */
export async function optOut({ db, userId, category = OPT_OUT_CATEGORY, source = 'link' }) {
  if (!userId) return { ok: false }
  await db.emailOptOut.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, source },
    update: {},
  })
  return { ok: true }
}
