import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { computeCanonicalMrr, loadCanonicalMrr } from '../src/domain/admin/mrr.js'

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('MRR = pagantes por plano x preco atual', () => {
  const r = computeCanonicalMrr({ basic: 3, pro: 2, premium: 1 }, { basic: 10, pro: 20, premium: 50 })
  assert.equal(r.activeMrr, 120)
  assert.equal(r.paidActiveUsers, 6)
  assert.deepEqual(computeCanonicalMrr({}, { basic: 10 }).activeMrr, 0)
})

test('loadCanonicalMrr usa a regra canonica de pagante e agrupa por plano', async () => {
  let where
  const db = { user: { groupBy: async args => { where = args.where; return [{ plan: 'pro', _count: { _all: 2 } }] } } }
  const r = await loadCanonicalMrr(db, { prices: { pro: 30 }, testAccountIds: ['t1'] })
  assert.equal(r.activeMrr, 60)
  assert.equal(where.status, 'active')
  assert.ok(JSON.stringify(where).includes('subscriptionCharges'), 'exige pagamento aprovado')
  assert.ok(JSON.stringify(where).includes('t1'), 'exclui conta de teste')
})

test('rotas nao voltam a calcular MRR por contagem de plan', () => {
  const src = read('src/api/routes/admin.js')
  assert.ok(!/activeBasic\s*\*/.test(src), 'MRR por activeBasic * preco')
  assert.ok(!/activePro\s*\*/.test(src))
  assert.ok(!/activePremium\s*\*/.test(src))
  assert.ok(!/plan:\s*'(basic|pro|premium)'[^\n]*currentPayingWhere|currentPayingWhere[^\n]*plan:\s*'(basic|pro|premium)'/.test(src))
  assert.equal((src.match(/loadCanonicalMrr\(/g) ?? []).length, 2, 'visao geral e ROI usam o mesmo helper')
})

test('Inicio nao promete "tempo real"', () => {
  const src = read('dashboard/app/admin/page.js')
  assert.ok(!/Atualização em tempo real/i.test(src))
  assert.ok(src.includes('Atualizado às'))
})
