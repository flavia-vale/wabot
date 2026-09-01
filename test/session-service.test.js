import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyBotStartOutcome, createSessionService, normalizePairingPhone } from '../src/domain/session/service.js'

test('normalizePairingPhone normalizes BR numbers', () => {
  assert.deepEqual(normalizePairingPhone('(11) 98888-7777'), { ok: true, phone: '5511988887777' })
  assert.equal(normalizePairingPhone('').ok, false)
})

test('findSessionStartUser fallback works on prisma shape mismatch', async () => {
  let fallbackUsed = false
  const db = {
    user: {
      findUnique: async ({ select }) => {
        if (select.status) throw new Error('Unknown field `status`')
        fallbackUsed = true
        return { plan: 'trial', accessExpiresAt: null }
      },
    },
  }
  const service = createSessionService({ db })
  const user = await service.findSessionStartUser('u1')
  assert.equal(fallbackUsed, true)
  assert.equal(user.plan, 'trial')
})

test('validateSessionStartUser enforces blocked/expired rules', () => {
  const service = createSessionService({ db: { user: { findUnique: async () => null } } })
  const blocked = service.validateSessionStartUser({ status: 'banned' })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.statusCode, 403)

  const expired = service.validateSessionStartUser({ plan: 'trial', accessExpiresAt: new Date('2020-01-01T00:00:00Z') })
  assert.equal(expired.ok, false)

  const ok = service.validateSessionStartUser({ plan: 'pro', accessExpiresAt: new Date(Date.now() + 100000) })
  assert.equal(ok.ok, true)
})

test('classifyBotStartOutcome separa recusa por capacidade de robô que não subiu', () => {
  // Recusa explícita do supervisor (teto de sessões cheio / fora do shard).
  const refused = classifyBotStartOutcome({ startAccepted: false, running: false })
  assert.equal(refused.ok, false)
  assert.equal(refused.statusCode, 503)
  assert.equal(refused.code, 'WA_CAPACITY_LIMIT')
  assert.equal(refused.retryable, true)

  // Mandou ligar, aceitou, mas não subiu a tempo — outra causa, outro texto.
  const notUp = classifyBotStartOutcome({ startAccepted: true, running: false })
  assert.equal(notUp.code, 'WA_START_FAILED')

  // startBot devolve false quando o robô JÁ estava ligado (caminho inline):
  // isso não é erro nenhum.
  assert.deepEqual(classifyBotStartOutcome({ startAccepted: false, running: true }), { ok: true })
  assert.deepEqual(classifyBotStartOutcome({ startAccepted: true, running: true }), { ok: true })
})

test('mensagem de limite de capacidade não usa jargão técnico na tela', () => {
  // Regra de linguagem leiga: o texto vai direto para a cliente.
  const { error } = classifyBotStartOutcome({ startAccepted: false, running: false })
  const notUp = classifyBotStartOutcome({ startAccepted: true, running: false })
  for (const texto of [error, notUp.error]) {
    for (const jargao of ['worker', 'supervisor', 'circuit', 'shard', 'fork', 'socket', 'Bot não está conectado']) {
      assert.ok(!texto.toLowerCase().includes(jargao.toLowerCase()), `jargão "${jargao}" chegou à tela: ${texto}`)
    }
  }
})
