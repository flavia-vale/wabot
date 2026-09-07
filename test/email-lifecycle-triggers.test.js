// Gatilhos de e-mail por ciclo de vida (fase 3): quem recebe o quê e quando.
// Decisão pura + passada com banco fingido. Sem banco, rede ou SMTP reais.

import test from 'node:test'
import assert from 'node:assert/strict'
import { decideLifecycleEmail, daysUntil, formatDateBR, formatMoneyBR, resolveTriggersStartAt } from '../src/emailTriggers/lifecyclePolicy.js'
import { runLifecycleEmailSweep } from '../src/emailTriggers/lifecycleSweep.js'
import { listTemplateDefinitions, getTemplateDefinition } from '../src/email/registry.js'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-08-16T12:00:00Z')
const silentLogger = { info() {}, warn() {}, error() {} }

function base(extra = {}) {
  return {
    id: 'u1',
    name: 'Juliane',
    email: 'juliane@exemplo.com',
    status: 'active',
    plan: 'trial',
    createdAt: new Date(NOW.getTime() - 3 * DAY),
    accessExpiresAt: new Date(NOW.getTime() + 30 * DAY),
    waEverConnected: true,
    waConnected: true,
    hasMonitorGroup: true,
    hasPostGroup: true,
    lastSuccessAt: new Date(NOW.getTime() - HOUR),
    isAffiliate: false,
    affiliateAvailableCents: 0,
    minPayoutCents: 5000,
    ...extra,
  }
}

// ------------------------------------------------------------------ utilitários

test('daysUntil conta dia cheio e fica negativo depois do vencimento', () => {
  assert.equal(daysUntil(new Date(NOW.getTime() + 3 * DAY), NOW), 3)
  assert.equal(daysUntil(new Date(NOW.getTime() + 2.5 * DAY), NOW), 3)
  assert.equal(daysUntil(new Date(NOW.getTime() - DAY), NOW), -1)
  assert.equal(daysUntil(null, NOW), null)
})

test('datas e valores saem no formato brasileiro', () => {
  assert.match(formatDateBR('2026-08-19T12:00:00Z'), /^19\/08\/2026$/)
  assert.match(formatMoneyBR(6900), /69,00/)
})

// ------------------------------------------------------------------ contagem regressiva

test('teste grátis: 3, 2 e 1 dia têm e-mails próprios', () => {
  for (const [dias, slug] of [[3, 'teste_acaba_em_3_dias'], [2, 'teste_acaba_em_2_dias'], [1, 'teste_acaba_em_1_dia']]) {
    const decision = decideLifecycleEmail(base({ accessExpiresAt: new Date(NOW.getTime() + dias * DAY) }), NOW)
    assert.equal(decision?.slug, slug)
    assert.equal(decision.vars.dias_restantes, String(dias))
    assert.match(decision.vars.fim_do_teste, /^\d{2}\/\d{2}\/\d{4}$/)
  }
})

test('teste grátis com 5 dias pela frente não gera aviso', () => {
  assert.equal(decideLifecycleEmail(base({ accessExpiresAt: new Date(NOW.getTime() + 5 * DAY) }), NOW), null)
})

test('teste acabou ontem gera o aviso de fim de teste', () => {
  const decision = decideLifecycleEmail(base({ accessExpiresAt: new Date(NOW.getTime() - DAY) }), NOW)
  assert.equal(decision?.slug, 'teste_acabou')
})

test('plano pago tem contagem regressiva própria e aviso de vencido', () => {
  for (const [dias, slug] of [[3, 'plano_vence_em_3_dias'], [2, 'plano_vence_em_2_dias'], [1, 'plano_vence_em_1_dia']]) {
    const decision = decideLifecycleEmail(base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() + dias * DAY) }), NOW)
    assert.equal(decision?.slug, slug)
    assert.match(decision.vars.data_vencimento, /^\d{2}\/\d{2}\/\d{4}$/)
  }
  assert.equal(decideLifecycleEmail(base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() - DAY) }), NOW)?.slug, 'plano_venceu')
  // Os dias de cada etapa depois do vencimento moram em expiredPlanJourney.js —
  // a jornada completa é coberta em test/email-plano-vencido-jornada.test.js.
  assert.equal(decideLifecycleEmail(base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() - 9 * DAY) }), NOW)?.slug, 'plano_vencido_volta')
})

test('conta banida ou suspensa não recebe nada', () => {
  assert.equal(decideLifecycleEmail(base({ status: 'banned', accessExpiresAt: new Date(NOW.getTime() + DAY) }), NOW), null)
  assert.equal(decideLifecycleEmail(base({ status: 'suspended', accessExpiresAt: new Date(NOW.getTime() + DAY) }), NOW), null)
})

// ------------------------------------------------------------------ saúde do robô

test('WhatsApp caído há mais de um dia vira aviso', () => {
  const snapshot = base({ waConnected: false, waDisconnectedSince: new Date(NOW.getTime() - 30 * HOUR) })
  assert.equal(decideLifecycleEmail(snapshot, NOW)?.slug, 'whatsapp_desconectado')
})

test('WhatsApp caído há 3 horas NÃO vira aviso (o robô reconecta sozinho)', () => {
  const snapshot = base({ waConnected: false, waDisconnectedSince: new Date(NOW.getTime() - 3 * HOUR) })
  assert.equal(decideLifecycleEmail(snapshot, NOW), null)
})

test('cadastrou e nunca conectou vira aviso depois de 2 dias', () => {
  const snapshot = base({ waEverConnected: false, waConnected: false, createdAt: new Date(NOW.getTime() - 3 * DAY) })
  assert.equal(decideLifecycleEmail(snapshot, NOW)?.slug, 'onboarding_conecte_whatsapp')

  const recem = base({ waEverConnected: false, waConnected: false, createdAt: new Date(NOW.getTime() - 6 * HOUR) })
  assert.equal(decideLifecycleEmail(recem, NOW), null)
})

test('falta grupo de origem/destino: o aviso diz o que falta', () => {
  const semDestino = decideLifecycleEmail(base({ hasPostGroup: false }), NOW)
  assert.equal(semDestino?.slug, 'configuracao_incompleta')
  assert.match(semDestino.vars.o_que_falta, /para onde as ofertas vão/)

  const semNada = decideLifecycleEmail(base({ hasMonitorGroup: false, hasPostGroup: false }), NOW)
  assert.match(semNada.vars.o_que_falta, /vêm.*e.*vão/)
})

test('cliente pagante parado há 2 dias vira aviso; quem nunca enviou não', () => {
  const parado = base({ plan: 'pro', lastSuccessAt: new Date(NOW.getTime() - 3 * DAY) })
  assert.equal(decideLifecycleEmail(parado, NOW)?.slug, 'robo_parado')

  const nuncaEnviou = base({ plan: 'pro', lastSuccessAt: null })
  assert.equal(decideLifecycleEmail(nuncaEnviou, NOW), null)
})

test('sem acesso ativo, aviso de saúde do robô não é enviado', () => {
  // 40 dias vencida: já passou da jornada de recuperação, então o único e-mail
  // que poderia sair aqui seria o de saúde do robô — e ele não sai.
  const semAcesso = base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() - 40 * DAY), waConnected: false, waDisconnectedSince: new Date(NOW.getTime() - 5 * DAY) })
  assert.equal(decideLifecycleEmail(semAcesso, NOW), null)
})

// ------------------------------------------------------------------ afiliados

test('saldo acima do mínimo avisa que dá para sacar', () => {
  const decision = decideLifecycleEmail(base({ isAffiliate: true, affiliateAvailableCents: 6200, minPayoutCents: 5000 }), NOW)
  assert.equal(decision?.slug, 'saque_disponivel')
  assert.match(decision.vars.saldo, /62,00/)
  assert.match(decision.vars.minimo, /50,00/)
})

test('saldo abaixo do mínimo não avisa', () => {
  assert.equal(decideLifecycleEmail(base({ isAffiliate: true, affiliateAvailableCents: 900, minPayoutCents: 5000 }), NOW), null)
})

test('convite de afiliada só depois de 14 dias de conta', () => {
  assert.equal(decideLifecycleEmail(base({ createdAt: new Date(NOW.getTime() - 20 * DAY) }), NOW)?.slug, 'seja_afiliado')
  assert.equal(decideLifecycleEmail(base({ createdAt: new Date(NOW.getTime() - 5 * DAY) }), NOW), null)
})

// ------------------------------------------- gatilho de cadastro não é retroativo

test('base antiga não recebe e-mail de "dias após o cadastro"', () => {
  const antiga = { createdAt: new Date(NOW.getTime() - 240 * DAY) }

  const nuncaConectou = base({ ...antiga, waEverConnected: false, waConnected: false })
  assert.equal(decideLifecycleEmail(nuncaConectou, NOW), null, 'onboarding voltou a ser retroativo')

  const semDestino = base({ ...antiga, hasPostGroup: false })
  assert.equal(decideLifecycleEmail(semDestino, NOW), null, 'configuração incompleta voltou a ser retroativa')

  assert.equal(decideLifecycleEmail(base(antiga), NOW), null, 'convite de afiliada voltou a ser retroativo')
})

test('o corte de virada vale por conta: quem se cadastrou antes dele não dispara', () => {
  const virada = new Date(NOW.getTime() - 2 * DAY)
  const snapshot = base({ waEverConnected: false, waConnected: false, createdAt: new Date(NOW.getTime() - 3 * DAY) })

  assert.equal(decideLifecycleEmail(snapshot, NOW)?.slug, 'onboarding_conecte_whatsapp')
  assert.equal(decideLifecycleEmail(snapshot, NOW, { triggersStartAt: virada }), null)

  const depoisDaVirada = base({ waEverConnected: false, waConnected: false, createdAt: new Date(NOW.getTime() - DAY) })
  const passados3Dias = new Date(NOW.getTime() + 2 * DAY)
  assert.equal(
    decideLifecycleEmail(depoisDaVirada, passados3Dias, { triggersStartAt: virada })?.slug,
    'onboarding_conecte_whatsapp',
    'quem se cadastrou depois da virada continua recebendo',
  )
})

test('o corte NÃO silencia aviso de fato atual (vencimento, robô caído, saque)', () => {
  const virada = new Date(NOW.getTime() - DAY)
  const antiga = new Date(NOW.getTime() - 300 * DAY)
  const opcoes = { triggersStartAt: virada }

  const vencendo = base({ plan: 'pro', createdAt: antiga, accessExpiresAt: new Date(NOW.getTime() + 3 * DAY) })
  assert.equal(decideLifecycleEmail(vencendo, NOW, opcoes)?.slug, 'plano_vence_em_3_dias')

  const caido = base({ createdAt: antiga, waConnected: false, waDisconnectedSince: new Date(NOW.getTime() - 30 * HOUR) })
  assert.equal(decideLifecycleEmail(caido, NOW, opcoes)?.slug, 'whatsapp_desconectado')

  const comSaldo = base({ createdAt: antiga, isAffiliate: true, affiliateAvailableCents: 9000, minPayoutCents: 5000 })
  assert.equal(decideLifecycleEmail(comSaldo, NOW, opcoes)?.slug, 'saque_disponivel')
})

test('resolveTriggersStartAt: sem env é null, data inválida também', () => {
  assert.equal(resolveTriggersStartAt({}), null)
  assert.equal(resolveTriggersStartAt({ EMAIL_TRIGGERS_START_AT: '   ' }), null)
  assert.equal(resolveTriggersStartAt({ EMAIL_TRIGGERS_START_AT: 'ontem' }), null)
  assert.equal(
    resolveTriggersStartAt({ EMAIL_TRIGGERS_START_AT: '2026-08-17' })?.toISOString(),
    new Date('2026-08-17').toISOString(),
  )
})

// ------------------------------------------------------------------ prioridade

test('cobrança tem prioridade sobre convite de afiliada e robô parado', () => {
  const snapshot = base({
    plan: 'pro',
    accessExpiresAt: new Date(NOW.getTime() + 2 * DAY),
    createdAt: new Date(NOW.getTime() - 60 * DAY),
    lastSuccessAt: new Date(NOW.getTime() - 5 * DAY),
    isAffiliate: false,
  })
  assert.equal(decideLifecycleEmail(snapshot, NOW)?.slug, 'plano_vence_em_2_dias')
})

test('pagamento começado e não concluído vira lembrete entre 2h e 48h', () => {
  const semAcesso = { accessExpiresAt: new Date(NOW.getTime() - 10 * DAY), plan: 'trial' }
  const recente = base({ ...semAcesso, pendingPaymentAt: new Date(NOW.getTime() - 30 * 60 * 1000), pendingPaymentPlan: 'pro' })
  assert.notEqual(decideLifecycleEmail(recente, NOW)?.slug, 'pagamento_pendente')

  const maduro = base({ ...semAcesso, accessExpiresAt: new Date(NOW.getTime() - 10 * DAY), pendingPaymentAt: new Date(NOW.getTime() - 5 * HOUR), pendingPaymentPlan: 'pro' })
  const decision = decideLifecycleEmail(maduro, NOW)
  assert.equal(decision?.slug, 'pagamento_pendente')
  assert.equal(decision.vars.plano, 'pro')
})

// ------------------------------------------------------------------ catálogo x política

test('todo e-mail que a política pede existe no catálogo', () => {
  const cenarios = [
    base({ accessExpiresAt: new Date(NOW.getTime() + 3 * DAY) }),
    base({ accessExpiresAt: new Date(NOW.getTime() + 2 * DAY) }),
    base({ accessExpiresAt: new Date(NOW.getTime() + DAY) }),
    base({ accessExpiresAt: new Date(NOW.getTime() - DAY) }),
    base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() + 3 * DAY) }),
    base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() + 2 * DAY) }),
    base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() + DAY) }),
    base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() - DAY) }),
    base({ plan: 'pro', accessExpiresAt: new Date(NOW.getTime() - 9 * DAY) }),
    base({ waConnected: false, waDisconnectedSince: new Date(NOW.getTime() - 30 * HOUR) }),
    base({ waEverConnected: false, waConnected: false, createdAt: new Date(NOW.getTime() - 3 * DAY) }),
    base({ hasPostGroup: false }),
    base({ plan: 'pro', lastSuccessAt: new Date(NOW.getTime() - 3 * DAY) }),
    base({ isAffiliate: true, affiliateAvailableCents: 9000 }),
    base({ createdAt: new Date(NOW.getTime() - 20 * DAY) }),
    base({ accessExpiresAt: new Date(NOW.getTime() - 10 * DAY), pendingPaymentAt: new Date(NOW.getTime() - 5 * HOUR) }),
  ]
  for (const snapshot of cenarios) {
    const decision = decideLifecycleEmail(snapshot, NOW)
    assert.ok(decision, 'cenário deveria gerar e-mail')
    const definition = getTemplateDefinition(decision.slug)
    assert.ok(definition, `catálogo não tem ${decision.slug}`)
    // Toda variável exigida pelo texto precisa vir da política (ou ser padrão).
    for (const variable of definition.variables) {
      if (variable.name.startsWith('link_')) continue // links vêm da passada
      assert.ok(variable.name in decision.vars, `${decision.slug} precisa da variável ${variable.name}`)
    }
  }
})

test('cada e-mail do catálogo tem descrição e nome legíveis para o painel', () => {
  for (const definition of listTemplateDefinitions()) {
    assert.ok(definition.description.length > 10, `descrição curta demais em ${definition.slug}`)
    assert.ok(['auto', 'manual'].includes(definition.trigger), `trigger inválido em ${definition.slug}`)
  }
})

// ------------------------------------------------------------------ passada

function makeSweepDb({ users = [], waSessions = [], groups = [], logs = [] } = {}) {
  const sent = []
  return {
    sent,
    user: {
      findMany: async () => users,
      findUnique: async ({ where }) => users.find((u) => u.id === where.id) ?? null,
    },
    waSession: { findUnique: async ({ where }) => waSessions.find((s) => s.userId === where.userId) ?? null },
    group: { findFirst: async ({ where }) => groups.find((g) => g.userId === where.userId && g.role === where.role) ?? null },
    messageLog: { findFirst: async () => null },
    payment: { findFirst: async () => null },
    affiliateProfile: { findUnique: async () => null },
    affiliateCommission: { findMany: async () => [] },
    affiliateSettings: { findUnique: async () => ({ minPayoutCents: 5000, commissionPercent: 30 }) },
    emailTemplate: { findUnique: async () => null },
    emailOptOut: { findUnique: async () => null },
    analyticsEvent: { count: async () => 0 },
    emailSendLog: {
      count: async ({ where }) => logs.filter((row) => row.slug === where.slug && row.userId === where.userId).length,
      create: async ({ data }) => { const row = { id: `l${logs.length + 1}`, ...data }; logs.push(row); return row },
      update: async () => ({}),
    },
    logs,
  }
}

test('passada manda o e-mail devido e ignora quem não tem nada a receber', async () => {
  const users = [
    { id: 'u1', name: 'Juliane', email: 'juliane@exemplo.com', status: 'active', plan: 'trial', createdAt: new Date(NOW.getTime() - 5 * DAY), accessExpiresAt: new Date(NOW.getTime() + 2 * DAY) },
    { id: 'u2', name: 'Sem nada', email: 'ok@exemplo.com', status: 'active', plan: 'pro', createdAt: new Date(NOW.getTime() - 5 * DAY), accessExpiresAt: new Date(NOW.getTime() + 25 * DAY) },
    { id: 'u3', name: 'Falso', email: 'user_ab@sistema.com', status: 'active', plan: 'trial', createdAt: new Date(NOW.getTime() - 5 * DAY), accessExpiresAt: new Date(NOW.getTime() + DAY) },
  ]
  const db = makeSweepDb({
    users,
    waSessions: [{ userId: 'u1', status: 'connected' }, { userId: 'u2', status: 'connected' }],
    groups: [
      { userId: 'u1', role: 'monitor' }, { userId: 'u1', role: 'post' },
      { userId: 'u2', role: 'monitor' }, { userId: 'u2', role: 'post' },
    ],
  })
  const enviados = []
  const summary = await runLifecycleEmailSweep({
    db,
    sendMail: async (msg) => { enviados.push(msg); return { skipped: false } },
    now: NOW,
    logger: silentLogger,
    secret: 's',
  })

  assert.equal(summary.sent, 1)
  assert.equal(enviados.length, 1)
  assert.match(enviados[0].subject, /2 dias do seu teste/)
  assert.equal(summary.bySlug.teste_acaba_em_2_dias, 1)
})

test('passada não deixa um cliente com erro derrubar os outros', async () => {
  const users = [
    { id: 'u1', name: 'A', email: 'a@exemplo.com', status: 'active', plan: 'trial', createdAt: new Date(NOW.getTime() - 5 * DAY), accessExpiresAt: new Date(NOW.getTime() + DAY) },
    { id: 'u2', name: 'B', email: 'b@exemplo.com', status: 'active', plan: 'trial', createdAt: new Date(NOW.getTime() - 5 * DAY), accessExpiresAt: new Date(NOW.getTime() + DAY) },
  ]
  const db = makeSweepDb({ users })
  db.waSession.findUnique = async ({ where }) => {
    if (where.userId === 'u1') throw new Error('SQLITE_BUSY')
    return { userId: 'u2', status: 'connected' }
  }
  const enviados = []
  const summary = await runLifecycleEmailSweep({
    db,
    sendMail: async (msg) => { enviados.push(msg); return { skipped: false } },
    now: NOW,
    logger: silentLogger,
    secret: 's',
  })
  // A consulta de sessão é isolada: falha nela não impede o aviso de cobrança.
  assert.equal(summary.sent, 2)
  assert.equal(enviados.length, 2)
})
