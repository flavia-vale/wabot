// M8 da auditoria do painel admin: tela "Auditoria" (quem fez o quê).
// Regra PURA (sem banco). O dicionário traduz a ação gravada em
// `AdminAuditLog.action` para frase leiga; test/admin-auditoria-tela.test.js
// falha se o código gravar uma ação `admin.*` que não esteja aqui.

export const AUDIT_LABELS = Object.freeze({
  'admin.access_denied': 'tentou acessar sem permissão',
  'admin.mfa_required': 'foi barrado por falta de verificação em duas etapas',
  'admin.affiliate.approve': 'aprovou um afiliado',
  'admin.affiliate.reject': 'recusou um afiliado',
  'admin.affiliate.settings.update': 'mudou as regras do programa de afiliados',
  'admin.affiliate.commission_override': 'ajustou a comissão de um afiliado',
  'admin.affiliate.commission.approve': 'aprovou uma comissão',
  'admin.affiliate.commission.mark_paid': 'marcou uma comissão como paga',
  'admin.affiliate.commission.reverse': 'estornou uma comissão',
  'admin.affiliate.cycle.mark_all_paid': 'marcou o ciclo inteiro de comissões como pago',
  'admin.affiliate.payout.confirm': 'confirmou um saque de afiliado',
  'admin.affiliate.payout.reject': 'recusou um saque de afiliado',
  'admin.automation_quota.list': 'consultou as cotas de automação',
  'admin.automation_quota.update': 'mudou a cota de automação de um cliente',
  'admin.billing.webhooks.list': 'consultou os avisos do Mercado Pago',
  'admin.capacity.refresh': 'pediu para recalcular a capacidade do servidor',
  'admin.customer.contact.create': 'registrou um contato com o cliente',
  'admin.customers.history': 'abriu o histórico de um cliente',
  'admin.customers.list': 'consultou a lista de clientes',
  'admin.email.batch.cancel': 'cancelou um lote de e-mails',
  'admin.email.batch.create': 'criou um lote de e-mails',
  'admin.email.template.reset': 'voltou um e-mail ao texto padrão',
  'admin.email.template.test': 'enviou um e-mail de teste',
  'admin.email.template.update': 'editou o texto de um e-mail',
  'admin.errors.observability.read': 'consultou os erros do sistema',
  'admin.faq.create': 'criou uma pergunta frequente',
  'admin.faq.delete': 'apagou uma pergunta frequente',
  'admin.faq.list': 'consultou as perguntas frequentes',
  'admin.faq.update': 'editou uma pergunta frequente',
  'admin.filas.list': 'consultou os envios presos',
  'admin.filas.reprocessar': 'destravou envios presos de um cliente',
  'admin.finance.churn.read': 'consultou os cancelamentos',
  'admin.finance.costs.update': 'mudou os custos da operação',
  'admin.finance.ltv.read': 'consultou o valor por cliente (LTV)',
  'admin.finance.overview.read': 'consultou o financeiro',
  'admin.finance.roi.read': 'consultou o retorno (ROI)',
  'admin.finance.subscription_charges.list': 'consultou as cobranças de assinatura',
  'admin.funnel.read': 'consultou o funil de cadastro',
  'admin.inbox.read': 'abriu a caixa de prioridades',
  'admin.legalTerms.update': 'editou os termos legais',
  'admin.legalTerms.view': 'abriu os termos legais',
  'admin.logs.list': 'consultou os logs de envio',
  'admin.logs.summary.read': 'consultou o resumo dos logs',
  'admin.lpContent.view': 'abriu o conteúdo da página de vendas',
  'admin.lpPlan.update': 'mudou os planos da página de vendas',
  'admin.marketing.campanhaCanais.read': 'consultou os canais das campanhas',
  'admin.online.read': 'consultou quem está online',
  'admin.online.reconnect': 'reconectou o robô de um cliente',
  'admin.online.reconnect_failed': 'tentou reconectar um robô e não conseguiu',
  'admin.online.user_detail': 'abriu o detalhe online de um cliente',
  'admin.overview.read': 'consultou o resumo do painel',
  'admin.payment.manual.create': 'registrou um pagamento manual',
  'admin.payment.refund.create': 'fez um reembolso',
  'admin.payments.list': 'consultou os pagamentos',
  'admin.pipeline.read': 'consultou o backlog de melhorias',
  'admin.pipeline.status.update': 'mudou o status de um item do backlog',
  'admin.sendDlq.discard': 'descartou um envio da fila de erros',
  'admin.sendDlq.list': 'consultou a fila de erros de envio',
  'admin.sendDlq.purge': 'limpou a fila de erros de um cliente',
  'admin.sendDlq.retry': 'reenviou um item da fila de erros',
  'admin.session.stop': 'parou o robô de um cliente',
  'admin.session.telemetry.read': 'consultou a telemetria de sessões',
  'admin.sessions.list': 'consultou as sessões de WhatsApp',
  'admin.shard_poc.member.rollback': 'desfez a migração de um cliente no teste de shards',
  'admin.shard_poc.member.start': 'iniciou a migração de um cliente no teste de shards',
  'admin.subscriptions.list': 'consultou as assinaturas',
  'admin.success.metrics.read': 'consultou as métricas de sucesso do cliente',
  'admin.success.overview.read': 'consultou o resumo de sucesso do cliente',
  'admin.success.queue.list': 'consultou a fila de sucesso do cliente',
  'admin.system.health.read': 'consultou a saúde do sistema',
  'admin.system.metrics.read': 'consultou as métricas do sistema',
  'admin.system.observability.read': 'consultou a observabilidade do sistema',
  'admin.tutorial.update': 'editou um tutorial',
  'admin.user.access.update': 'mudou o acesso de um cliente',
  'admin.user.block': 'bloqueou a conta',
  'admin.user.diagnostico_envios': 'rodou o diagnóstico de envios de um cliente',
  'admin.user.unblock': 'desbloqueou a conta',
  'admin.users.access': 'consultou o acesso de um cliente',
  'admin.users.detail': 'abriu a ficha de um cliente',
  'admin.users.list': 'consultou a lista de usuários',
  'admin.users.wa_disconnected.list': 'consultou os clientes com WhatsApp desconectado',
  'admin.whatsapp.self_message.send': 'mandou um aviso pelo WhatsApp a um cliente',
  'admin.whatsapp.self_message.send_bulk': 'mandou avisos em massa pelo WhatsApp',
})

export const AUDIT_MAX_TAKE = 200
export const AUDIT_DEFAULT_TAKE = 50
export const AUDIT_MAX_DAYS = 180
const DAY_MS = 86_400_000

// Ação sem rótulo (ex.: gravada por outro módulo) cai num texto neutro com a
// chave crua — nunca quebra a tela.
export function auditActionLabel(action) {
  const key = String(action ?? '')
  return AUDIT_LABELS[key] ?? (key ? `ação ${key}` : 'ação desconhecida')
}

function clampInt(value, def, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

// Normaliza a query da rota. `take` ≤ 200, `days` 1..180, texto aparado.
export function parseAuditQuery(query = {}) {
  const text = v => String(v ?? '').trim().slice(0, 120)
  return {
    days: clampInt(query.days, 30, 1, AUDIT_MAX_DAYS),
    take: clampInt(query.take, AUDIT_DEFAULT_TAKE, 1, AUDIT_MAX_TAKE),
    page: clampInt(query.page, 1, 1, 10_000),
    action: text(query.action),
    actor: text(query.actor),
    target: text(query.target),
  }
}

// Monta o `where` do Prisma. actor/target casam por id OU e-mail (contém).
export function buildAuditWhere(parsed, nowMs = Date.now()) {
  const where = { createdAt: { gte: new Date(nowMs - parsed.days * DAY_MS) } }
  if (parsed.action) where.action = { contains: parsed.action }
  const who = (idField, relation, v) => ({
    OR: [{ [idField]: v }, { [relation]: { is: { email: { contains: v.toLowerCase() } } } }],
  })
  const and = []
  if (parsed.actor) and.push(who('actorUserId', 'actorUser', parsed.actor))
  if (parsed.target) and.push(who('targetUserId', 'targetUser', parsed.target))
  if (and.length) where.AND = and
  return where
}

// Só owner/admin leem a trilha (além de admin:read, já exigido pela rota).
export function canReadAudit(role) {
  return role === 'owner' || role === 'admin'
}

function parseJson(value, redact) {
  if (value == null || value === '') return null
  try { return redact(JSON.parse(value)) } catch { return null }
}

// `redact` = redactAdminPayload (injetado para manter a regra pura).
export function buildAuditRows(rows, redact) {
  return (rows ?? []).map(r => ({
    id: r.id,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
    actor: r.actorUser ? { id: r.actorUser.id, email: r.actorUser.email, name: r.actorUser.name ?? null } : null,
    target: r.targetUser ? { id: r.targetUser.id, email: r.targetUser.email, name: r.targetUser.name ?? null } : null,
    action: r.action,
    label: auditActionLabel(r.action),
    resource: r.resource,
    resourceId: r.resourceId ?? null,
    reason: r.reason ?? null,
    status: r.status,
    ip: r.ip ?? null,
    before: parseJson(r.before, redact),
    after: parseJson(r.after, redact),
  }))
}
