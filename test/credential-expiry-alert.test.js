// Aviso de código de acesso vencido: decisão pura + passada com db/sondagem/
// envio fingidos. Nenhum teste toca banco, rede ou SMTP.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAlertableUser,
  isConfirmedExpired,
  isRealEmail,
  isWithinCooldown,
  platformsDueForProbe,
  resolveAlertCooldownMs,
} from '../src/credentialExpiry/policy.js'
import { runCredentialExpirySweep, lastAlertByPlatform } from '../src/credentialExpiry/sweep.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-08-16T12:00:00Z')

// ---------------------------------------------------------------- policy pura

test('só e-mail real recebe aviso (fallback user_*@sistema.com nunca)', () => {
  assert.equal(isRealEmail('julianepumuceno16@gmail.com'), true)
  assert.equal(isRealEmail('user_ab12cd@sistema.com'), false)
  assert.equal(isRealEmail(''), false)
  assert.equal(isRealEmail('sem-arroba'), false)
})

test('conta banida ou suspensa não recebe aviso', () => {
  assert.equal(isAlertableUser({ email: 'a@b.com', status: 'active' }), true)
  assert.equal(isAlertableUser({ email: 'a@b.com', status: 'banned' }), false)
  assert.equal(isAlertableUser({ email: 'a@b.com', status: 'suspended' }), false)
  assert.equal(isAlertableUser({ email: 'user_x@sistema.com', status: 'active' }), false)
})

test('alive:null (indeterminado) NUNCA conta como vencido', () => {
  assert.equal(isConfirmedExpired({ configured: true, alive: false, reason: 'expired' }), true)
  assert.equal(isConfirmedExpired({ configured: true, alive: null, reason: 'network_error' }), false)
  assert.equal(isConfirmedExpired({ configured: true, alive: null, reason: 'forbidden' }), false)
  assert.equal(isConfirmedExpired({ configured: true, alive: null, reason: 'rate_limited' }), false)
  assert.equal(isConfirmedExpired({ configured: true, alive: true, reason: 'ok' }), false)
  assert.equal(isConfirmedExpired(null), false)
})

test('janela de silêncio: default 7 dias, configurável por env', () => {
  assert.equal(resolveAlertCooldownMs({}), 7 * DAY)
  assert.equal(resolveAlertCooldownMs({ CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS: '3' }), 3 * DAY)
  assert.equal(resolveAlertCooldownMs({ CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS: 'abacaxi' }), 7 * DAY)
})

test('isWithinCooldown respeita a janela e tolera data ausente/inválida', () => {
  const cooldownMs = 7 * DAY
  assert.equal(isWithinCooldown({ lastAlertAt: new Date(NOW.getTime() - DAY), now: NOW, cooldownMs }), true)
  assert.equal(isWithinCooldown({ lastAlertAt: new Date(NOW.getTime() - 8 * DAY), now: NOW, cooldownMs }), false)
  assert.equal(isWithinCooldown({ lastAlertAt: null, now: NOW, cooldownMs }), false)
  assert.equal(isWithinCooldown({ lastAlertAt: 'xx', now: NOW, cooldownMs }), false)
})

test('loja em janela de silêncio nem chega a ser sondada', () => {
  const due = platformsDueForProbe({
    platforms: ['mercadolivre', 'amazon', 'shopee'],
    lastAlertByPlatform: { mercadolivre: new Date(NOW.getTime() - 2 * DAY) },
    now: NOW,
    cooldownMs: 7 * DAY,
  })
  assert.deepEqual(due, ['amazon'])
})

// -------------------------------------------------------------- passada (sweep)

function makeDb({ credentials = [], events = [] } = {}) {
  const created = []
  const updates = []
  return {
    created,
    updates,
    credential: {
      findMany: async () => credentials,
      update: async (args) => { updates.push(args); return {} },
    },
    analyticsEvent: {
      findMany: async ({ where }) => events.filter((e) => e.userId === where.userId && e.event === where.event
        && (!where.createdAt?.gte || new Date(e.createdAt) >= new Date(where.createdAt.gte))),
      create: async ({ data }) => { created.push(data); return data },
    },
  }
}

function credentialRow({ userId = 'u1', platform = 'mercadolivre', email = 'cliente@exemplo.com', status = 'active', data } = {}) {
  const payload = data ?? (platform === 'mercadolivre'
    ? { tag: 'minha-etiqueta', ssid: 'x'.repeat(40) }
    : { tag: 'fafaciane-20', cookie: 'y'.repeat(60) })
  return {
    userId,
    platform,
    data: JSON.stringify(payload),
    user: { id: userId, name: 'Juliane', email, status },
  }
}

function collectMails() {
  const sent = []
  return { sent, sendMail: async (msg) => { sent.push(msg); return { skipped: false, messageId: 'id' } } }
}

const silentLogger = { info() {}, warn() {}, error() {} }

test('código vencido confirmado dispara um e-mail e grava o aviso', async () => {
  const db = makeDb({ credentials: [credentialRow({})] })
  const { sent, sendMail } = collectMails()
  const summary = await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => ({ configured: true, alive: false, reason: 'expired' }) },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(summary.sent, 1)
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /Mercado Livre/)
  assert.equal(db.created.length, 1)
  assert.equal(db.created[0].event, 'credential_expiry_alert_sent')
  assert.equal(JSON.parse(db.created[0].metadata).platform, 'mercadolivre')
})

test('anti-spam: cliente avisado há 2 dias não recebe de novo (nem é sondado)', async () => {
  let probes = 0
  const db = makeDb({
    credentials: [credentialRow({})],
    events: [{
      userId: 'u1',
      event: 'credential_expiry_alert_sent',
      metadata: JSON.stringify({ platform: 'mercadolivre' }),
      createdAt: new Date(NOW.getTime() - 2 * DAY),
    }],
  })
  const { sent, sendMail } = collectMails()
  const summary = await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => { probes += 1; return { configured: true, alive: false } } },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(sent.length, 0)
  assert.equal(probes, 0, 'não deve nem sondar a loja em janela de silêncio')
  assert.equal(summary.sent, 0)
})

test('anti-spam: passada a janela de silêncio, o aviso volta', async () => {
  const db = makeDb({
    credentials: [credentialRow({})],
    events: [{
      userId: 'u1',
      event: 'credential_expiry_alert_sent',
      metadata: JSON.stringify({ platform: 'mercadolivre' }),
      createdAt: new Date(NOW.getTime() - 9 * DAY),
    }],
  })
  const { sent, sendMail } = collectMails()
  await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => ({ configured: true, alive: false }) },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(sent.length, 1)
})

test('alive:null não dispara e-mail nem queima a janela de silêncio', async () => {
  const db = makeDb({ credentials: [credentialRow({})] })
  const { sent, sendMail } = collectMails()
  const summary = await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => ({ configured: true, alive: null, reason: 'rate_limited' }) },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(sent.length, 0)
  assert.equal(summary.expired, 0)
  assert.equal(db.created.length, 0)
})

test('sondagem que explode vira indeterminado (não vira aviso)', async () => {
  const db = makeDb({ credentials: [credentialRow({})] })
  const { sent, sendMail } = collectMails()
  const summary = await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => { throw new Error('ECONNRESET') } },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(sent.length, 0)
  assert.equal(summary.failed, 0, 'erro de rede na loja não é falha do cliente')
})

test('e-mail fabricado (user_*@sistema.com) não recebe nem é sondado', async () => {
  let probes = 0
  const db = makeDb({ credentials: [credentialRow({ email: 'user_ab12cd@sistema.com' })] })
  const { sent, sendMail } = collectMails()
  await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => { probes += 1; return { configured: true, alive: false } } },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(sent.length, 0)
  assert.equal(probes, 0)
})

test('as duas lojas vencidas do mesmo cliente viram UM envio (com 2 registros de aviso)', async () => {
  const db = makeDb({
    credentials: [
      credentialRow({ platform: 'mercadolivre' }),
      credentialRow({ platform: 'amazon' }),
    ],
  })
  const { sent, sendMail } = collectMails()
  const summary = await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: {
      mercadolivre: async () => ({ configured: true, alive: false }),
      amazon: async () => ({ configured: true, alive: false }),
    },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(sent.length, 1)
  assert.equal(summary.expired, 2)
  assert.match(sent[0].text, /Mercado Livre/)
  assert.match(sent[0].text, /Amazon/)
  assert.equal(db.created.length, 2)
})

test('sem SMTP (envio no-op) o aviso NÃO é gravado — a janela de silêncio não queima', async () => {
  const db = makeDb({ credentials: [credentialRow({})] })
  const summary = await runCredentialExpirySweep({
    db,
    sendMail: async () => ({ skipped: true }),
    checkers: { mercadolivre: async () => ({ configured: true, alive: false }) },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(summary.sent, 0)
  assert.equal(db.created.length, 0)
})

test('rotação do código devolvida pela loja é persistida (não morre por causa da nossa checagem)', async () => {
  const db = makeDb({ credentials: [credentialRow({})] })
  const { sendMail } = collectMails()
  await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => ({ configured: true, alive: true, credentialPatch: { ssid: 'novo' } }) },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(db.updates.length, 1)
  assert.deepEqual(db.updates[0].where, { userId_platform: { userId: 'u1', platform: 'mercadolivre' } })
})

test('falha isolada num cliente não aborta os demais', async () => {
  const db = makeDb({
    credentials: [
      credentialRow({ userId: 'u1', email: 'a@exemplo.com' }),
      credentialRow({ userId: 'u2', email: 'b@exemplo.com' }),
    ],
  })
  db.analyticsEvent.findMany = async ({ where }) => {
    if (where.userId === 'u1') throw new Error('SQLITE_BUSY')
    return []
  }
  const { sent, sendMail } = collectMails()
  const summary = await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => ({ configured: true, alive: false }) },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(summary.failed, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'b@exemplo.com')
})

test('credencial incompleta não vira aviso de vencimento (é outro problema)', async () => {
  let probes = 0
  const db = makeDb({ credentials: [credentialRow({ data: { tag: '' } })] })
  const { sent, sendMail } = collectMails()
  await runCredentialExpirySweep({
    db,
    sendMail,
    checkers: { mercadolivre: async () => { probes += 1; return { configured: true, alive: false } } },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(probes, 0)
  assert.equal(sent.length, 0)
})

test('lastAlertByPlatform devolve a data mais recente por loja e ignora metadata quebrada', async () => {
  const db = makeDb({
    events: [
      { userId: 'u1', event: 'credential_expiry_alert_sent', metadata: '{"platform":"amazon"}', createdAt: new Date(NOW.getTime() - 5 * DAY) },
      { userId: 'u1', event: 'credential_expiry_alert_sent', metadata: '{"platform":"amazon"}', createdAt: new Date(NOW.getTime() - DAY) },
      { userId: 'u1', event: 'credential_expiry_alert_sent', metadata: '{quebrado', createdAt: NOW },
    ],
  })
  const result = await lastAlertByPlatform({ db, userId: 'u1' })
  assert.equal(result.amazon.getTime(), NOW.getTime() - DAY)
  assert.equal(Object.keys(result).length, 1)
})
