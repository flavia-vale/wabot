import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAnonymizedUserFields,
  redactUserForExport,
  collectUserExport,
  anonymizeUser,
  PURGED_MODELS,
  EXPORTED_MODELS,
} from '../src/domain/lgpd/dataRequest.js'

test('buildAnonymizedUserFields remove toda a PII da linha User', () => {
  const fields = buildAnonymizedUserFields('user-abc123def', new Date('2026-06-15T00:00:00Z'))
  assert.match(fields.email, /@anonimizado\.invalid$/)
  assert.equal(fields.contactPhone, null)
  assert.equal(fields.passwordHash, 'LGPD_ANONYMIZED')
  assert.equal(fields.termsAcceptedIp, null)
  assert.equal(fields.termsAcceptedUserAgent, null)
  assert.equal(fields.referralCode, null)
  assert.equal(fields.status, 'deleted')
})

test('redactUserForExport oculta o hash de senha', () => {
  const out = redactUserForExport({ id: 'u1', name: 'Fulano', passwordHash: 'segredo' })
  assert.equal(out.passwordHash, '[redigido]')
  assert.equal(out.name, 'Fulano')
})

test('Payment e AffiliateCommission NÃO estão na lista de purga (retenção financeira)', () => {
  assert.ok(!PURGED_MODELS.includes('payment'))
  assert.ok(!PURGED_MODELS.includes('affiliateCommission'))
  // mas dados operacionais com PII estão
  assert.ok(PURGED_MODELS.includes('messageLog'))
  assert.ok(PURGED_MODELS.includes('credential'))
  assert.ok(PURGED_MODELS.includes('scheduledMessage'))
})

test('collectUserExport reúne user redigido + modelos do titular', async () => {
  const db = {
    user: { findUnique: async () => ({ id: 'u1', name: 'Fulano', email: 'f@x.com', passwordHash: 'h' }) },
  }
  for (const model of EXPORTED_MODELS) {
    db[model] = { findMany: async ({ where }) => [{ id: `${model}-1`, userId: where.userId }] }
  }
  const data = await collectUserExport(db, 'u1', new Date('2026-06-15T00:00:00Z'))
  assert.equal(data.userId, 'u1')
  assert.equal(data.user.passwordHash, '[redigido]')
  assert.equal(data.group[0].userId, 'u1')
  assert.ok(data.exportedAt.startsWith('2026-06-15'))
})

test('collectUserExport lança quando usuário não existe', async () => {
  const db = { user: { findUnique: async () => null } }
  await assert.rejects(() => collectUserExport(db, 'nope'), (err) => err.code === 'USER_NOT_FOUND')
})

test('anonymizeUser apaga operacionais, preserva financeiro e anonimiza User', async () => {
  const deleted = []
  let updatedWith = null
  const db = {
    user: {
      findUnique: async () => ({ id: 'u1' }),
      update: async ({ data }) => { updatedWith = data; return { id: 'u1', ...data } },
    },
  }
  for (const model of PURGED_MODELS) {
    db[model] = { deleteMany: async ({ where }) => { deleted.push([model, where.userId]); return { count: 2 } } }
  }
  // modelos financeiros existem no db mas não devem ser tocados
  let paymentTouched = false
  db.payment = { deleteMany: async () => { paymentTouched = true; return { count: 99 } } }

  const summary = await anonymizeUser(db, 'u1', new Date('2026-06-15T00:00:00Z'))
  assert.equal(summary.anonymized, true)
  assert.equal(paymentTouched, false, 'Payment não pode ser apagado')
  assert.equal(deleted.length, PURGED_MODELS.length)
  assert.equal(summary.purged.messageLog, 2)
  assert.match(updatedWith.email, /@anonimizado\.invalid$/)
})

test('anonymizeUser lança quando usuário não existe', async () => {
  const db = { user: { findUnique: async () => null } }
  await assert.rejects(() => anonymizeUser(db, 'nope'), (err) => err.code === 'USER_NOT_FOUND')
})
