import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { multiNumberRoutes } from '../src/api/routes/multiNumber.js'
import {
  MULTI_NUMBER_WAITLIST_JOINED,
  MULTI_NUMBER_WAITLIST_LEFT,
  EXTRA_NUMBER_PRICE_CENTS,
  validateWaitlistInput,
  waitlistPlanStatus,
  currentWaitlistEntry,
  summarizeWaitlist,
  phaseOneDecision,
} from '../src/domain/multiNumber/waitlist.js'

test('validateWaitlistInput aceita só quantidade e motivo conhecidos', () => {
  assert.deepEqual(validateWaitlistInput({ extraNumbers: 2, reason: 'rodizio' }), { ok: true, value: { extraNumbers: 2, reason: 'rodizio' } })
  assert.equal(validateWaitlistInput({ extraNumbers: 0, reason: 'rodizio' }).ok, false)
  assert.equal(validateWaitlistInput({ extraNumbers: 9, reason: 'rodizio' }).ok, false)
  assert.equal(validateWaitlistInput({ extraNumbers: 1, reason: 'toString' }).ok, false)
  assert.equal(validateWaitlistInput({}).ok, false)
})

test('waitlistPlanStatus: PRO e Trial ativo não precisam subir; Basic e Trial vencido precisam', () => {
  const now = new Date('2026-09-30T12:00:00Z')
  const future = new Date('2026-10-30T12:00:00Z')
  const past = new Date('2026-09-01T12:00:00Z')
  assert.equal(waitlistPlanStatus({ plan: 'pro' }, now).requiresUpgrade, false)
  assert.equal(waitlistPlanStatus({ plan: 'trial', accessExpiresAt: future }, now).requiresUpgrade, false)
  assert.equal(waitlistPlanStatus({ plan: 'trial', accessExpiresAt: past }, now).requiresUpgrade, true)
  assert.equal(waitlistPlanStatus({ plan: 'basic' }, now).requiresUpgrade, true)
})

test('currentWaitlistEntry usa o evento mais recente, em qualquer ordem', () => {
  const joined = { event: MULTI_NUMBER_WAITLIST_JOINED, metadata: '{"extraNumbers":2,"reason":"continuidade"}', createdAt: '2026-09-29T10:00:00Z' }
  const left = { event: MULTI_NUMBER_WAITLIST_LEFT, metadata: '{}', createdAt: '2026-09-30T10:00:00Z' }
  assert.equal(currentWaitlistEntry([left, joined]).joined, false)
  const rejoined = { ...joined, createdAt: '2026-09-30T11:00:00Z' }
  assert.deepEqual(currentWaitlistEntry([joined, left, rejoined]), {
    joined: true, extraNumbers: 2, reason: 'continuidade', joinedAt: '2026-09-30T11:00:00.000Z',
  })
  assert.equal(currentWaitlistEntry([{ ...joined, metadata: 'lixo' }]).extraNumbers, null)
})

test('summarizeWaitlist soma receita potencial pelo preço aprovado', () => {
  const s = summarizeWaitlist([
    { joined: true, extraNumbers: 1, reason: 'rodizio' },
    { joined: true, extraNumbers: 3, reason: 'rodizio', requiresUpgrade: true },
    { joined: false },
  ])
  assert.equal(s.accounts, 2)
  assert.equal(s.needsUpgrade, 1)
  assert.equal(s.extraNumbersTotal, 4)
  assert.equal(s.potentialMonthlyCents, 4 * EXTRA_NUMBER_PRICE_CENTS)
  assert.deepEqual(s.byReason, { rodizio: 2 })
})

test('phaseOneDecision: segue com ≥5 PROs na lista ou ≥10% dos PROs (mínimo 3)', () => {
  assert.equal(phaseOneDecision({ proAccounts: 200, waitlistProAccounts: 5 }).go, true)
  assert.equal(phaseOneDecision({ proAccounts: 30, waitlistProAccounts: 3 }).go, true)
  assert.equal(phaseOneDecision({ proAccounts: 100, waitlistProAccounts: 4 }).go, false)
  assert.equal(phaseOneDecision({ proAccounts: 0, waitlistProAccounts: 0 }).go, false)
  assert.equal(phaseOneDecision({ proAccounts: 2, waitlistProAccounts: 1 }).go, false, 'base pequena não decide sozinha')
})

async function buildApp(plan) {
  const userId = `user-multi-number-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: { id: userId, name: 'Multi', email: `${userId}@multi-number-test.local`, passwordHash: 'x', plan },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(multiNumberRoutes, { prefix: '/api/multi-number' })
  return { app, userId }
}

async function cleanup(userId) {
  await db.analyticsEvent.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

test('rota: entrar, conferir e sair da lista de espera', async () => {
  const { app, userId } = await buildApp('pro')
  try {
    const empty = await app.inject({ method: 'GET', url: '/api/multi-number/waitlist' })
    assert.equal(empty.statusCode, 200)
    assert.equal(empty.json().joined, false)
    assert.equal(empty.json().requiresUpgrade, false)
    assert.equal(empty.json().priceCents, EXTRA_NUMBER_PRICE_CENTS)

    const bad = await app.inject({ method: 'POST', url: '/api/multi-number/waitlist', payload: { extraNumbers: 7, reason: 'rodizio' } })
    assert.equal(bad.statusCode, 400)

    const joined = await app.inject({ method: 'POST', url: '/api/multi-number/waitlist', payload: { extraNumbers: 2, reason: 'continuidade' } })
    assert.equal(joined.statusCode, 201)
    assert.equal(joined.json().joined, true)
    assert.equal(joined.json().extraNumbers, 2)

    const stored = await db.analyticsEvent.findFirst({ where: { userId, event: MULTI_NUMBER_WAITLIST_JOINED } })
    assert.deepEqual(JSON.parse(stored.metadata), { extraNumbers: 2, reason: 'continuidade', plan: 'pro', requiresUpgrade: false })

    await new Promise((r) => setTimeout(r, 5))
    const left = await app.inject({ method: 'DELETE', url: '/api/multi-number/waitlist' })
    assert.equal(left.json().joined, false)
    const leftAgain = await app.inject({ method: 'DELETE', url: '/api/multi-number/waitlist' })
    assert.equal(leftAgain.json().joined, false)
    assert.equal(await db.analyticsEvent.count({ where: { userId, event: MULTI_NUMBER_WAITLIST_LEFT } }), 1)
  } finally {
    await cleanup(userId)
  }
})

test('rota: Basic entra na lista marcado como "precisa subir de plano"', async () => {
  const { app, userId } = await buildApp('basic')
  try {
    const res = await app.inject({ method: 'POST', url: '/api/multi-number/waitlist', payload: { extraNumbers: 1, reason: 'mais_grupos' } })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().requiresUpgrade, true)
  } finally {
    await cleanup(userId)
  }
})
