/**
 * Avisos internos: os e-mails que vão para a ADMINISTRADORA, não para a
 * cliente.
 *
 * Existem porque falha de pagamento é silenciosa por natureza: ninguém reclama
 * de uma cobrança que não aconteceu, e o dinheiro simplesmente deixa de
 * entrar. Aviso que mora só no log não conta como aviso — a lição do
 * `ops_stale_worker_code`, que disparava havia semanas e ninguém leu.
 *
 * Caminho PRÓPRIO, separado do despachante da cliente de propósito: as travas
 * de lá (descadastro, conta parada, teto semanal, endereço fabricado) são
 * regras de relacionamento com a CLIENTE e não fazem sentido aqui — nenhuma
 * delas pode calar um alerta de operação. As travas que valem aqui são outras:
 * cooldown por assunto (para uma rajada não virar 200 e-mails) e o mesmo
 * histórico em `EmailSendLog`, para dar para auditar o que foi avisado.
 *
 * Nunca lança: alerta é acessório e não pode derrubar webhook nem reconciliação.
 */

import { loadTemplate, renderTemplate } from './dispatcher.js'
import { getTemplateDefinition } from './registry.js'
import { sendMail as defaultSendMail } from './mailer.js'
import { resolveDashboardUrl, BRAND_NAME, resolveSupportEmail } from './layout.js'

/** Para onde os avisos internos vão. Trocável por env, sem redeploy. */
export const DEFAULT_ADMIN_ALERT_EMAIL = 'flaviaroberta.1496@gmail.com'

/** Uma rajada de falhas não pode virar uma rajada de e-mails. */
export const ADMIN_ALERT_COOLDOWN_HOURS = 24

export function resolveAdminAlertEmail(env = process.env) {
  const configured = String(env.ADMIN_ALERT_EMAIL ?? '').trim()
  return configured || DEFAULT_ADMIN_ALERT_EMAIL
}

export function adminAlertsEnabled(env = process.env) {
  // Só o valor exatamente 'false' desliga — mesmo padrão dos outros
  // interruptores do projeto. Desligar não quebra nada: os problemas continuam
  // no log da API e na aba Financeiro.
  return String(env.ADMIN_ALERT_ENABLED ?? 'true').toLowerCase() !== 'false'
}

function hasModel(db, model) {
  return Boolean(db?.[model]?.findFirst || db?.[model]?.create)
}

/**
 * Decide se este assunto já foi avisado dentro da janela. PURA o suficiente
 * para testar: recebe a última data em vez de consultar.
 */
export function shouldSendAdminAlert({ lastSentAt, now = new Date(), cooldownHours = ADMIN_ALERT_COOLDOWN_HOURS } = {}) {
  if (!lastSentAt) return { send: true, reason: 'primeiro_aviso' }
  const last = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt)
  if (Number.isNaN(last.getTime())) return { send: true, reason: 'data_invalida' }
  const horas = ((now instanceof Date ? now : new Date(now)).getTime() - last.getTime()) / 3600000
  if (horas < Math.max(0, Number(cooldownHours) || 0)) return { send: false, reason: 'avisado_recentemente' }
  return { send: true, reason: 'fora_do_cooldown' }
}

/**
 * @param {string} slug   template do grupo `interno`
 * @param {string} key    assunto do cooldown (ex.: o código do problema). Dois
 *                        problemas diferentes avisam separado; o mesmo problema
 *                        repetido espera a janela.
 */
export async function sendAdminAlert({
  db,
  slug,
  key = '',
  vars = {},
  sendMail = defaultSendMail,
  now = new Date(),
  cooldownHours = ADMIN_ALERT_COOLDOWN_HOURS,
  env = process.env,
  logger = console,
} = {}) {
  try {
    if (!adminAlertsEnabled(env)) return { sent: false, reason: 'desligado' }

    const definition = getTemplateDefinition(slug)
    if (!definition) return { sent: false, reason: 'template_desconhecido' }
    // Guarda estrutural: este caminho é SÓ para aviso interno. Mandar e-mail de
    // cliente por aqui pularia descadastro e todas as travas do despachante.
    if (definition.audience !== 'admin') return { sent: false, reason: 'template_nao_e_interno' }

    const to = resolveAdminAlertEmail(env)
    const marcador = `admin:${slug}:${key || 'geral'}`

    if (hasModel(db, 'emailSendLog') && cooldownHours > 0) {
      const anterior = await db.emailSendLog.findFirst({
        where: { slug, status: 'sent', skipReason: marcador },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }).catch(() => null)
      const decisao = shouldSendAdminAlert({ lastSentAt: anterior?.createdAt, now, cooldownHours })
      if (!decisao.send) return { sent: false, reason: decisao.reason }
    }

    const template = await loadTemplate({ db, slug })
    if (!template || template.enabled === false) return { sent: false, reason: 'template_indisponivel' }

    const dashboardUrl = resolveDashboardUrl()
    const rendered = renderTemplate({
      template,
      vars: {
        marca: BRAND_NAME,
        saudacao: 'Olá!',
        email_suporte: resolveSupportEmail(),
        link_painel: `${dashboardUrl}/painel`,
        link_cobrancas: `${dashboardUrl}/admin`,
        ...vars,
      },
      // Aviso interno não leva descadastro: não é divulgação, é operação.
      unsubscribeUrl: '',
    })

    const result = await sendMail({ to, subject: rendered.subject, text: rendered.text, html: rendered.html })
    // Sem SMTP o envio é no-op silencioso — e nesse caso NÃO gravamos "enviado",
    // senão a janela de cooldown queimaria sem ninguém ter recebido nada.
    if (result?.skipped) return { sent: false, reason: 'sem_smtp' }

    if (hasModel(db, 'emailSendLog')) {
      await db.emailSendLog.create({
        data: {
          slug,
          userId: null,
          email: to,
          category: template.category ?? 'transactional',
          mode: 'auto',
          status: 'sent',
          skipReason: marcador,
          scheduledAt: new Date(now),
          sentAt: new Date(now),
        },
      }).catch(() => {})
    }

    return { sent: true, to }
  } catch (err) {
    logger?.warn?.({ err: err?.message, slug }, 'admin_alert_failed')
    return { sent: false, reason: 'erro' }
  }
}
