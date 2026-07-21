import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateAffiliateCommissionRisk,
  tryCreateAffiliateCommission,
  getAffiliateMeData,
  getAffiliateReferrals,
  approveAffiliateCommission,
  attachOrphanTouchesByDevice,
  ORPHAN_DEVICE_HOLD_MARKER,
} from '../src/domain/affiliate/service.js'
import { encryptCredential } from '../src/credentialCrypto.js'

const baseProfile = {
  id: 'prof-1', userId: 'aff-user-1', status: 'approved',
  pixKey: 'pix@example.com', pixKeyType: 'email',
  commissionPercentOverride: null, commissionRecurringPercentOverride: null,
  user: { id: 'aff-user-1', email: 'afiliado@example.com', contactPhone: '+5511888880000' },
}
const referred = { id: 'user-1', email: 'cliente@example.com', contactPhone: '+5511999990000', affiliateProfileId: 'prof-1' }

// ---- R5: hold por mesmo dispositivo/rede ----
test('R5: mesmo ipHash entre afiliado e indicado coloca em hold', () => {
  const r = evaluateAffiliateCommissionRisk({ profile: baseProfile, referredUser: referred, affiliateSignals: { ipHash: 'ABC' }, referredSignals: { ipHash: 'ABC' } })
  assert.deepEqual(r, { decision: 'hold', reason: 'same_ip_hash' })
})

test('R5: mesmo uaHash coloca em hold', () => {
  const r = evaluateAffiliateCommissionRisk({ profile: baseProfile, referredUser: referred, affiliateSignals: { uaHash: 'UA' }, referredSignals: { uaHash: 'UA' } })
  assert.deepEqual(r, { decision: 'hold', reason: 'same_ua_hash' })
})

test('R5: sinais diferentes não disparam hold (allow)', () => {
  const r = evaluateAffiliateCommissionRisk({ profile: baseProfile, referredUser: referred, affiliateSignals: { ipHash: 'A' }, referredSignals: { ipHash: 'B' } })
  assert.equal(r.decision, 'allow')
})

// ---- R1: pixKey cifrado ainda casa no antifraude (decifra antes de comparar) ----
test('R1: pixMatch funciona mesmo com pixKey cifrado', () => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(64)
  try {
    const profile = { ...baseProfile, pixKey: encryptCredential('cliente@example.com'), pixKeyType: 'email' }
    const r = evaluateAffiliateCommissionRisk({ profile, referredUser: referred })
    assert.deepEqual(r, { decision: 'hold', reason: 'pix_matches_referred_email' })
  } finally {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY
  }
})

// ---- helper de fake db para tryCreate ----
// `existingMutable=true` faz o findFirst/create operarem sobre o MESMO array
// (existing===created), simulando corrida real onde a segunda consulta
// enxerga o que a primeira já persistiu — usado nos testes de corrida do US7.
function mkDb({ existing = [], touches = {}, settings = null, profile = baseProfile, referredUser = referred, existingMutable = false } = {}) {
  const created = existingMutable ? existing : []
  const ledger = []
  const db = {
    user: { findUnique: async () => referredUser },
    payment: { findUnique: async () => null },
    affiliateProfile: { findUnique: async () => profile },
    affiliateSettings: { findFirst: async () => settings },
    affiliateAttributionTouch: {
      findFirst: async ({ where }) => touches[where.userId] ?? null,
    },
    affiliateCommission: {
      // respeita o filtro de status { not: 'reversed' } e NÃO filtra por afiliado (O1+O4)
      findFirst: async ({ where }) => {
        const pool = existingMutable ? created : existing
        const matches = pool.filter(c =>
          c.referredUserId === where.referredUserId &&
          !(where.status?.not && c.status === where.status.not) &&
          !(where.commissionType && c.commissionType !== where.commissionType)
        )
        if (!matches.length) return null
        return [...matches].sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))[0]
      },
      create: async ({ data }) => { const row = { id: `c-${created.length + 1}`, createdAt: data.createdAt ?? new Date(Date.now() + created.length), ...data }; created.push(row); return row },
      update: async ({ where, data }) => { const row = created.find(r => r.id === where.id); Object.assign(row, data); return row },
    },
    affiliateCommissionLedger: {
      create: async ({ data }) => { ledger.push(data); return { id: `l-${ledger.length}`, ...data } },
    },
  }
  return { db, created, ledger }
}

// ---- O1: comissão anterior revertida NÃO torna a próxima 'recurring' ----
test('O1: prior revertida → próxima é initial', async () => {
  const { db, created } = mkDb({ existing: [{ referredUserId: 'user-1', affiliateId: 'prof-1', status: 'reversed' }] })
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p1', saleAmountCents: 3900, db })
  assert.equal(created[0].commissionType, 'initial')
})

// ---- O4: prior de OUTRO afiliado (não revertida) → recurring (não paga 2ª initial) ----
test('O4: prior de outro afiliado → recurring', async () => {
  const { db, created } = mkDb({ existing: [{ referredUserId: 'user-1', affiliateId: 'prof-OUTRO', status: 'paid' }] })
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p2', saleAmountCents: 3900, db })
  assert.equal(created[0].commissionType, 'recurring')
})

// ---- R3: ledger registra a criação ----
test('R3: criação de comissão grava linha no ledger', async () => {
  const { db, created, ledger } = mkDb()
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p3', saleAmountCents: 3900, db })
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].commissionId, created[0].id)
  assert.equal(ledger[0].fromStatus, null)
  assert.equal(ledger[0].toStatus, created[0].status)
  assert.equal(ledger[0].amountCents, created[0].commissionAmountCents)
  assert.equal(ledger[0].actor, 'system')
})

// ---- R5 ponta-a-ponta: touch do afiliado e do indicado com mesmo ipHash → held ----
test('R5 e2e: tryCreate coloca em held quando touches compartilham ipHash', async () => {
  const { db, created } = mkDb({ touches: { 'aff-user-1': { ipHash: 'SAME' }, 'user-1': { ipHash: 'SAME' } } })
  const r = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p4', saleAmountCents: 3900, db })
  assert.equal(r.status, 'held')
  assert.equal(created[0].holdReason, 'same_ip_hash')
})

// ---- R3 approve grava ledger com fromStatus correto ----
test('R3: aprovação grava ledger held→approved', async () => {
  const rows = [{ id: 'c1', status: 'held', affiliateId: 'prof-1', commissionAmountCents: 1170 }]
  const ledger = []
  const db = {
    affiliateCommission: {
      findUnique: async ({ where }) => rows.find(r => r.id === where.id) ?? null,
      updateMany: async ({ where, data }) => { const row = rows.find(r => r.id === where.id && where.status.in.includes(r.status)); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 } },
    },
    affiliateCommissionLedger: { create: async ({ data }) => { ledger.push(data); return data } },
  }
  const res = await approveAffiliateCommission({ id: 'c1', adminUserId: 'admin-9', db })
  assert.equal(res.updated, true)
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].fromStatus, 'held')
  assert.equal(ledger[0].toStatus, 'approved')
  assert.equal(ledger[0].actor, 'admin-9')
})

// ---- O6: getAffiliateMeData agrega via groupBy ----
test('O6: getAffiliateMeData soma por status a partir do groupBy', async () => {
  const db = {
    affiliateProfile: { findUnique: async () => ({ id: 'prof-1', userId: 'aff-user-1', pixKey: 'pix@example.com', pixKeyType: 'email' }) },
    user: { count: async () => 7 },
    affiliateCommission: {
      groupBy: async () => ([
        { cycleMonth: '2026-06', status: 'paid', _sum: { commissionAmountCents: 1000 }, _count: 2 },
        { cycleMonth: '2026-06', status: 'pending', _sum: { commissionAmountCents: 500 }, _count: 1 },
        { cycleMonth: '2026-05', status: 'reversed', _sum: { commissionAmountCents: 300 }, _count: 1 },
        { cycleMonth: '2026-05', status: 'eligible', _sum: { commissionAmountCents: 700 }, _count: 1 },
      ]),
    },
  }
  const data = await getAffiliateMeData({ userId: 'aff-user-1', db })
  assert.deepEqual(data.stats, { totalReferrals: 7, totalSales: 4, totalEarnedCents: 1000, payableCents: 700, pendingCents: 500, reversedCents: 300, debtCents: 0, lifetimeEarnedCents: 2200 })
  assert.equal(data.months[0].month, '2026-06')
  assert.equal(data.months[0].totalCents, 1500)
  assert.equal(data.months[0].status, 'pending')
  assert.equal(data.months[1].month, '2026-05')
  assert.equal(data.months[1].totalCents, 700) // reversed não soma
  assert.equal(data.months[1].status, 'eligible')
})

// ---- US7 (FR-027): byMonth.count exclui revertidas, batendo com "Vendas válidas" ----
test('US7: byMonth.count exclui comissões revertidas (bate com totalSales)', async () => {
  const db = {
    affiliateProfile: { findUnique: async () => ({ id: 'prof-1', userId: 'aff-user-1', pixKey: 'pix@example.com', pixKeyType: 'email' }) },
    user: { count: async () => 3 },
    affiliateCommission: {
      groupBy: async () => ([
        { cycleMonth: '2026-05', status: 'reversed', _sum: { commissionAmountCents: 300 }, _count: 1 },
        { cycleMonth: '2026-05', status: 'eligible', _sum: { commissionAmountCents: 700 }, _count: 1 },
      ]),
    },
  }
  const data = await getAffiliateMeData({ userId: 'aff-user-1', db })
  assert.equal(data.months[0].count, 1, 'count não deve incluir a comissão reversed')
  assert.equal(data.months[0].count, data.stats.totalSales, 'byMonth.count deve bater com "Vendas válidas" (totalSales)')
})

// ---- US7 (FR-028): lifetimeEarnedCents distinto do total pago ----
test('US7: lifetimeEarnedCents soma tudo não-revertido, distinto de totalEarnedCents (só pago)', async () => {
  const db = {
    affiliateProfile: { findUnique: async () => ({ id: 'prof-1', userId: 'aff-user-1', pixKey: 'pix@example.com', pixKeyType: 'email' }) },
    user: { count: async () => 1 },
    affiliateCommission: {
      groupBy: async () => ([
        { cycleMonth: '2026-06', status: 'paid', _sum: { commissionAmountCents: 1000 }, _count: 1 },
        { cycleMonth: '2026-06', status: 'eligible', _sum: { commissionAmountCents: 500 }, _count: 1 },
        { cycleMonth: '2026-06', status: 'pending', _sum: { commissionAmountCents: 300 }, _count: 1 },
      ]),
    },
  }
  const data = await getAffiliateMeData({ userId: 'aff-user-1', db })
  assert.equal(data.stats.totalEarnedCents, 1000)
  assert.equal(data.stats.lifetimeEarnedCents, 1800)
  assert.notEqual(data.stats.lifetimeEarnedCents, data.stats.totalEarnedCents)
})

test('getAffiliateReferrals retorna múltiplos indicados com detalhes financeiros anonimizados', async () => {
  const users = [
    { id: 'u1', name: 'Marlene Jahn', email: 'marlene@example.com', contactPhone: null, status: 'active', plan: 'pro', accessExpiresAt: new Date('2026-08-01T00:00:00Z'), createdAt: new Date('2026-06-01T00:00:00Z'), lastActivityAt: null },
    { id: 'u2', name: 'Ana Silva', email: 'ana@example.com', contactPhone: null, status: 'active', plan: 'trial', accessExpiresAt: new Date('2026-07-01T00:00:00Z'), createdAt: new Date('2026-06-02T00:00:00Z'), lastActivityAt: null },
  ]
  const db = {
    user: {
      count: async ({ where }) => where.affiliateProfileId === 'prof-1' ? 2 : 0,
      findMany: async ({ where }) => where.affiliateProfileId === 'prof-1' ? users : [],
    },
    payment: { findMany: async () => [
      { userId: 'u1', amount: 39, createdAt: new Date('2026-06-10T00:00:00Z') },
      { userId: 'u1', amount: 39, createdAt: new Date('2026-06-20T00:00:00Z') },
    ] },
    affiliateCommission: { findMany: async () => [
      { referredUserId: 'u1', commissionType: 'initial', commissionAmountCents: 1170, status: 'pending', eligibleAt: new Date('2026-07-10T00:00:00Z'), paidAt: null },
      { referredUserId: 'u1', commissionType: 'recurring', commissionAmountCents: 1170, status: 'paid', eligibleAt: new Date('2026-07-20T00:00:00Z'), paidAt: new Date('2026-07-25T00:00:00Z') },
    ] },
  }

  const result = await getAffiliateReferrals({ affiliateProfileId: 'prof-1', anonymized: true, db, now: new Date('2026-06-29T00:00:00Z') })
  assert.equal(result.total, 2)
  assert.equal(result.referrals.length, 2)
  assert.equal(result.referrals[0].name, 'Marlene J.')
  assert.equal(result.referrals[0].paymentCount, 2)
  assert.equal(result.referrals[0].commissionInitialCents, 1170)
  assert.equal(result.referrals[0].commissionRecurringCents, 1170)
  assert.equal(result.referrals[0].commissionPendingCents, 1170)
  assert.equal(result.referrals[0].commissionPaidCents, 1170)
  assert.deepEqual(result.referrals[0].commissionStatuses, { pending: 1, paid: 1 })
})

// ---- US7 (009-affiliate-improvements-r1, R3/FR-006): corrida initial/recurring ----

test('US7: dois pagamentos concorrentes do mesmo indicado → exatamente uma initial', async () => {
  const { db, created } = mkDb({ existing: [], existingMutable: true })
  const [r1, r2] = await Promise.all([
    tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'race-p1', saleAmountCents: 3900, db }),
    tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'race-p2', saleAmountCents: 3900, db }),
  ])
  assert.equal(created.length, 2)
  const initials = created.filter(c => c.commissionType === 'initial')
  const recurrings = created.filter(c => c.commissionType === 'recurring')
  assert.equal(initials.length, 1, 'exatamente uma comissão deve permanecer initial')
  assert.equal(recurrings.length, 1, 'a outra deve ser rebaixada a recurring')
  // a mais antiga por createdAt é a que permanece initial (2ª tentativa determinística)
  const oldest = [...created].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
  assert.equal(oldest.commissionType, 'initial')
  assert.ok([r1.commissionType, r2.commissionType].includes('initial'))
  assert.ok([r1.commissionType, r2.commissionType].includes('recurring'))
})

test('US7: mesmo paymentId processado 2x não duplica (regressão paymentId @unique)', async () => {
  const rows = []
  const db = {
    user: { findUnique: async () => referred },
    payment: { findUnique: async () => null },
    affiliateProfile: { findUnique: async () => baseProfile },
    affiliateSettings: { findFirst: async () => null },
    affiliateAttributionTouch: { findFirst: async () => null },
    affiliateCommission: {
      findFirst: async ({ where }) => rows.find(r => r.referredUserId === where.referredUserId && !(where.status?.not && r.status === where.status.not)) ?? null,
      create: async ({ data }) => {
        if (rows.some(r => r.paymentId === data.paymentId)) { const err = new Error('unique violation'); err.code = 'P2002'; throw err }
        const row = { id: `c-${rows.length + 1}`, createdAt: new Date(), ...data }
        rows.push(row)
        return row
      },
    },
    affiliateCommissionLedger: { create: async ({ data }) => data },
  }
  const first = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'dup-p1', saleAmountCents: 3900, db })
  const second = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'dup-p1', saleAmountCents: 3900, db })
  assert.equal(first.created, true)
  assert.equal(second.skipped, 'duplicate_payment')
  assert.equal(rows.length, 1)
})

// ---- US4 (009-affiliate-improvements-r1): endurecimento de atribuição órfã por dispositivo ----

function mkTouchDb({ touches = [], settings = null } = {}) {
  const rows = touches.map((t, i) => ({ id: t.id ?? `touch-${i + 1}`, userId: null, campaign: null, ...t }))
  const db = {
    affiliateSettings: { findFirst: async () => settings },
    affiliateAttributionTouch: {
      findMany: async ({ where }) => rows.filter(r =>
        r.affiliateId === where.affiliateId &&
        r.userId === null &&
        (!where.ipHash || r.ipHash === where.ipHash) &&
        (!where.uaHash || r.uaHash === where.uaHash)
      ),
      update: async ({ where, data }) => {
        const row = rows.find(r => r.id === where.id)
        Object.assign(row, data)
        return row
      },
      findFirst: async ({ where }) => rows.find(r =>
        r.affiliateId === where.affiliateId && r.userId === where.userId && r.campaign === where.campaign
      ) ?? null,
    },
  }
  return { db, rows }
}

test('US4: toque dentro da janela endurecida com modo both/hold → comissão held', async () => {
  const now = new Date('2026-07-21T00:00:00Z')
  for (const orphanTouchMode of ['both', 'hold']) {
    const touchedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 dias atrás
    const { db, rows } = mkTouchDb({
      touches: [{ affiliateId: 'prof-1', ipHash: 'DEV1', touchedAt }],
      settings: { orphanTouchWindowDays: 7, orphanTouchMode },
    })
    const result = await attachOrphanTouchesByDevice({ affiliateId: 'prof-1', ipHash: 'DEV1', userId: 'user-1', db, now })
    assert.equal(result.updated, 1, `mode=${orphanTouchMode}`)
    assert.equal(result.held, true, `mode=${orphanTouchMode}`)
    assert.equal(rows[0].userId, 'user-1', `mode=${orphanTouchMode}`)
    assert.equal(rows[0].campaign, ORPHAN_DEVICE_HOLD_MARKER, `mode=${orphanTouchMode}`)
  }
})

test('US4: toque fora da janela endurecida → nenhuma atribuição por dispositivo', async () => {
  const now = new Date('2026-07-21T00:00:00Z')
  const touchedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 dias atrás, > janela de 7
  const { db, rows } = mkTouchDb({
    touches: [{ affiliateId: 'prof-1', ipHash: 'DEV1', touchedAt }],
    settings: { orphanTouchWindowDays: 7, orphanTouchMode: 'both' },
  })
  const result = await attachOrphanTouchesByDevice({ affiliateId: 'prof-1', ipHash: 'DEV1', userId: 'user-1', db, now })
  assert.equal(result.updated, 0)
  assert.equal(rows[0].userId, null)
})

test('US4: modo window → comissão segue fluxo normal (sem hold)', async () => {
  const now = new Date('2026-07-21T00:00:00Z')
  const touchedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const { db, rows } = mkTouchDb({
    touches: [{ affiliateId: 'prof-1', ipHash: 'DEV1', touchedAt }],
    settings: { orphanTouchWindowDays: 7, orphanTouchMode: 'window' },
  })
  const result = await attachOrphanTouchesByDevice({ affiliateId: 'prof-1', ipHash: 'DEV1', userId: 'user-1', db, now })
  assert.equal(result.updated, 1)
  assert.equal(result.held, false)
  assert.equal(rows[0].userId, 'user-1')
  assert.equal(rows[0].campaign, null)
})

test('US4: modo off → comportamento legado (30 dias, sem hold)', async () => {
  const now = new Date('2026-07-21T00:00:00Z')
  const touchedAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) // 20 dias: fora da janela endurecida (7d) mas dentro do legado (30d)
  const { db, rows } = mkTouchDb({
    touches: [{ affiliateId: 'prof-1', ipHash: 'DEV1', touchedAt }],
    settings: { orphanTouchWindowDays: 7, orphanTouchMode: 'off' },
  })
  const result = await attachOrphanTouchesByDevice({ affiliateId: 'prof-1', ipHash: 'DEV1', userId: 'user-1', db, now })
  assert.equal(result.updated, 1)
  assert.equal(result.held, false)
  assert.equal(rows[0].userId, 'user-1')
  assert.equal(rows[0].campaign, null)
})

// ---- US4 ponta-a-ponta: comissão nasce held quando a atribuição veio de toque órfão marcado ----
test('US4 e2e: tryCreate coloca em held quando a atribuição veio de toque órfão por dispositivo marcado', async () => {
  const { db, created } = mkDb({
    profile: baseProfile,
    referredUser: { ...referred, contactPhone: null, email: 'outro@example.com' },
  })
  // Sobrepõe o findFirst de affiliateAttributionTouch para simular o marcador
  // ORPHAN_DEVICE_HOLD_MARKER gravado por attachOrphanTouchesByDevice.
  db.affiliateAttributionTouch.findFirst = async ({ where }) => {
    if (where.campaign === ORPHAN_DEVICE_HOLD_MARKER && where.affiliateId === 'prof-1' && where.userId === 'user-1') {
      return { id: 'touch-1', campaign: ORPHAN_DEVICE_HOLD_MARKER }
    }
    return null
  }
  const r = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p5', saleAmountCents: 3900, db })
  assert.equal(r.status, 'held')
  assert.equal(created[0].holdReason, 'orphan_device_attribution')
})
