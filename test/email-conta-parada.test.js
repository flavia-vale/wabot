// Aviso operacional só para quem está usando o robô.
//
// O caso que motivou: conta com plano vencido, WhatsApp fora e nenhuma oferta
// há semanas recebeu "a Shopee parou de aceitar sua chave". Puro + banco
// fingido, sem rede e sem SMTP.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAccountInUse,
  wasStoppedByUser,
  isOperationalEmail,
  countsTowardWeeklyCap,
  resolveOperationalIdleDays,
  resolveAutoEmailWeeklyCap,
  loadAccountActivity,
  MANUAL_STOP_EVENT,
} from '../src/email/accountActivity.js'
import { sendTemplateEmail } from '../src/email/dispatcher.js'
import { decideLifecycleEmail } from '../src/emailTriggers/lifecyclePolicy.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-08-20T12:00:00Z')

function conta(extra = {}) {
  return {
    accessExpiresAt: new Date(NOW.getTime() + 30 * DAY),
    createdAt: new Date(NOW.getTime() - 200 * DAY),
    waConnected: true,
    waEverConnected: true,
    lastSuccessAt: new Date(NOW.getTime() - DAY),
    ...extra,
  }
}

// ------------------------------------------------------------------ regra pura

test('conta com plano vencido não está em uso, mesmo conectada', () => {
  const vencida = conta({ accessExpiresAt: new Date(NOW.getTime() - DAY) })
  assert.equal(isAccountInUse(vencida, NOW), false)
  assert.equal(isAccountInUse(conta({ accessExpiresAt: null }), NOW), false)
})

test('WhatsApp conectado basta para estar em uso', () => {
  assert.equal(isAccountInUse(conta({ lastSuccessAt: null }), NOW), true)
})

test('desconectada, vale o último envio dentro da janela de 7 dias', () => {
  const base = { waConnected: false, createdAt: new Date(NOW.getTime() - 200 * DAY) }
  assert.equal(isAccountInUse(conta({ ...base, lastSuccessAt: new Date(NOW.getTime() - 3 * DAY) }), NOW), true)
  assert.equal(isAccountInUse(conta({ ...base, lastSuccessAt: new Date(NOW.getTime() - 20 * DAY) }), NOW), false)
  assert.equal(isAccountInUse(conta({ ...base, lastSuccessAt: null }), NOW), false)
})

test('conta nova que já conectou continua em uso mesmo sem ter enviado nada', () => {
  const nova = conta({ waConnected: false, lastSuccessAt: null, createdAt: new Date(NOW.getTime() - 3 * DAY) })
  assert.equal(isAccountInUse(nova, NOW), true, 'quem acabou de montar é quem mais precisa do aviso')

  const novaSemNuncaConectar = conta({
    waConnected: false, waEverConnected: false, lastSuccessAt: null, createdAt: new Date(NOW.getTime() - 3 * DAY),
  })
  assert.equal(isAccountInUse(novaSemNuncaConectar, NOW), false)
})

test('a janela de dias parada é configurável', () => {
  assert.equal(resolveOperationalIdleDays({}), 7)
  assert.equal(resolveOperationalIdleDays({ EMAIL_OPERATIONAL_IDLE_DAYS: '30' }), 30)
  assert.equal(resolveOperationalIdleDays({ EMAIL_OPERATIONAL_IDLE_DAYS: 'zero' }), 7)

  const parada = conta({ waConnected: false, lastSuccessAt: new Date(NOW.getTime() - 20 * DAY) })
  assert.equal(isAccountInUse(parada, NOW, { idleDays: 30 }), true)
})

// ------------------------------------------------------------ desconexão pedida

test('desconexão pedida pelo painel não é problema; queda depois de reconectar é', () => {
  assert.equal(wasStoppedByUser({ stoppedByUserAt: new Date(NOW.getTime() - DAY), lastConnectedAt: null }), true)
  assert.equal(wasStoppedByUser({
    stoppedByUserAt: new Date(NOW.getTime() - 5 * DAY),
    lastConnectedAt: new Date(NOW.getTime() - 2 * DAY),
  }), false, 'reconectou depois do pedido: queda nova é queda de verdade')
  assert.equal(wasStoppedByUser({}), false)
  assert.equal(wasStoppedByUser(null), false)
})

test('quem mandou desconectar não recebe "seu robô está fora do ar"', () => {
  const caido = {
    id: 'u1',
    status: 'active',
    plan: 'pro',
    createdAt: new Date(NOW.getTime() - 200 * DAY),
    accessExpiresAt: new Date(NOW.getTime() + 30 * DAY),
    waEverConnected: true,
    waConnected: false,
    waDisconnectedSince: new Date(NOW.getTime() - 2 * DAY),
    hasMonitorGroup: true,
    hasPostGroup: true,
    lastSuccessAt: new Date(NOW.getTime() - 2 * DAY),
    isAffiliate: false,
    affiliateAvailableCents: 0,
  }
  assert.equal(decideLifecycleEmail(caido, NOW)?.slug, 'whatsapp_desconectado')

  const pedido = { ...caido, stoppedByUserAt: new Date(NOW.getTime() - 2 * DAY), lastConnectedAt: null }
  assert.notEqual(decideLifecycleEmail(pedido, NOW)?.slug, 'whatsapp_desconectado')
})

// ------------------------------------------------------ classificação por grupo

test('só o grupo de saúde depende da conta estar em uso', () => {
  assert.equal(isOperationalEmail(getTemplateDefinition('chave_shopee_recusada')), true)
  assert.equal(isOperationalEmail(getTemplateDefinition('codigo_acesso_venceu')), true)
  assert.equal(isOperationalEmail(getTemplateDefinition('plano_venceu')), false, 'cobrança sempre vai')
  assert.equal(isOperationalEmail(getTemplateDefinition('saque_disponivel')), false, 'dinheiro dela sempre vai')
})

test('teto semanal conta saúde e divulgação, nunca cobrança', () => {
  assert.equal(countsTowardWeeklyCap(getTemplateDefinition('robo_parado')), true)
  assert.equal(countsTowardWeeklyCap(getTemplateDefinition('resumo_semanal')), true)
  assert.equal(countsTowardWeeklyCap(getTemplateDefinition('plano_vence_em_3_dias')), false)
  assert.equal(resolveAutoEmailWeeklyCap({}), 2)
  assert.equal(resolveAutoEmailWeeklyCap({ EMAIL_AUTO_WEEKLY_CAP: '0' }), 0, 'zero desliga o teto')
})

// ------------------------------------------------------------------ despachante

function fakeDb({ session = null, ultimoEnvio = null, expiresAt = new Date(NOW.getTime() + 30 * DAY), autoNaSemana = 0 } = {}) {
  return {
    emailTemplate: { findUnique: async () => null },
    emailOptOut: { findUnique: async () => null },
    analyticsEvent: { count: async () => 0 },
    user: { findUnique: async () => ({ accessExpiresAt: expiresAt, createdAt: new Date(NOW.getTime() - 200 * DAY) }) },
    waSession: { findUnique: async () => session },
    messageLog: { findFirst: async () => (ultimoEnvio ? { sentAt: ultimoEnvio } : null) },
    emailSendLog: {
      count: async ({ where }) => (where?.mode === 'auto' ? autoNaSemana : 0),
      create: async () => ({ id: 'log1' }),
      update: async () => ({}),
    },
  }
}

const usuaria = { id: 'u1', email: 'cliente@exemplo.com', name: 'Juliane', status: 'active' }

async function enviar(db, extra = {}) {
  const enviados = []
  const result = await sendTemplateEmail({
    db,
    sendMail: async (msg) => {
      enviados.push(msg)
      return { messageId: 'x' }
    },
    slug: 'chave_shopee_recusada',
    user: usuaria,
    mode: 'auto',
    now: NOW,
    secret: 'segredo',
    logger: { info() {}, warn() {}, error() {} },
    ...extra,
  })
  return { result, enviados }
}

test('conta parada não recebe o aviso da Shopee', async () => {
  const db = fakeDb({
    session: { status: 'disconnected' },
    ultimoEnvio: new Date(NOW.getTime() - 40 * DAY),
    expiresAt: new Date(NOW.getTime() - 10 * DAY),
  })
  const { result, enviados } = await enviar(db)
  assert.equal(result.sent, false)
  assert.equal(result.reason, 'account_idle')
  assert.equal(enviados.length, 0)
})

test('conta em uso recebe o aviso da Shopee normalmente', async () => {
  const db = fakeDb({ session: { status: 'connected', phone: '55' } })
  const { result, enviados } = await enviar(db)
  assert.equal(result.sent, true)
  assert.equal(enviados.length, 1)
})

test('disparo manual da admin não é barrado pela conta parada', async () => {
  const db = fakeDb({
    session: { status: 'disconnected' },
    expiresAt: new Date(NOW.getTime() - 10 * DAY),
  })
  const { result } = await enviar(db, { mode: 'manual' })
  assert.equal(result.sent, true, 'quem manda na mão decide sozinha')
})

test('banco fora do ar não silencia aviso legítimo', async () => {
  const db = fakeDb({ session: { status: 'disconnected' }, expiresAt: new Date(NOW.getTime() - 10 * DAY) })
  db.waSession.findUnique = async () => { throw new Error('sem banco') }
  db.user.findUnique = async () => { throw new Error('sem banco') }
  const { result } = await enviar(db)
  assert.equal(result.sent, true, 'foto incompleta manda o aviso em vez de engolir')
})

test('teto semanal barra o terceiro e-mail automático', async () => {
  const emUso = { session: { status: 'connected', phone: '55' } }
  const { result: segundo } = await enviar(fakeDb({ ...emUso, autoNaSemana: 1 }))
  assert.equal(segundo.sent, true)

  const { result: terceiro } = await enviar(fakeDb({ ...emUso, autoNaSemana: 2 }))
  assert.equal(terceiro.sent, false)
  assert.equal(terceiro.reason, 'weekly_cap')
})

test('cobrança não é barrada pelo teto semanal', async () => {
  const db = fakeDb({ session: { status: 'connected', phone: '55' }, autoNaSemana: 9 })
  const { result } = await enviar(db, { slug: 'plano_vence_em_3_dias', vars: { data_vencimento: '23/08/2026', dias_restantes: '3' } })
  assert.equal(result.sent, true)
})

// ------------------------------------------------------------------ carregador

test('a foto de atividade marca quando uma consulta caiu', async () => {
  const db = fakeDb({ session: { status: 'connected' } })
  const ok = await loadAccountActivity({ db, userId: 'u1' })
  assert.equal(ok.incompleta, false)
  assert.equal(ok.waConnected, true)

  db.messageLog.findFirst = async () => { throw new Error('sem banco') }
  const ruim = await loadAccountActivity({ db, userId: 'u1' })
  assert.equal(ruim.incompleta, true)
})

test('o evento de desconexão pedida tem nome estável', () => {
  assert.equal(MANUAL_STOP_EVENT, 'manual_stop_requested')
})
