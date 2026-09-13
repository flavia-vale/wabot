import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BILLING_SEVERITY,
  assessBillingMachine,
  checkBillingConfig,
  describeBillingMachine,
} from '../src/domain/payments/billingHealth.js'
import {
  decideChargeFailureNotice,
  describeChargeFailureForCustomer,
} from '../src/domain/payments/chargeFailureNotice.js'
import { shouldSendAdminAlert, resolveAdminAlertEmail, adminAlertsEnabled, DEFAULT_ADMIN_ALERT_EMAIL } from '../src/email/adminAlerts.js'
import { getTemplateDefinition, EMAIL_GROUPS } from '../src/email/registry.js'

/*
 * Plano B da cobrança (2026-09-08).
 *
 * Tudo aqui existe porque falha de pagamento é silenciosa: ninguém reclama de
 * uma cobrança que não aconteceu. Três frentes — a rede de segurança não pode
 * morrer junto com outra env; a cliente precisa saber ENQUANTO o acesso vale;
 * e a administradora precisa ser avisada por e-mail, não por linha de log.
 */

// ------------------------------------------------- a máquina está de pé?

test('rede de segurança desligada é problema CRÍTICO, não detalhe', () => {
  const relatorio = checkBillingConfig({ env: { MP_ACCESS_TOKEN: 'APP_USR-x', PAYMENT_RECONCILIATION_ENABLED: 'false' } })
  const problema = relatorio.problems.find(p => p.code === 'sem_rede_de_seguranca')
  assert.ok(problema, 'sem rede de segurança, aviso perdido vira cliente que pagou e ficou sem robô')
  assert.equal(problema.severity, BILLING_SEVERITY.CRITICO)
  assert.equal(relatorio.ok, false)
})

test('chave de teste só acusa em PRODUÇÃO — em staging é o estado certo', () => {
  const prod = checkBillingConfig({ env: { MP_ACCESS_TOKEN: 'TEST-1', MP_WEBHOOK_SECRET: 's' }, isProduction: true, isSandboxToken: true })
  assert.ok(prod.problems.some(p => p.code === 'chave_de_teste'))

  const staging = checkBillingConfig({ env: { MP_ACCESS_TOKEN: 'TEST-1' }, isProduction: false, isSandboxToken: true })
  assert.ok(!staging.problems.some(p => p.code === 'chave_de_teste'), 'acusar isso em staging é alarme falso diário')
  assert.ok(!staging.problems.some(p => p.code === 'sem_assinatura_webhook'))
})

test('config completa em produção não gera problema nenhum', () => {
  const relatorio = checkBillingConfig({
    env: { MP_ACCESS_TOKEN: 'APP_USR-1', MP_WEBHOOK_SECRET: 'abc', BILLING_WEBHOOK_AUTOPROCESS: 'true' },
    isProduction: true,
    isSandboxToken: false,
  })
  assert.equal(relatorio.ok, true)
  assert.equal(relatorio.severity, BILLING_SEVERITY.OK)
})

test('silêncio de cobrança só alarma quando existe assinatura ativa', () => {
  const now = new Date('2026-09-08T12:00:00Z')
  const antiga = new Date('2026-09-01T12:00:00Z')

  const comAssinatura = assessBillingMachine({ activeSubscriptions: 4, lastChargeAt: antiga, lastReconciliationAt: now, now })
  assert.ok(comAssinatura.problems.some(p => p.code === 'silencio_de_cobranca'))

  const semAssinatura = assessBillingMachine({ activeSubscriptions: 0, lastChargeAt: antiga, lastReconciliationAt: now, now })
  assert.ok(!semAssinatura.problems.some(p => p.code === 'silencio_de_cobranca'), 'sem assinatura, silêncio é o normal')
})

test('sem medição NÃO vira alarme — vira "sem medição"', () => {
  const estado = assessBillingMachine({ activeSubscriptions: null, lastChargeAt: null, lastReconciliationAt: null })
  assert.equal(estado.severity, BILLING_SEVERITY.SEM_MEDICAO)
  assert.equal(estado.problems.length, 0)
  assert.match(describeBillingMachine(estado), /sem medição/i)
})

test('conferência com o Mercado Pago parada é crítico', () => {
  const now = new Date('2026-09-08T12:00:00Z')
  const estado = assessBillingMachine({ lastReconciliationAt: new Date('2026-09-08T04:00:00Z'), now })
  assert.ok(estado.problems.some(p => p.code === 'rede_de_seguranca_parada'))
  assert.equal(estado.severity, BILLING_SEVERITY.CRITICO)
})

test('recusa em série acusa causa NOSSA, não cartão de cada cliente', () => {
  const now = new Date('2026-09-08T12:00:00Z')
  const estado = assessBillingMachine({ recentRejected: 8, recentApproved: 2, lastReconciliationAt: now, now })
  const problema = estado.problems.find(p => p.code === 'recusa_em_serie')
  assert.ok(problema)
  assert.match(problema.detail, /causa costuma ser nossa/i)

  // amostra pequena não conclui nada
  const pouco = assessBillingMachine({ recentRejected: 2, recentApproved: 1, lastReconciliationAt: now, now })
  assert.ok(!pouco.problems.some(p => p.code === 'recusa_em_serie'))
})

// ------------------------------------------------- avisar a cliente

test('só recusa RECENTE e ainda não resolvida vira aviso', () => {
  const now = new Date('2026-09-08T12:00:00Z')
  const charge = { status: 'rejected', attemptedAt: new Date('2026-09-08T09:00:00Z') }

  assert.equal(decideChargeFailureNotice({ charge, now }).notify, true)
  assert.equal(decideChargeFailureNotice({ charge: { ...charge, status: 'approved' }, now }).notify, false)

  // histórico antigo puxado do MP no primeiro deploy não pode virar e-mail
  const velha = decideChargeFailureNotice({ charge: { ...charge, attemptedAt: new Date('2026-08-20T09:00:00Z') }, now })
  assert.equal(velha.notify, false)
  assert.equal(velha.reason, 'recusa_antiga')

  // cobrou depois: resolveu sozinho
  const resolvida = decideChargeFailureNotice({ charge, laterApprovedChargeAt: new Date('2026-09-08T10:00:00Z'), now })
  assert.equal(resolvida.notify, false)
  assert.equal(resolvida.reason, 'ja_cobrou_depois')

  // já avisada há pouco
  const repetida = decideChargeFailureNotice({ charge, lastNoticeAt: new Date('2026-09-08T08:00:00Z'), now })
  assert.equal(repetida.notify, false)
})

test('o que pedir à cliente MUDA conforme de quem é a ação', () => {
  const nossa = describeChargeFailureForCustomer('cc_rejected_high_risk')
  assert.equal(nossa.pedirCartaoNovo, false, 'mandar trocar cartão quando o problema é nosso faz ela mexer no que está certo')
  assert.match(nossa.motivo, /não foi problema com o seu cartão/i)

  const dela = describeChargeFailureForCustomer('cc_rejected_insufficient_amount')
  assert.equal(dela.pedirCartaoNovo, true)
  assert.match(dela.oQueFazer, /avulso/i, 'o pagamento avulso é a saída imediata e precisa estar no texto')

  // nunca mandar assinar de novo — é o padrão que dispara a recusa por suspeita
  for (const detalhe of ['cc_rejected_high_risk', 'cc_rejected_insufficient_amount', null]) {
    const texto = describeChargeFailureForCustomer(detalhe)
    assert.doesNotMatch(`${texto.motivo} ${texto.oQueFazer}`, /assine de novo|assinar de novo/i)
  }
})

// ------------------------------------------------- avisar a administradora

test('o aviso interno tem endereço próprio e interruptor próprio', () => {
  assert.equal(resolveAdminAlertEmail({}), DEFAULT_ADMIN_ALERT_EMAIL)
  assert.equal(resolveAdminAlertEmail({ ADMIN_ALERT_EMAIL: 'outra@exemplo.com' }), 'outra@exemplo.com')
  assert.equal(adminAlertsEnabled({}), true)
  assert.equal(adminAlertsEnabled({ ADMIN_ALERT_ENABLED: 'false' }), false)
  assert.equal(adminAlertsEnabled({ ADMIN_ALERT_ENABLED: '0' }), true, 'só o valor exato false desliga — mesmo padrão dos outros interruptores')
})

test('rajada de falha não vira rajada de e-mail', () => {
  const now = new Date('2026-09-08T12:00:00Z')
  assert.equal(shouldSendAdminAlert({ lastSentAt: null, now }).send, true)
  assert.equal(shouldSendAdminAlert({ lastSentAt: new Date('2026-09-08T06:00:00Z'), now }).send, false)
  assert.equal(shouldSendAdminAlert({ lastSentAt: new Date('2026-09-06T06:00:00Z'), now }).send, true)
})

test('os três avisos internos existem, são internos e não são de marketing', () => {
  assert.ok(EMAIL_GROUPS.interno, 'o grupo precisa aparecer na aba E-mails para os textos serem editáveis')
  for (const slug of ['admin_cobranca_recusada', 'admin_cobranca_maquina_parada', 'admin_pagamento_com_falha']) {
    const definicao = getTemplateDefinition(slug)
    assert.ok(definicao, `${slug} precisa existir no catálogo`)
    assert.equal(definicao.audience, 'admin')
    assert.equal(definicao.group, 'interno')
    assert.equal(definicao.category, 'transactional', 'aviso de operação nunca respeita descadastro de marketing')
  }
})

test('o e-mail de cobrança recusada é da cliente, transacional, e não promete o que não pode', () => {
  const definicao = getTemplateDefinition('cobranca_recusada')
  assert.ok(definicao)
  assert.equal(definicao.category, 'transactional')
  assert.notEqual(definicao.audience, 'admin')
  assert.ok(definicao.dedupDays >= 1, 'não pode sair todo dia')
  assert.match(definicao.body, /continua trabalhando/i, 'a cliente precisa saber que o robô não parou')
  assert.doesNotMatch(definicao.body, /assine de novo/i)
  // linguagem leiga obrigatória nesta superfície
  assert.doesNotMatch(definicao.body, /preapproval|gateway|webhook|status_detail/i)
})

// ------------------------------------------------- guardas estruturais

const paymentsSource = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')

test('a rede de segurança NÃO depende da env do processamento de aviso', () => {
  assert.ok(paymentsSource.includes('function startBillingReconciliation'), 'a passada precisa ter função própria')
  assert.ok(paymentsSource.includes('startBillingReconciliation(app)'), 'e precisa ser chamada direto no boot das rotas')
  const processador = paymentsSource.slice(
    paymentsSource.indexOf('function startWebhookProcessor'),
    paymentsSource.indexOf('function startBillingReconciliation')
  )
  assert.ok(
    !processador.includes('PAYMENT_RECONCILIATION_ENABLED'),
    'voltar a aninhar a reconciliação dentro do processador desliga a rede de segurança em silêncio'
  )
})

test('o boot confere a configuração da cobrança e avisa a administradora', () => {
  assert.ok(paymentsSource.includes('checkBillingConfigAtBoot'))
  assert.ok(paymentsSource.includes("slug: 'admin_cobranca_maquina_parada'"))
  assert.ok(paymentsSource.includes("'ops_billing_config_problem'"))
})

test('cobrança recusada avisa cliente E administradora, pelos dois caminhos', () => {
  assert.ok(paymentsSource.includes('reagirACobrancaRecusada'))
  assert.ok(paymentsSource.includes('notifyChargeFailed'))
  assert.ok(paymentsSource.includes("slug: 'admin_cobranca_recusada'"))
  const reconc = paymentsSource.slice(paymentsSource.indexOf('async function runSubscriptionReconciliation'))
  assert.ok(
    reconc.includes('reagirACobrancaRecusada'),
    'a recusa pode chegar SÓ pela passada horária — o Mercado Pago nem sempre avisa'
  )
})

test('pagamento aprovado que não virou acesso vira e-mail para a administradora', () => {
  assert.ok(
    paymentsSource.includes("slug: 'admin_pagamento_com_falha'"),
    'cliente que pagou e ficou sem robô é o pior desfecho do produto — não pode morrer no log'
  )
})

test('a tela da cliente mostra a cobrança recusada antes dos planos', () => {
  const planoSource = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')
  assert.ok(planoSource.includes('overview.chargeFailure'))
  assert.ok(paymentsSource.includes('chargeFailure'), 'quem decide o texto é o backend')
})

test('aviso interno não pode ser disparado para a base de clientes', () => {
  const adminEmailsSource = readFileSync(new URL('../src/api/routes/adminEmails.js', import.meta.url), 'utf8')
  assert.ok(adminEmailsSource.includes("definition.audience === 'admin'"))
})

test('o aviso interno não passa pelo despachante da cliente', () => {
  const alertsSource = readFileSync(new URL('../src/email/adminAlerts.js', import.meta.url), 'utf8')
  assert.ok(alertsSource.includes("definition.audience !== 'admin'"), 'guarda para não vazar e-mail de cliente por este caminho')
  assert.ok(alertsSource.includes('sem_smtp'), 'sem SMTP a janela de cooldown não pode queimar sem ninguém receber')
})

test('o alarme da máquina aparece na aba Financeiro', () => {
  const adminPageSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  assert.ok(adminPageSource.includes('data.health.headline'))
  assert.ok(adminPageSource.includes('problema.fix'), 'a tela precisa dizer o que fazer, não só que está ruim')
})
