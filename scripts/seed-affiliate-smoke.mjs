#!/usr/bin/env node
// Fixture de SMOKE do ciclo de vida de comissão de afiliado — STAGING ONLY.
//
// Cria dados de teste marcados (e-mails `smoke-*@tests.local`) e exercita as
// transições reais via a camada de serviço, imprimindo a trilha do ledger:
//   U1: pagamento -> initial(pending); 2º pagamento -> recurring; promove ->
//       eligible; aprova -> approved  (deixa comissões payable p/ testar
//       "marcar como pago" + O2 no painel admin de verdade)
//   U2: pagamento -> initial; refund (reverseForPayment) -> reversed
//   U3: pixKey do afiliado == e-mail do indicado -> held (R5/pix, valida decifra)
//
// NÃO usar em produção. Use o modo de limpeza ao terminar:
//   node scripts/seed-affiliate-smoke.mjs           # cria + exercita
//   CLEANUP=1 node scripts/seed-affiliate-smoke.mjs # remove TODAS as fixtures smoke
//
// Idempotência: cada run usa um TAG único; o CLEANUP remove tudo por padrão de
// e-mail, então pode rodar várias vezes e limpar de uma vez no fim.

import 'dotenv/config'
import { randomBytes } from 'crypto'
import db from '../src/db.js'
import { encryptCredential, decryptCredential } from '../src/credentialCrypto.js'
import {
  tryCreateAffiliateCommission,
  writeCommissionLedger,
  approveAffiliateCommission,
  reverseAffiliateCommissionForPayment,
} from '../src/domain/affiliate/service.js'

const SMOKE_EMAIL_LIKE = 'smoke-%@tests.local'

function assertNotProd() {
  const url = process.env.DATABASE_URL ?? ''
  if (/prod\.db/i.test(url)) {
    throw new Error(`[seed-smoke] BLOQUEADO: DATABASE_URL aponta para PROD (${url}). Rode só em staging.`)
  }
}

async function printLedger() {
  const rows = await db.affiliateCommissionLedger.findMany({
    where: { commission: { referredUser: { email: { contains: 'smoke-' } } } },
    orderBy: { createdAt: 'asc' },
    select: { commissionId: true, fromStatus: true, toStatus: true, amountCents: true, actor: true, reason: true },
  })
  console.log(`\n  Trilha do ledger (${rows.length} linhas):`)
  for (const r of rows) {
    console.log(`   ${(r.fromStatus ?? 'Ø').padEnd(9)} -> ${r.toStatus.padEnd(9)} | ${String(r.amountCents).padStart(6)}c | ${r.actor ?? ''} | ${r.reason ?? ''}`)
  }
}

async function cleanup() {
  const users = await db.user.findMany({ where: { email: { contains: 'smoke-', endsWith: '@tests.local' } }, select: { id: true, affiliateProfileId: true } })
  const userIds = users.map(u => u.id)
  if (!userIds.length) { console.log('Nada para limpar (nenhum usuário smoke-*@tests.local).'); return }
  const profiles = await db.affiliateProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  const profileIds = profiles.map(p => p.id)

  const c = await db.affiliateCommission.deleteMany({ where: { referredUserId: { in: userIds } } }) // cascade -> ledger
  const pay = await db.payment.deleteMany({ where: { userId: { in: userIds } } })
  const touch = await db.affiliateAttributionTouch.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { affiliateId: { in: profileIds } }] } })
  await db.user.updateMany({ where: { affiliateProfileId: { in: profileIds } }, data: { affiliateProfileId: null } })
  const prof = await db.affiliateProfile.deleteMany({ where: { id: { in: profileIds } } })
  const u = await db.user.deleteMany({ where: { id: { in: userIds } } })
  console.log(`✓ Limpeza: ${u.count} users, ${prof.count} profiles, ${pay.count} payments, ${c.count} commissions (+ledger cascade), ${touch.count} touches.`)
}

async function mkUser(email, extra = {}) {
  return db.user.create({ data: { name: email.split('@')[0], email, passwordHash: 'x-smoke-not-loginable', plan: 'trial', ...extra } })
}

async function mkApprovedPayment(userId, profileId, amount, n) {
  return db.payment.create({
    data: { userId, mpPaymentId: `smoke-mp-${n}-${randomBytes(3).toString('hex')}`, plan: 'mensal', status: 'approved', amount, affiliateProfileIdAtCheckout: profileId, lastSyncedAt: new Date() },
  })
}

async function seed() {
  const TAG = randomBytes(3).toString('hex')
  console.log(`== SEED smoke (tag ${TAG}) ==`)

  // Afiliado aprovado (pixKey cifrado)
  const affUser = await mkUser(`smoke-aff-${TAG}@tests.local`)
  const profile = await db.affiliateProfile.create({
    data: { userId: affUser.id, code: `SMOKE${TAG.toUpperCase()}`, status: 'approved', pixKey: encryptCredential('smoke-aff-pix@tests.local'), pixKeyType: 'email', approvedAt: new Date() },
  })
  console.log(`  afiliado: ${affUser.email} | code ${profile.code} | pixKey cifrado=${profile.pixKey.startsWith('v1:')}`)

  // ── U1: initial -> recurring -> promote -> approve ──
  const u1 = await mkUser(`smoke-ref1-${TAG}@tests.local`, { affiliateProfileId: profile.id })
  const p1a = await mkApprovedPayment(u1.id, profile.id, 39, `${TAG}-1a`)
  const r1a = await tryCreateAffiliateCommission({ userId: u1.id, paymentId: p1a.id, saleAmountCents: 3900, occurredAt: p1a.createdAt, db })
  const p1b = await mkApprovedPayment(u1.id, profile.id, 39, `${TAG}-1b`)
  const r1b = await tryCreateAffiliateCommission({ userId: u1.id, paymentId: p1b.id, saleAmountCents: 3900, occurredAt: p1b.createdAt, db })
  console.log(`  U1: 1ª=${r1a.commissionType}/${r1a.status}  2ª=${r1b.commissionType}/${r1b.status}  (esperado initial/pending, recurring/pending)`)
  // promove só as comissões da fixture (o promote real é table-wide; aqui
  // escopamos no U1 para não tocar comissões reais de sandbox que coexistam).
  const pend = await db.affiliateCommission.findMany({ where: { referredUserId: u1.id, status: 'pending' }, select: { id: true, affiliateId: true, commissionAmountCents: true } })
  for (const c of pend) {
    await db.affiliateCommission.update({ where: { id: c.id }, data: { status: 'eligible' } })
    await writeCommissionLedger({ commissionId: c.id, affiliateId: c.affiliateId, fromStatus: 'pending', toStatus: 'eligible', amountCents: c.commissionAmountCents, reason: 'hold_elapsed', actor: 'system', db })
  }
  console.log(`  U1: promote (escopo fixture, hold vencido) -> promovidas=${pend.length}`)
  const appr = await approveAffiliateCommission({ id: r1a.commissionId, adminUserId: 'smoke-admin', db })
  console.log(`  U1: approve 1ª -> ${appr.updated ? 'approved' : 'FALHOU'}`)

  // ── U2: initial -> reversed (refund) ──
  const u2 = await mkUser(`smoke-ref2-${TAG}@tests.local`, { affiliateProfileId: profile.id })
  const p2 = await mkApprovedPayment(u2.id, profile.id, 69, `${TAG}-2`)
  const r2 = await tryCreateAffiliateCommission({ userId: u2.id, paymentId: p2.id, saleAmountCents: 6900, occurredAt: p2.createdAt, db })
  const rev = await reverseAffiliateCommissionForPayment({ paymentId: p2.id, reason: 'payment_refunded', db })
  console.log(`  U2: ${r2.commissionType}/${r2.status} -> refund -> reversed=${rev.updated} (esperado 1)`)

  // ── U3: hold por pixKey == e-mail do indicado (valida decifra no antifraude) ──
  const u3 = await mkUser(`smoke-ref3-${TAG}@tests.local`, { affiliateProfileId: profile.id })
  await db.affiliateProfile.update({ where: { id: profile.id }, data: { pixKey: encryptCredential(u3.email) } })
  const p3 = await mkApprovedPayment(u3.id, profile.id, 39, `${TAG}-3`)
  const r3 = await tryCreateAffiliateCommission({ userId: u3.id, paymentId: p3.id, saleAmountCents: 3900, occurredAt: p3.createdAt, db })
  console.log(`  U3: status=${r3.status} (esperado held)  pixDecifra=${decryptCredential((await db.affiliateProfile.findUnique({ where: { id: profile.id } })).pixKey) === u3.email}`)

  await printLedger()

  const byStatus = await db.affiliateCommission.groupBy({ by: ['status'], where: { referredUserId: { in: [u1.id, u2.id, u3.id] } }, _count: true })
  console.log('\n  Comissões smoke por status:', byStatus.map(g => `${g.status}:${g._count}`).join('  '))
  console.log(`\n  ▶ No painel admin, marque como pago as comissões payable de ${u1.email} (testa G/O2).`)
  console.log(`  ▶ Para testar O2: suspenda o afiliado ${affUser.email} e tente pagar -> deve bloquear.`)
  console.log(`  ▶ Ao terminar:  CLEANUP=1 node scripts/seed-affiliate-smoke.mjs`)
}

async function main() {
  assertNotProd()
  if (process.env.CLEANUP === '1') return cleanup()
  return seed()
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('✗ Falha no seed-smoke:', err?.message ?? err)
    await db.$disconnect().catch(() => {})
    process.exit(1)
  })
