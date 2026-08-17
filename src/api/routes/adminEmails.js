// Aba E-mails do painel admin: ver e editar os textos, mandar teste, montar
// público, disparar em massa e acompanhar o histórico.
//
// Nada aqui envia direto: tudo passa pelo despachante/fila (src/email/*), que
// carregam as travas. Toda ação que muda algo grava AdminAuditLog.

import dbDefault from '../../db.js'
import { resolveAdminAccess, writeAdminAuditLog } from './admin.js'
import { sendMail as defaultSendMail, isEmailConfigured } from '../../email/mailer.js'
import { listTemplateDefinitions, getTemplateDefinition, variablesForTemplate, EMAIL_GROUPS } from '../../email/registry.js'
import { loadTemplate, renderTemplate, standardVars, sendTemplateEmail, resolveDailyCap } from '../../email/dispatcher.js'
import { resolveDailyWindowStart, nextDailyWindowStart, describeWindowStart } from '../../email/dailyWindow.js'
import { extractVariables } from '../../email/markup.js'
import { buildAudienceWhere, describeAudience, loadAudience, AUDIENCE_FILTERS } from '../../email/audience.js'
import { enqueueEmailBatch, cancelEmailBatch, resolveBatchSize } from '../../email/queue.js'

const ROLE_PERMISSIONS = {
  owner: ['admin:read', 'admin:write', 'billing:read', 'billing:write', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  admin: ['admin:read', 'billing:read', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  billing_admin: ['admin:read', 'billing:read', 'billing:write', 'support:read'],
  support: ['admin:read', 'support:read', 'support:write'],
  tech_support: ['admin:read', 'support:read', 'tech:read', 'tech:write'],
  read_only: ['admin:read', 'support:read'],
}

const EXEMPLO_CLIENTE = { id: 'exemplo', name: 'Juliane Pumuceno', email: 'exemplo@cliente.com', status: 'active' }

export async function adminEmailsRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const sendMail = opts.sendMail ?? defaultSendMail

  async function requireAdminAccess(req, reply, permission) {
    const user = await db.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, status: true, adminUser: { select: { id: true, role: true, status: true } } },
    })
    const access = resolveAdminAccess(user)
    if (!access.role || !(ROLE_PERMISSIONS[access.role] ?? []).includes(permission)) {
      reply.code(403).send({ error: 'Acesso admin negado' })
      return null
    }
    req.admin = { email: user?.email, role: access.role, adminUserId: access.adminUserId }
    return { ...access, user }
  }

  // Junta o catálogo com o override salvo, no formato que a tela consome.
  async function describeTemplate(slug) {
    const definition = getTemplateDefinition(slug)
    if (!definition) return null
    const template = await loadTemplate({ db, slug })
    return {
      slug,
      name: definition.name,
      description: definition.description,
      group: definition.group,
      groupLabel: EMAIL_GROUPS[definition.group] ?? definition.group,
      category: definition.category,
      trigger: definition.trigger,
      dedupDays: definition.dedupDays,
      subject: template.subject,
      body: template.body,
      enabled: template.enabled,
      customized: template.customized,
      defaults: { subject: definition.subject, body: definition.body },
      variables: variablesForTemplate(slug),
    }
  }

  function exampleVars(slug, extra = {}) {
    const vars = { ...standardVars({ user: EXEMPLO_CLIENTE }) }
    for (const variable of variablesForTemplate(slug)) {
      if (vars[variable.name] === undefined) vars[variable.name] = variable.example ?? `[${variable.name}]`
    }
    return { ...vars, ...extra }
  }

  // ------------------------------------------------------------- modelos

  app.get('/templates', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const overrides = await db.emailTemplate.findMany().catch(() => [])
    const bySlug = new Map(overrides.map((row) => [row.slug, row]))
    return {
      smtpConfigured: isEmailConfigured(),
      groups: EMAIL_GROUPS,
      filters: AUDIENCE_FILTERS,
      templates: listTemplateDefinitions().map((definition) => {
        const override = bySlug.get(definition.slug)
        return {
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
          group: definition.group,
          groupLabel: EMAIL_GROUPS[definition.group] ?? definition.group,
          category: definition.category,
          trigger: definition.trigger,
          enabled: override ? override.enabled !== false : true,
          customized: Boolean(override),
          updatedAt: override?.updatedAt ?? null,
        }
      }),
    }
  })

  app.get('/templates/:slug', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const described = await describeTemplate(req.params.slug)
    if (!described) return reply.code(404).send({ error: 'E-mail não encontrado' })
    const preview = renderTemplate({
      template: { ...described, title: getTemplateDefinition(req.params.slug).title },
      vars: exampleVars(req.params.slug),
      unsubscribeUrl: 'https://espelhagrupos.com.br/api/emails/unsubscribe?token=exemplo',
    })
    return { ...described, preview }
  })

  app.put('/templates/:slug', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:write'))) return
    const { slug } = req.params
    const definition = getTemplateDefinition(slug)
    if (!definition) return reply.code(404).send({ error: 'E-mail não encontrado' })

    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : ''
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    const enabled = req.body?.enabled === undefined ? true : Boolean(req.body.enabled)
    if (!subject) return reply.code(400).send({ error: 'O assunto não pode ficar vazio.' })
    if (!body) return reply.code(400).send({ error: 'O texto do e-mail não pode ficar vazio.' })

    // Variável inventada sairia em branco na caixa da cliente: recusa o save e
    // diz qual é, em vez de deixar o e-mail sair capenga.
    const conhecidas = new Set(variablesForTemplate(slug).map((v) => v.name))
    const desconhecidas = [...extractVariables(subject), ...extractVariables(body)].filter((name) => !conhecidas.has(name))
    if (desconhecidas.length) {
      return reply.code(400).send({
        error: `Estas variáveis não existem neste e-mail: ${desconhecidas.map((n) => `{{${n}}}`).join(', ')}. Use as da lista ao lado.`,
        unknownVariables: desconhecidas,
      })
    }

    const before = await db.emailTemplate.findUnique({ where: { slug } }).catch(() => null)
    const saved = await db.emailTemplate.upsert({
      where: { slug },
      create: { slug, subject, body, enabled, updatedByUserId: req.user.sub },
      update: { subject, body, enabled, updatedByUserId: req.user.sub },
    })
    await writeAdminAuditLog(req, {
      action: 'admin.email.template.update',
      resource: 'emailTemplate',
      resourceId: slug,
      before: before ? { subject: before.subject, enabled: before.enabled } : null,
      after: { subject: saved.subject, enabled: saved.enabled },
    })
    return { ...(await describeTemplate(slug)) }
  })

  // Voltar ao texto padrão do sistema = apagar o override.
  app.delete('/templates/:slug', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:write'))) return
    const { slug } = req.params
    if (!getTemplateDefinition(slug)) return reply.code(404).send({ error: 'E-mail não encontrado' })
    let restored = false
    try {
      await db.emailTemplate.delete({ where: { slug } })
      restored = true
    } catch (err) {
      if (err?.code !== 'P2025') throw err
    }
    await writeAdminAuditLog(req, { action: 'admin.email.template.reset', resource: 'emailTemplate', resourceId: slug, after: { restored } })
    return { ...(await describeTemplate(slug)), restored }
  })

  app.post('/templates/:slug/preview', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const { slug } = req.params
    const definition = getTemplateDefinition(slug)
    if (!definition) return reply.code(404).send({ error: 'E-mail não encontrado' })
    const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject : undefined
    const body = typeof req.body?.body === 'string' && req.body.body.trim() ? req.body.body : undefined
    const saved = await loadTemplate({ db, slug })
    const preview = renderTemplate({
      template: { ...saved, title: definition.title, subject: subject ?? saved.subject, body: body ?? saved.body },
      vars: exampleVars(slug, req.body?.vars ?? {}),
      unsubscribeUrl: 'https://espelhagrupos.com.br/api/emails/unsubscribe?token=exemplo',
    })
    return preview
  })

  // Manda o e-mail para o endereço da própria admin, sem tocar em cliente.
  app.post('/templates/:slug/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'admin:write')
    if (!access) return
    const { slug } = req.params
    if (!getTemplateDefinition(slug)) return reply.code(404).send({ error: 'E-mail não encontrado' })
    if (!isEmailConfigured()) {
      return reply.code(409).send({ error: 'O envio de e-mail ainda não está ligado neste ambiente.' })
    }
    const to = typeof req.body?.to === 'string' && req.body.to.includes('@') ? req.body.to.trim() : access.user?.email
    const result = await sendTemplateEmail({
      db,
      sendMail,
      slug,
      user: { id: req.user.sub, name: access.user?.name ?? 'Teste', email: to, status: 'active' },
      vars: exampleVars(slug, req.body?.vars ?? {}),
      mode: 'test',
      ignoreDedup: true,
      ignoreDailyCap: true,
      logger: req.log,
    })
    await writeAdminAuditLog(req, { action: 'admin.email.template.test', resource: 'emailTemplate', resourceId: slug, after: { to, sent: result.sent } })
    return { ...result, to }
  })

  // ------------------------------------------------------------- público

  app.post('/audience/preview', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const filters = req.body?.filters ?? {}
    const slug = typeof req.body?.slug === 'string' ? req.body.slug : null
    const recipients = await loadAudience({ db, slug, filters })
    return {
      total: recipients.length,
      description: describeAudience(filters),
      sample: recipients.slice(0, 25).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        accessExpiresAt: user.accessExpiresAt,
      })),
      truncated: recipients.length > 25,
    }
  })

  // Lista para a seleção manual (checkbox na tela).
  app.get('/audience/search', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const busca = String(req.query?.q ?? '').trim()
    const where = buildAudienceWhere(busca ? { busca } : {})
    const users = await db.user.findMany({
      where,
      select: { id: true, name: true, email: true, plan: true, accessExpiresAt: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })
    return { users }
  })

  // ------------------------------------------------------------- disparo

  app.post('/send', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:write'))) return
    const slug = String(req.body?.slug ?? '')
    const definition = getTemplateDefinition(slug)
    if (!definition) return reply.code(404).send({ error: 'E-mail não encontrado' })
    if (!isEmailConfigured()) {
      return reply.code(409).send({ error: 'O envio de e-mail ainda não está ligado neste ambiente.' })
    }

    const filters = req.body?.filters ?? {}
    const recipients = await loadAudience({ db, slug, filters })
    if (!recipients.length) return reply.code(400).send({ error: 'Nenhum cliente se encaixa nesses filtros.' })

    // Confirmação de segurança: a tela manda de volta o número que mostrou.
    // Se a base mudou entre a conferida e o clique, o disparo para aqui em vez
    // de sair para mais gente do que a admin viu.
    const confirmado = Number(req.body?.confirmTotal)
    if (Number.isFinite(confirmado) && confirmado !== recipients.length) {
      return reply.code(409).send({
        error: `A lista mudou: agora são ${recipients.length} clientes (você conferiu ${confirmado}). Revise e confirme de novo.`,
        total: recipients.length,
      })
    }

    const batch = await enqueueEmailBatch({
      db,
      slug,
      recipients,
      filters: { ...filters, descricao: describeAudience(filters) },
      createdByUserId: req.user.sub,
    })
    await writeAdminAuditLog(req, {
      action: 'admin.email.batch.create',
      resource: 'emailBatch',
      resourceId: batch.batchId,
      after: { slug, ...batch, filtros: describeAudience(filters) },
    })
    return {
      ...batch,
      description: describeAudience(filters),
      ritmo: `${resolveBatchSize()} e-mails por minuto, até ${resolveDailyCap()} por dia`,
      tetoDiario: resolveDailyCap(),
      proximaViradaLabel: describeWindowStart(nextDailyWindowStart(new Date())),
    }
  })

  app.get('/batches', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const batches = await db.emailBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 30 })
    const detalhado = []
    for (const batch of batches) {
      const [enviados, naFila, descartados, erros] = await Promise.all([
        db.emailSendLog.count({ where: { batchId: batch.id, status: 'sent' } }),
        db.emailSendLog.count({ where: { batchId: batch.id, status: 'queued' } }),
        db.emailSendLog.count({ where: { batchId: batch.id, status: 'skipped' } }),
        db.emailSendLog.count({ where: { batchId: batch.id, status: 'error' } }),
      ])
      let descricao = ''
      try {
        descricao = JSON.parse(batch.filters ?? '{}')?.descricao ?? ''
      } catch { /* filtros ilegíveis não podem quebrar a tela */ }
      detalhado.push({
        id: batch.id,
        slug: batch.slug,
        name: getTemplateDefinition(batch.slug)?.name ?? batch.slug,
        status: batch.status,
        total: batch.total,
        createdAt: batch.createdAt,
        finishedAt: batch.finishedAt,
        descricao,
        enviados,
        naFila,
        descartados,
        erros,
      })
    }
    return { batches: detalhado }
  })

  app.post('/batches/:id/cancel', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:write'))) return
    const result = await cancelEmailBatch({ db, batchId: req.params.id })
    await writeAdminAuditLog(req, { action: 'admin.email.batch.cancel', resource: 'emailBatch', resourceId: req.params.id, after: result })
    return result
  })

  // ------------------------------------------------------------- histórico

  app.get('/sends', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    const where = {}
    if (req.query?.slug) where.slug = String(req.query.slug)
    if (req.query?.status) where.status = String(req.query.status)
    const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500)
    const rows = await db.emailSendLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
    return {
      sends: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: getTemplateDefinition(row.slug)?.name ?? row.slug,
        email: row.email,
        status: row.status,
        skipReason: row.skipReason,
        error: row.error,
        mode: row.mode,
        batchId: row.batchId,
        createdAt: row.createdAt,
        sentAt: row.sentAt,
      })),
    }
  })

  // Resumo do topo da tela: quanto saiu hoje, quanto está na fila.
  app.get('/summary', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requireAdminAccess(req, reply, 'admin:read'))) return
    // O "dia" do teto começa na virada das 8h (America/Sao_Paulo), então o
    // resumo conta a mesma janela que o despachante — senão a tela diria que
    // sobrou cota quando o teto já bateu.
    const agora = new Date()
    const inicioDoDia = resolveDailyWindowStart(agora)
    const proximaVirada = nextDailyWindowStart(agora)
    const [enviadosNoDia, naFila, errosNoDia, descadastros] = await Promise.all([
      db.emailSendLog.count({ where: { status: 'sent', createdAt: { gte: inicioDoDia } } }),
      db.emailSendLog.count({ where: { status: 'queued' } }),
      db.emailSendLog.count({ where: { status: 'error', createdAt: { gte: inicioDoDia } } }),
      db.emailOptOut.count().catch(() => 0),
    ])
    return {
      smtpConfigured: isEmailConfigured(),
      enviadosNoDia,
      // Nome antigo mantido para não quebrar tela em cache durante o deploy.
      enviados24h: enviadosNoDia,
      naFila,
      errosNoDia,
      erros24h: errosNoDia,
      descadastros,
      tetoDiario: resolveDailyCap(),
      porRodada: resolveBatchSize(),
      inicioDoDia: inicioDoDia.toISOString(),
      proximaVirada: proximaVirada.toISOString(),
      proximaViradaLabel: describeWindowStart(proximaVirada),
    }
  })
}
