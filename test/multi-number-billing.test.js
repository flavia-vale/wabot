import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import db from '../src/db.js'
import {
  EXTRA_NUMBER_PLAN,
  EXTRA_NUMBER_PRICE,
  buildExtraNumberReference,
  parseExtraNumberReference,
  isExtraNumberSubscription,
  extraNumbersForStatus,
  PLAN_SUBSCRIPTION_WHERE,
} from '../src/domain/payments/extraNumberBilling.js'
import { applyExtraNumberStatus } from '../src/api/routes/payments.js'

test('preço aprovado: R$29 por número extra', () => {
  assert.equal(EXTRA_NUMBER_PRICE, 29)
})

test('referência do adicional: monta, lê e NUNCA confunde com a do plano', () => {
  const ref = buildExtraNumberReference('cku1')
  assert.equal(ref, 'addon:extra_number:cku1')
  assert.equal(parseExtraNumberReference(ref), 'cku1')
  assert.equal(parseExtraNumberReference('cku1'), null, 'referência do plano é o userId puro')
  assert.equal(parseExtraNumberReference('addon:extra_number:'), null)
  assert.equal(parseExtraNumberReference(null), null)
  assert.throws(() => buildExtraNumberReference('a:b'))
})

test('status da assinatura → números extras (só "authorized" vale)', () => {
  assert.equal(extraNumbersForStatus('authorized'), 1)
  for (const s of ['pending', 'paused', 'cancelled', undefined]) assert.equal(extraNumbersForStatus(s), 0)
  assert.equal(isExtraNumberSubscription({ plan: EXTRA_NUMBER_PLAN }), true)
  assert.equal(isExtraNumberSubscription({ plan: 'pro' }), false)
  assert.deepEqual(PLAN_SUBSCRIPTION_WHERE, { plan: { not: 'extra_number' } })
})

test('estrutural: o fluxo do PLANO nunca enxerga a assinatura do número reserva', () => {
  const src = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  // Webhook do preapproval: o desvio do adicional vem ANTES de resolver plano pelo valor.
  const pre = src.indexOf('const extraNumberUserId = snapshot.ok ? parseExtraNumberReference(snapshot.externalReference) : null')
  const planByAmount = src.indexOf('const plan = resolvePlanForPayment({ amount: snapshot.transactionAmount, plans })')
  assert.ok(pre > 0 && pre < planByAmount)
  // Cobrança aprovada do adicional não libera acesso do plano.
  assert.match(src, /if \(isExtraNumberSubscription\(subscription\)\) \{[\s\S]{0,400}\} else if \(subscription\?\.userId\) \{/)
  // Aviso de cobrança recusada do plano não sai para o adicional.
  assert.match(src, /if \(!isExtraNumberSubscription\(subscriptionForCharge\)\) await reagirACobrancaRecusada/)
  // Reconciliação: o adicional sai antes da extensão de acesso.
  assert.match(src, /if \(isExtraNumberSubscription\(subscription\)\) \{\n\s+await applyExtraNumberStatus\([^)]*\)\n\s+continue\n\s+\}/)
  // Toda consulta de assinatura POR CONTA do plano filtra o adicional.
  for (const where of [
    "where: { userId, status: 'authorized', ...PLAN_SUBSCRIPTION_WHERE }",
    "where: { userId, status: 'pending', ...PLAN_SUBSCRIPTION_WHERE }",
    'where: { userId, ...PLAN_SUBSCRIPTION_WHERE }',
    'where: { userId, status: { in: SUBSCRIPTION_OPEN_STATUSES }, ...PLAN_SUBSCRIPTION_WHERE }',
  ]) assert.ok(src.includes(where), where)
})

test('status do adicional liga/desliga o número extra e para a prontidão ao cancelar', async () => {
  const id = `user-billing-${Date.now()}`
  await db.user.create({ data: { id, name: 'B', email: `${id}@t.local`, passwordHash: 'x', plan: 'pro' } })
  try {
    await db.waExtraSession.create({ data: { userId: id, slot: 2, status: 'connected', lifecycle: 'ready' } })
    assert.deepEqual(await applyExtraNumberStatus({ userId: id, status: 'authorized' }), { changed: true, extraNumbers: 1 })
    assert.deepEqual(await applyExtraNumberStatus({ userId: id, status: 'authorized' }), { changed: false, extraNumbers: 1 })
    assert.equal((await db.user.findUnique({ where: { id } })).extraNumbers, 1)
    assert.deepEqual(await applyExtraNumberStatus({ userId: id, status: 'cancelled' }), { changed: true, extraNumbers: 0 })
    const row = await db.waExtraSession.findFirst({ where: { userId: id } })
    assert.equal(row.status, 'disconnected')
    assert.equal(row.lifecycle, 'stopped_by_user')
  } finally {
    await db.user.deleteMany({ where: { id } })
  }
})
