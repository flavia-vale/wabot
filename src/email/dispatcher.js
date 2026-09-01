// Despachante: o ÚNICO caminho por onde um e-mail do BOTinho sai.
//
// Toda trava mora aqui, para nenhum gatilho novo precisar lembrar delas:
//   - e-mail fabricado (user_*@sistema.com) nunca recebe;
//   - conta banida/suspensa nunca recebe;
//   - marketing respeita descadastro e leva link de descadastro no rodapé;
//   - anti-repetição: o mesmo e-mail não sai duas vezes para a mesma pessoa
//     dentro da janela do próprio e-mail (`dedupDays`);
//   - teto diário de envio (proteção do domínio e do limite do provedor);
//   - tudo que sai vira uma linha em EmailSendLog.
//
// Nunca lança para o chamador: e-mail é acessório, não pode derrubar cadastro,
// pagamento nem passada de cron.

import { getTemplateDefinition, templateExists } from './registry.js'
import { applyVariables } from './markup.js'
import { wrapEmail, resolveDashboardUrl, resolveSupportEmail, BRAND_NAME, DEFAULT_SUPPORT_WHATSAPP, VIDEO_CADASTRO_ETIQUETAS_URL, videoEtiquetasVars } from './layout.js'
import { buildUnsubscribeUrl, isOptedOut } from './optOut.js'
import { resolveDailyWindowStart, nextDailyWindowStart, describeWindowStart } from './dailyWindow.js'
import {
  isAccountInUse,
  isOperationalEmail,
  countsTowardWeeklyCap,
  loadAccountActivity,
  resolveAutoEmailWeeklyCap,
  CAPPED_GROUPS,
} from './accountActivity.js'
import { listTemplateDefinitions } from './registry.js'

const FALLBACK_EMAIL_RE = /^user_.*@sistema\.com$/i
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

// A trava de "conta parada" existe para não incomodar quem abandonou o robô.
// Só que ela usa "WhatsApp conectado ou envio nos últimos dias" como prova de
// uso — e quem está com o WhatsApp CAÍDO não tem nem uma coisa nem outra. Ou
// seja: a trava calava justamente o aviso que traria a pessoa de volta.
// Medido em produção (2026-08-26): 24 contas ativas paradas há semanas por
// falta de re-pareamento, e ZERO avisos de `whatsapp_desconectado` no
// histórico. O limite de quanto tempo ainda vale avisar mora na política
// (`lifecyclePolicy.js`), não aqui.
const IDLE_GATE_EXEMPT_SLUGS = new Set(['whatsapp_desconectado'])

export function isRealEmail(email) {
  const trimmed = String(email ?? '').trim()
  if (!trimmed) return false
  if (FALLBACK_EMAIL_RE.test(trimmed)) return false
  if (trimmed.toLowerCase().endsWith('@sistema.com')) return false
  return EMAIL_FORMAT_RE.test(trimmed)
}

export function isDeliverableUser(user) {
  if (!user) return false
  if (user.status === 'banned' || user.status === 'suspended') return false
  return isRealEmail(user.email)
}

export function resolveDailyCap(env = process.env) {
  const raw = Number(env.EMAIL_DAILY_CAP)
  return Number.isFinite(raw) && raw >= 0 ? raw : 300
}

/**
 * Junta o texto padrão do código com o override salvo pelo painel.
 * Override parcial é respeitado campo a campo (dá para mudar só o assunto).
 */
export async function loadTemplate({ db, slug }) {
  const definition = getTemplateDefinition(slug)
  if (!definition) return null
  let override = null
  try {
    override = await db.emailTemplate.findUnique({ where: { slug } })
  } catch {
    // Banco fora / tabela ainda não migrada: cai no texto do código.
  }
  return {
    ...definition,
    subject: override?.subject?.trim() ? override.subject : definition.subject,
    // `title` é o único campo em que a string VAZIA é uma escolha válida
    // ("não quero título dentro do e-mail"), então aqui a checagem é por
    // null/undefined, não por texto preenchido como nos outros dois.
    title: override && override.title !== null && override.title !== undefined
      ? override.title
      : (definition.title ?? ''),
    body: override?.body?.trim() ? override.body : definition.body,
    enabled: override ? override.enabled !== false : true,
    customized: Boolean(override),
  }
}

/**
 * Variáveis padrão disponíveis em todo e-mail.
 */
export function standardVars({ user, dashboardUrl = resolveDashboardUrl() } = {}) {
  const name = String(user?.name ?? '').trim()
  const firstName = name.split(/\s+/)[0] || ''
  return {
    marca: BRAND_NAME,
    nome: name,
    primeiro_nome: firstName,
    // Saudação pronta: sem nome cadastrado, "Olá, {{primeiro_nome}}!" viraria
    // "Olá, !" na tela da cliente. Por isso os textos usam {{saudacao}}.
    saudacao: firstName ? `Olá, ${firstName}!` : 'Olá!',
    link_painel: `${dashboardUrl}/painel`,
    link_login: `${dashboardUrl}/login`,
    link_planos: `${dashboardUrl}/painel/planos`,
    // Tela onde a cliente cadastra a etiqueta de afiliada de cada loja. É o
    // destino do e-mail de "sem etiqueta o robô não publica" — sem esta
    // variável o texto teria que colar a URL na mão e sair errado quando a
    // rota mudar.
    link_lojas: `${dashboardUrl}/painel/ids-afiliada`,
    video_etiquetas: VIDEO_CADASTRO_ETIQUETAS_URL,
    // Um link por capítulo, já posicionado no segundo da loja.
    ...videoEtiquetasVars(),
    email_suporte: resolveSupportEmail(),
    whatsapp_suporte: DEFAULT_SUPPORT_WHATSAPP,
  }
}

/**
 * Renderiza um e-mail pronto para envio. Sem I/O — recebe o template já
 * carregado. Exportada para o preview do painel usar exatamente o mesmo
 * caminho do envio real (o que você vê é o que sai).
 * @returns {{ subject: string, text: string, html: string, missing: string[] }}
 */
export function renderTemplate({ template, vars = {}, unsubscribeUrl = '' }) {
  const subjectResult = applyVariables(template.subject, vars)
  const titleResult = applyVariables(template.title ?? '', vars)
  const bodyResult = applyVariables(template.body, vars)
  const { text, html } = wrapEmail({
    title: titleResult.output,
    body: bodyResult.output,
    category: template.category,
    unsubscribeUrl,
  })
  const missing = [...new Set([...subjectResult.missing, ...titleResult.missing, ...bodyResult.missing])]
  return { subject: subjectResult.output.trim(), text, html, missing }
}

// As tabelas do motor de e-mails podem não existir ainda (API subindo antes da
// migration rodar). Nesse caso o e-mail transacional continua saindo — só sem
// histórico e sem a trava de repetição, que é melhor que não avisar a cliente.
function hasModel(db, model) {
  return Boolean(db?.[model]?.findMany || db?.[model]?.count || db?.[model]?.create)
}

async function alreadySentWithin({ db, slug, userId, email, days, now }) {
  if (!days || days <= 0) return false
  if (!hasModel(db, 'emailSendLog')) return false
  const since = new Date(new Date(now).getTime() - days * MS_PER_DAY)
  const where = { slug, status: 'sent', createdAt: { gte: since } }
  const count = await db.emailSendLog.count({
    where: userId ? { ...where, userId } : { ...where, email },
  }).catch(() => 0)
  return count > 0
}

/**
 * Quantos e-mails já saíram no dia de envio vigente (o que começou na última
 * virada das 8h de Brasília). Janela com hora certa, não deslizante: assim o
 * teto zera de manhã e a fila do dia sai cedo, em vez de andar cada dia mais
 * tarde conforme a hora em que o teto foi batido.
 */
export async function sentInCurrentWindow({ db, now, windowStart = resolveDailyWindowStart(now) }) {
  if (!hasModel(db, 'emailSendLog')) return 0
  return db.emailSendLog.count({ where: { status: 'sent', createdAt: { gte: new Date(windowStart) } } }).catch(() => 0)
}

/** Slugs que entram no teto semanal — resolvidos uma vez, o catálogo é estático. */
let cappedSlugsCache = null
function cappedSlugs() {
  if (!cappedSlugsCache) {
    cappedSlugsCache = listTemplateDefinitions()
      .filter((definition) => CAPPED_GROUPS.includes(definition.group))
      .map((definition) => definition.slug)
  }
  return cappedSlugsCache
}

/**
 * Quantos e-mails automáticos de saúde/divulgação esse cliente já recebeu na
 * semana. Sem teto, uma conta bagunçada recebe um assunto diferente por dia —
 * cada e-mail sozinho é justificável e o conjunto vira spam.
 */
export async function autoEmailsSentThisWeek({ db, userId, now = new Date() }) {
  if (!hasModel(db, 'emailSendLog') || !userId) return 0
  const since = new Date(new Date(now).getTime() - 7 * MS_PER_DAY)
  return db.emailSendLog.count({
    where: { userId, status: 'sent', mode: 'auto', slug: { in: cappedSlugs() }, createdAt: { gte: since } },
  }).catch(() => 0)
}

/**
 * Envia um e-mail do catálogo para um cliente, aplicando todas as travas.
 *
 * @param {{
 *   db: object, sendMail: function, slug: string, user: object,
 *   vars?: Record<string, any>, mode?: 'auto'|'manual'|'test',
 *   batchId?: string|null, now?: Date, secret?: string, logger?: object,
 *   ignoreDedup?: boolean, ignoreDailyCap?: boolean, logRowId?: string|null,
 * }} params
 * @returns {Promise<{ sent: boolean, skipped?: boolean, reason?: string, logId?: string }>}
 */
export async function sendTemplateEmail({
  db,
  sendMail,
  slug,
  user,
  vars = {},
  mode = 'auto',
  batchId = null,
  now = new Date(),
  secret = process.env.JWT_SECRET,
  logger = console,
  ignoreDedup = false,
  ignoreDailyCap = false,
  logRowId = null,
} = {}) {
  // Quando o envio veio da fila (disparo manual em massa), a linha do histórico
  // JÁ existe — atualiza aquela em vez de criar uma segunda.
  //
  // RCA 2026-08-26: antes, o descarte de um envio AUTOMÁTICO não deixava
  // rastro nenhum (a linha só era escrita quando o envio vinha da fila, que já
  // tinha `logRowId`). Resultado: o aviso "seu WhatsApp caiu" nunca apareceu no
  // histórico — nem como enviado, nem como barrado —, e ficou impossível saber
  // se ele não disparava ou se estava sendo silenciado por alguma trava. Agora
  // todo descarte vira linha, com o motivo.
  const markSkipped = async (reason) => {
    if (!hasModel(db, 'emailSendLog')) return { sent: false, skipped: true, reason }
    if (logRowId) {
      await db.emailSendLog.update({
        where: { id: logRowId },
        data: { status: 'skipped', skipReason: reason },
      }).catch(() => {})
    } else {
      await db.emailSendLog.create({
        data: {
          slug,
          userId: user?.id ?? null,
          email: user?.email ?? '',
          category: getTemplateDefinition(slug)?.category ?? 'transactional',
          mode,
          batchId,
          status: 'skipped',
          skipReason: reason,
          scheduledAt: new Date(now),
        },
      }).catch(() => {})
    }
    return { sent: false, skipped: true, reason }
  }

  try {
    if (!templateExists(slug)) return markSkipped('unknown_template')
    if (!isDeliverableUser(user)) return markSkipped('undeliverable_user')

    const template = await loadTemplate({ db, slug })
    if (!template) return markSkipped('unknown_template')
    if (template.enabled === false) return markSkipped('template_disabled')

    if (template.category === 'marketing' && await isOptedOut({ db, userId: user.id })) {
      return markSkipped('opted_out')
    }

    if (!ignoreDedup && await alreadySentWithin({
      db, slug, userId: user.id, email: user.email, days: template.dedupDays, now,
    })) {
      return markSkipped('already_sent')
    }

    // Aviso operacional (grupo `saude`) para conta que não está usando o robô é
    // ruído: o plano venceu, o WhatsApp está fora, nada é enviado há dias — e
    // ainda assim chegava "a Shopee parou de aceitar sua chave". Cobrança,
    // senha e dinheiro de afiliada não passam por aqui de propósito.
    // Só vale para disparo automático: envio manual da admin é decisão dela.
    if (mode === 'auto' && isOperationalEmail(template) && !IDLE_GATE_EXEMPT_SLUGS.has(slug)) {
      const activity = await loadAccountActivity({ db, userId: user.id, user })
      // Foto incompleta (consulta que caiu) NÃO silencia: silenciar aviso
      // legítimo por causa de um blip do banco é pior que mandá-lo.
      if (!activity.incompleta && !isAccountInUse(activity, now)) {
        return markSkipped('account_idle')
      }
    }

    if (mode === 'auto' && countsTowardWeeklyCap(template)) {
      const cap = resolveAutoEmailWeeklyCap()
      if (cap > 0 && await autoEmailsSentThisWeek({ db, userId: user.id, now }) >= cap) {
        return markSkipped('weekly_cap')
      }
    }

    if (!ignoreDailyCap) {
      const cap = resolveDailyCap()
      if (cap > 0 && await sentInCurrentWindow({ db, now }) >= cap) {
        // NÃO marca a linha da fila como descartada: o teto diário é uma espera,
        // não uma recusa — ela continua na fila e sai na próxima virada das 8h.
        const retryAt = nextDailyWindowStart(now)
        return {
          sent: false,
          skipped: true,
          reason: 'daily_cap',
          retryLater: true,
          retryAt,
          retryAtLabel: describeWindowStart(retryAt),
        }
      }
    }

    const unsubscribeUrl = template.category === 'marketing' && secret
      ? buildUnsubscribeUrl({ userId: user.id, secret })
      : ''
    const { subject, text, html, missing } = renderTemplate({
      template,
      vars: { ...standardVars({ user }), ...vars },
      unsubscribeUrl,
    })
    if (missing.length) {
      logger?.warn?.({ slug, missing }, 'e-mail: variável sem valor no texto')
    }

    const result = await sendMail({ to: user.email, subject, text, html })
    if (result?.skipped) {
      // Sem SMTP configurado: não grava como enviado (senão a trava
      // anti-repetição queimaria sem a pessoa ter recebido nada). Item de fila
      // continua na fila — sai quando o SMTP for ligado.
      return { sent: false, skipped: true, reason: 'smtp_disabled', retryLater: true }
    }

    if (logRowId && hasModel(db, 'emailSendLog')) {
      await db.emailSendLog.update({
        where: { id: logRowId },
        data: { status: 'sent', sentAt: new Date() },
      }).catch((err) => logger?.warn?.({ slug, err: err?.message }, 'e-mail: falha ao atualizar histórico'))
      return { sent: true, logId: logRowId }
    }

    if (!hasModel(db, 'emailSendLog')) return { sent: true, logId: null }

    const log = await db.emailSendLog.create({
      data: {
        slug,
        userId: user.id ?? null,
        email: user.email,
        category: template.category,
        mode,
        batchId,
        status: 'sent',
        scheduledAt: new Date(now),
        sentAt: new Date(),
      },
    }).catch((err) => {
      logger?.warn?.({ slug, err: err?.message }, 'e-mail: falha ao registrar envio no histórico')
      return null
    })

    return { sent: true, logId: log?.id ?? null }
  } catch (err) {
    logger?.error?.({ slug, err: err?.message }, 'e-mail: falha ao enviar')
    const errorText = String(err?.message ?? err).slice(0, 500)
    if (!hasModel(db, 'emailSendLog')) return { sent: false, reason: 'error', error: errorText }
    if (logRowId) {
      await db.emailSendLog.update({ where: { id: logRowId }, data: { status: 'error', error: errorText } }).catch(() => {})
    } else {
      await db.emailSendLog.create({
        data: {
          slug,
          userId: user?.id ?? null,
          email: user?.email ?? '',
          category: getTemplateDefinition(slug)?.category ?? 'transactional',
          mode,
          batchId,
          status: 'error',
          error: errorText,
          scheduledAt: new Date(now),
        },
      }).catch(() => {})
    }
    return { sent: false, reason: 'error', error: errorText }
  }
}
