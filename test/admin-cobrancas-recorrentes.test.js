import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CHARGE_ACTION_OWNERS,
  classifyChargeOutcome,
  describeChargeStatus,
  describeChargeStatusDetail,
  presentSubscriptionCharge,
  summarizeSubscriptionCharges,
} from '../src/domain/payments/chargeOutcome.js'

/*
 * Sub-aba "Cobranças recorrentes" do Financeiro (2026-09-07).
 *
 * O que ela existe para responder: quando cada cobrança da assinatura foi
 * TENTADA e o que o banco/Mercado Pago devolveu. Antes disso, cobrança
 * recusada não virava registro nenhum — o webhook de `payment` só tratava
 * aprovado e estornado, e o `status_detail` era jogado fora.
 */

test('o código cru do Mercado Pago nunca some — é o que abre caso com eles', () => {
  const recusa = describeChargeStatusDetail('cc_rejected_high_risk')
  assert.equal(recusa.code, 'cc_rejected_high_risk')
  assert.equal(recusa.known, true)
  assert.equal(recusa.owner, CHARGE_ACTION_OWNERS.NOSSA)

  // Código que ainda não mapeamos não pode virar tela vazia nem mentira.
  const novo = describeChargeStatusDetail('cc_rejected_motivo_que_nao_existe')
  assert.equal(novo.known, false)
  assert.match(novo.label, /cc_rejected_motivo_que_nao_existe/)
  assert.match(novo.label, /fora da nossa lista/i)

  const semNada = describeChargeStatusDetail(null)
  assert.equal(semNada.code, null)
  assert.match(semNada.label, /não informou/i)
})

test('cada recusa diz DE QUEM é a ação — o código sozinho manda fazer coisas opostas', () => {
  assert.equal(describeChargeStatusDetail('cc_rejected_insufficient_amount').owner, CHARGE_ACTION_OWNERS.CLIENTE)
  assert.equal(describeChargeStatusDetail('cc_rejected_duplicated_payment').owner, CHARGE_ACTION_OWNERS.NOSSA)
  assert.equal(describeChargeStatusDetail('cc_rejected_blacklist').owner, CHARGE_ACTION_OWNERS.MERCADO_PAGO)
  assert.equal(describeChargeStatusDetail('pending_contingency').owner, CHARGE_ACTION_OWNERS.ESPERAR)
})

test('resultado da tentativa cai em baldes que correspondem a ações', () => {
  for (const status of ['approved', 'accredited', 'processed']) assert.equal(classifyChargeOutcome(status), 'aprovada')
  for (const status of ['rejected', 'cancelled', 'expired']) assert.equal(classifyChargeOutcome(status), 'recusada')
  for (const status of ['refunded', 'charged_back']) assert.equal(classifyChargeOutcome(status), 'devolvida')
  assert.equal(classifyChargeOutcome('pending'), 'pendente')
  assert.equal(classifyChargeOutcome(null), 'desconhecida')
  assert.equal(describeChargeStatus('rejected'), 'Recusada')
})

test('resumo do período conta o que muda decisão, não o que é bonito', () => {
  const resumo = summarizeSubscriptionCharges([
    { mpSubscriptionId: 'a', status: 'approved', amount: 69, attemptedAt: '2026-09-01T10:00:00Z' },
    { mpSubscriptionId: 'a', status: 'rejected', statusDetail: 'cc_rejected_insufficient_amount', amount: 69, attemptedAt: '2026-09-05T10:00:00Z' },
    { mpSubscriptionId: 'b', status: 'approved', amount: 39, attemptedAt: '2026-09-03T10:00:00Z' },
    { mpSubscriptionId: 'c', status: 'rejected', statusDetail: 'cc_rejected_insufficient_amount', amount: 39, attemptedAt: '2026-09-04T10:00:00Z' },
    { mpSubscriptionId: 'd', status: 'pending', amount: 39, attemptedAt: '2026-09-06T10:00:00Z' },
  ])

  assert.equal(resumo.tentativas, 5)
  assert.equal(resumo.aprovadas, 2)
  assert.equal(resumo.recusadas, 2)
  assert.equal(resumo.pendentes, 1)
  assert.equal(resumo.valorAprovado, 108)
  assert.equal(resumo.valorRecusado, 108)
  // taxa é sobre as DECIDIDAS: pendente ainda pode virar qualquer coisa.
  assert.equal(resumo.taxaSucesso, 50)
  // "a" cobrou antes e a ÚLTIMA tentativa foi recusada; "c" idem. "b" está bem.
  assert.equal(resumo.clientesEmRisco, 2)
  assert.equal(resumo.assinaturasCobradas, 2)
  assert.equal(resumo.motivos[0].code, 'cc_rejected_insufficient_amount')
  assert.equal(resumo.motivos[0].total, 2)
})

test('assinatura que voltou a cobrar depois de uma recusa NÃO conta como em risco', () => {
  const resumo = summarizeSubscriptionCharges([
    { mpSubscriptionId: 'a', status: 'rejected', statusDetail: 'cc_rejected_other_reason', amount: 69, attemptedAt: '2026-09-01T10:00:00Z' },
    { mpSubscriptionId: 'a', status: 'approved', amount: 69, attemptedAt: '2026-09-02T10:00:00Z' },
  ])
  assert.equal(resumo.clientesEmRisco, 0)
})

test('resumo vazio não quebra e não inventa taxa de sucesso', () => {
  const resumo = summarizeSubscriptionCharges([])
  assert.equal(resumo.tentativas, 0)
  assert.equal(resumo.taxaSucesso, null, 'sem cobrança decidida não existe taxa — 0% seria mentira')
  assert.deepEqual(resumo.motivos, [])
})

test('a linha da tela leva código E tradução, e o identificador do MP (é tela de admin)', () => {
  const linha = presentSubscriptionCharge({
    id: 'c1',
    userId: 'u1',
    plan: 'pro',
    amount: 69,
    status: 'rejected',
    statusDetail: 'cc_rejected_call_for_authorize',
    attemptedAt: new Date('2026-09-05T10:00:00Z'),
    retryAttempt: 2,
    mpSubscriptionId: 'preap-1',
    mpAuthorizedPaymentId: 'auth-1',
  }, { email: 'cliente@exemplo.com' })

  assert.equal(linha.outcome, 'recusada')
  assert.equal(linha.returnCode, 'cc_rejected_call_for_authorize')
  assert.match(linha.returnMessage, /banco/i)
  assert.equal(linha.actionOwner, CHARGE_ACTION_OWNERS.CLIENTE)
  assert.equal(linha.retryAttempt, 2)
  assert.equal(linha.mpAuthorizedPaymentId, 'auth-1', 'quem opera precisa do id para abrir caso no Mercado Pago')
})

const paymentsSource = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')

test('a tentativa é gravada mesmo quando a cobrança é RECUSADA', () => {
  assert.ok(paymentsSource.includes('recordSubscriptionCharge'), 'sem isso a recusa não vira registro nenhum')
  const trecho = paymentsSource.slice(paymentsSource.indexOf('shouldHandleSubscriptionAuthorizedPayment(summary)'))
  const posGravacao = trecho.indexOf('recordSubscriptionCharge')
  const posAprovado = trecho.indexOf("authorizedSnapshot.status === 'approved'")
  assert.ok(posGravacao > -1 && posGravacao < posAprovado, 'gravar a tentativa não pode ficar dentro do ramo de aprovado')
})

test('o histórico de cobranças é puxado do Mercado Pago na passada que já existia', () => {
  assert.ok(paymentsSource.includes('fetchMercadoPagoSubscriptionInvoices'), 'recusada pode não gerar aviso — sem consultar o MP fica buraco')
  assert.ok(paymentsSource.includes('authorized_payments/search'))
  const reconc = paymentsSource.slice(paymentsSource.indexOf('async function runSubscriptionReconciliation'))
  assert.ok(reconc.includes('fetchMercadoPagoSubscriptionInvoices'), 'sem processo novo: roda no mesmo tick da reconciliação')
  assert.ok(!paymentsSource.includes('setInterval(async () => {\n    const invoices'), 'nenhum timer novo')
})

test('o retorno do banco é lido da FATURA, não do preapproval', () => {
  const snapshot = paymentsSource.slice(paymentsSource.indexOf('async function fetchMercadoPagoAuthorizedPaymentSnapshot'))
  assert.ok(snapshot.includes('payment?.status_detail'), 'o preapproval não tem status_detail — o motivo mora na fatura')
})

const adminSource = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')

test('a rota exige permissão de financeiro, é auditada e não chama o Mercado Pago', () => {
  const rota = adminSource.slice(adminSource.indexOf("app.get('/finance/subscription-charges'"))
  const fim = rota.indexOf("app.get('/payments'")
  const corpo = rota.slice(0, fim > 0 ? fim : 6000)
  assert.ok(corpo.includes("requireAdmin(req, reply, 'billing:read')"))
  assert.ok(corpo.includes('admin.finance.subscription_charges.list'))
  assert.ok(!corpo.includes('api.mercadopago.com'), 'a tela não pode consultar o provedor a cada carregamento')
  assert.ok(corpo.includes('summarizeSubscriptionCharges'), 'o resumo é do backend — duas telas não podem discordar')
  assert.ok(corpo.includes('__sem_resultado__'), 'busca sem resultado precisa devolver vazio, nunca a lista inteira')
})

const adminPageSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')

test('a sub-aba existe dentro do Financeiro e mostra o que foi pedido', () => {
  assert.ok(adminPageSource.includes("financeTab"), 'o Financeiro precisa ter sub-abas')
  assert.ok(adminPageSource.includes('Cobranças recorrentes'))
  assert.ok(adminPageSource.includes('SubscriptionChargesPanel'))
  assert.ok(adminPageSource.includes('adminSubscriptionCharges'))
  for (const coluna of ['Tentativa em', 'Código do Mercado Pago', 'O que isso quer dizer', 'Nº da tentativa']) {
    assert.ok(adminPageSource.includes(coluna), `a tabela precisa da coluna "${coluna}"`)
  }
})

test('a tela não recalcula o motivo por conta própria', () => {
  const painel = adminPageSource.slice(adminPageSource.indexOf('function SubscriptionChargesPanel'))
  const fim = painel.indexOf('function BillingKindBadge')
  const corpo = painel.slice(0, fim > 0 ? fim : painel.length)
  assert.ok(!corpo.includes('cc_rejected_'), 'a tradução do código mora no backend, em um lugar só')
  assert.ok(corpo.includes('charge.returnMessage'))
})

test('a sub-aba só busca dados quando é aberta', () => {
  assert.ok(
    adminPageSource.includes("if (tab !== 'financeiro' || financeTab !== 'cobrancas') return"),
    'carregar isso no boot do admin custaria consulta para quem nem abriu a aba'
  )
})

const diagSource = readFileSync(new URL('../scripts/diag-assinatura-recusada.mjs', import.meta.url), 'utf8')

test('o diagnóstico usa a MESMA tradução da tela, não uma cópia própria', () => {
  assert.ok(diagSource.includes("from '../src/domain/payments/chargeOutcome.js'"))
  assert.ok(
    !diagSource.includes('cc_rejected_high_risk:'),
    'tabela duplicada faz script e tela discordarem sobre o motivo da recusa'
  )
})
