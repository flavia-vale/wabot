import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  loadEverPaidUserIds,
  everPaidWhere,
  currentPayingWhere,
  formerPayingWhere,
  stalePayingWhere,
  APPROVED_CHARGE_STATUSES,
} from '../src/domain/admin/payingLoader.js'

/*
 * Auditoria do admin (docs/admin/auditoria-painel-admin.md, Q3): "pagante"
 * tinha quatro definições. O Início, o Financeiro e o ROI contavam pelo campo
 * `plan`, que cortesia e liberação manual também preenchem — exatamente o que
 * docs/rca/admin.md proíbe para a tag. Estes testes travam a fonte única.
 */

const AGORA = new Date('2026-10-02T12:00:00Z')

function fakeDb({ payments = [], charges = [] } = {}) {
  return {
    payment: { groupBy: async ({ where }) => payments.filter(p => where.userId.in.includes(p.userId) && where.status.in.includes(p.status)).map(p => ({ userId: p.userId })) },
    subscriptionCharge: { groupBy: async ({ where }) => charges.filter(c => where.userId.in.includes(c.userId) && where.status.in.includes(c.status)).map(c => ({ userId: c.userId })) },
  }
}

test('quem pagou só por cobrança de assinatura recuperada (sem Payment) também é pagante', async () => {
  const db = fakeDb({
    payments: [{ userId: 'avulso', status: 'approved' }, { userId: 'recusado', status: 'rejected' }],
    charges: [{ userId: 'assinante', status: 'accredited' }, { userId: 'falhou', status: 'rejected' }],
  })
  const ids = await loadEverPaidUserIds(db, ['avulso', 'assinante', 'recusado', 'falhou', 'nunca'])
  assert.deepEqual([...ids].sort(), ['assinante', 'avulso'])
})

test('banco antigo sem subscriptionCharge não derruba a tag (só Payment)', async () => {
  const db = { payment: fakeDb({ payments: [{ userId: 'u1', status: 'approved' }] }).payment }
  assert.deepEqual([...await loadEverPaidUserIds(db, ['u1'])], ['u1'])
})

test('status de cobrança aprovada vem de chargeOutcome, nunca de lista própria', () => {
  assert.ok(APPROVED_CHARGE_STATUSES.includes('approved'))
  assert.ok(APPROVED_CHARGE_STATUSES.includes('accredited'))
})

test('as cláusulas de pagante NUNCA olham o campo plan', () => {
  for (const where of [everPaidWhere(), currentPayingWhere(AGORA), formerPayingWhere(AGORA), stalePayingWhere(AGORA, new Date('2026-09-30T12:00:00Z'))]) {
    const texto = JSON.stringify(where)
    assert.ok(!texto.includes('"plan"'), `cláusula usa plan: ${texto}`)
    assert.ok(texto.includes('"payments"') && texto.includes('"subscriptionCharges"'), 'precisa olhar os dois caminhos de pagamento')
  }
})

test('pagante atual exige conta ativa e acesso em dia; sem validade (liberado sem prazo) continua pagante', () => {
  const where = currentPayingWhere(AGORA)
  assert.equal(where.status, 'active')
  const texto = JSON.stringify(where)
  assert.ok(texto.includes('{"accessExpiresAt":null}'), 'sem validade conta como em dia (mesma regra de resolvePayingStatus)')
  assert.ok(texto.includes('"gt":"2026-10-02T12:00:00.000Z"'))
})

test('ex-pagante é quem pagou e venceu — nunca trial vencido', () => {
  const texto = JSON.stringify(formerPayingWhere(AGORA))
  assert.ok(texto.includes('"lt":"2026-10-02T12:00:00.000Z"'))
  assert.ok(texto.includes('"payments"'))
})

test('admin.js não conta pagante pelo campo plan em lugar nenhum', () => {
  const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const usos = fonte.split('\n').filter(linha => linha.includes('plan: { in: PAID_PLANS }') || /plan: '(basic|pro|premium)', accessExpiresAt/.test(linha))
  assert.deepEqual(usos, [], `voltou a contar pagante por plan:\n${usos.join('\n')}`)
  assert.ok(!fonte.includes('PAID_PLANS.includes(user.plan)'), 'buildRiskFlags voltou a decidir "pagante parado" pelo plan')
  assert.match(fonte, /if \(everPaid && stale\) flags\.push\('paid_stale_48h'\)/)
  assert.match(fonte, /if \(!running && everPaid\) flags\.push\('bot_not_running'\)/)
})

test('quem chama buildRiskFlags passa everPaid (senão a flag nunca acende)', () => {
  for (const arquivo of ['../src/api/routes/admin.js', '../src/domain/admin/service.js']) {
    const fonte = readFileSync(new URL(arquivo, import.meta.url), 'utf8')
    const chamadas = fonte.split('\n').filter(l => l.includes('buildRiskFlags({'))
    assert.ok(chamadas.length > 0)
    for (const chamada of chamadas) assert.ok(chamada.includes('everPaid'), `${arquivo}: ${chamada.trim()}`)
  }
})
