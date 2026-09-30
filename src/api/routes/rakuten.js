// Contas Rakuten Advertising da cliente (docs/rca/afiliados-rakuten.md).
// Espelho de src/api/routes/awin.js. Disponível no Basic: só as ofertas
// automáticas que USAM as promoções são PRO.
//
// Isolamento: TODA consulta filtra por userId (req.user.sub). Client ID e
// Client Secret são só de escrita: entram cifrados, saem como ••••1234, e
// campo vazio na edição mantém o atual. Nunca logar corpo destas rotas.
// Nossas rotas nunca devolvem 401 por causa da Rakuten (o painel desloga a
// cliente em 401): dados recusados → 400 com frase leiga.

import dbDefault from '../../db.js'
import { encryptCredential } from '../../credentialCrypto.js'
import { credentialFingerprint, getDefaultRakutenClient, isValidClientField, isValidSid } from '../../integrations/rakuten/client.js'
import {
  RAKUTEN_ACCOUNT_STATUS,
  RAKUTEN_MESSAGES,
  presentRakutenAccount,
  presentRakutenSyncRun,
  secretLast4,
  testRakutenCredentials,
} from '../../integrations/rakuten/accountService.js'
import { decryptRakutenCreds, isRakutenAccountSyncing, syncRakutenAccount } from '../../integrations/rakuten/syncService.js'

const MAX_ACCOUNTS_PER_USER = 10
const LABEL_MAX = 60
const SID_ERROR = 'Digite só os números do SID (aparece no canto de cima da Rakuten, abaixo do seu nome).'
const CLIENT_ID_ERROR = 'Esse Client ID não parece certo. Copie de novo no portal de desenvolvedores da Rakuten.'
const CLIENT_SECRET_ERROR = 'Esse Client Secret não parece certo. Copie de novo no portal de desenvolvedores da Rakuten.'

function cleanLabel(value, fallback) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX)
  return text || fallback
}

function clean(value) {
  return String(value ?? '').trim()
}

export async function rakutenRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const client = opts.client ?? getDefaultRakutenClient()
  const sync = opts.syncFn ?? syncRakutenAccount
  const decrypt = opts.decrypt
  const now = opts.now ?? (() => new Date())

  async function ownedAccount(req) {
    return db.rakutenAccount.findFirst({ where: { id: String(req.params.id), userId: req.user.sub } })
  }

  async function activeCounts(userId) {
    const rows = await db.rakutenPromotion.groupBy({
      by: ['accountId'],
      where: { userId, status: 'active' },
      _count: { _all: true },
    })
    return new Map(rows.map((row) => [row.accountId, row._count._all]))
  }

  function storedCreds(row) {
    return decrypt ? decryptRakutenCreds(row, decrypt) : decryptRakutenCreds(row)
  }

  app.get('/accounts', { onRequest: [app.authenticate] }, async (req) => {
    const rows = await db.rakutenAccount.findMany({ where: { userId: req.user.sub }, orderBy: { createdAt: 'asc' } })
    const counts = await activeCounts(req.user.sub)
    return rows.map((row) => presentRakutenAccount(row, { activePromotions: counts.get(row.id) || 0 }))
  })

  app.post('/accounts', { onRequest: [app.authenticate] }, async (req, reply) => {
    const sid = clean(req.body?.sid)
    const clientId = clean(req.body?.clientId)
    const clientSecret = clean(req.body?.clientSecret)
    if (!isValidSid(sid)) return reply.code(400).send({ error: SID_ERROR })
    if (!isValidClientField(clientId)) return reply.code(400).send({ error: CLIENT_ID_ERROR })
    if (!isValidClientField(clientSecret)) return reply.code(400).send({ error: CLIENT_SECRET_ERROR })

    const count = await db.rakutenAccount.count({ where: { userId: req.user.sub } })
    if (count >= MAX_ACCOUNTS_PER_USER) return reply.code(400).send({ error: `Você pode cadastrar até ${MAX_ACCOUNTS_PER_USER} contas Rakuten.` })
    const duplicate = await db.rakutenAccount.findFirst({ where: { userId: req.user.sub, sid } })
    if (duplicate) return reply.code(409).send({ error: 'Esse SID já está cadastrado. Edite a conta que já existe.' })

    const creds = { clientId, clientSecret, sid }
    const test = await testRakutenCredentials({ client, creds })
    if (!test.ok && test.reason !== 'unavailable') return reply.code(400).send({ error: test.message, reason: test.reason })

    const at = now()
    const row = await db.rakutenAccount.create({
      data: {
        userId: req.user.sub,
        label: cleanLabel(req.body?.label, `Rakuten ${sid}`),
        sid,
        clientIdEncrypted: encryptCredential(clientId),
        clientIdLast4: secretLast4(clientId),
        clientSecretEncrypted: encryptCredential(clientSecret),
        clientSecretLast4: secretLast4(clientSecret),
        credentialFingerprint: credentialFingerprint(creds),
        status: test.ok ? RAKUTEN_ACCOUNT_STATUS.PENDING : RAKUTEN_ACCOUNT_STATUS.ERROR,
        statusDetail: test.ok ? null : test.message,
        lastTestAt: at,
        nextSyncAt: at,
      },
    })
    return reply.code(201).send({ account: presentRakutenAccount(row), test: { ok: test.ok, message: test.message } })
  })

  app.put('/accounts/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    const body = req.body ?? {}
    const updates = {}

    if (body.label !== undefined) updates.label = cleanLabel(body.label, existing.label)
    if (body.syncEnabled !== undefined) updates.syncEnabled = Boolean(body.syncEnabled)

    const sid = body.sid === undefined ? existing.sid : clean(body.sid)
    if (!isValidSid(sid)) return reply.code(400).send({ error: SID_ERROR })
    if (sid !== existing.sid) {
      const duplicate = await db.rakutenAccount.findFirst({ where: { userId: req.user.sub, sid, NOT: { id: existing.id } } })
      if (duplicate) return reply.code(409).send({ error: 'Esse SID já está cadastrado. Edite a conta que já existe.' })
      updates.sid = sid
    }

    // Campo vazio = manter o atual.
    const newClientId = clean(body.clientId)
    const newClientSecret = clean(body.clientSecret)
    if (newClientId && !isValidClientField(newClientId)) return reply.code(400).send({ error: CLIENT_ID_ERROR })
    if (newClientSecret && !isValidClientField(newClientSecret)) return reply.code(400).send({ error: CLIENT_SECRET_ERROR })

    let test = null
    if (newClientId || newClientSecret || updates.sid) {
      const current = storedCreds(existing)
      const creds = { clientId: newClientId || current.clientId, clientSecret: newClientSecret || current.clientSecret, sid }
      test = await testRakutenCredentials({ client, creds })
      if (!test.ok && test.reason !== 'unavailable') return reply.code(400).send({ error: test.message, reason: test.reason })
      const at = now()
      Object.assign(updates, {
        status: test.ok ? RAKUTEN_ACCOUNT_STATUS.PENDING : RAKUTEN_ACCOUNT_STATUS.ERROR,
        statusDetail: test.ok ? null : test.message,
        lastTestAt: at,
        nextSyncAt: at,
        credentialFingerprint: credentialFingerprint(creds),
      })
      if (newClientId) Object.assign(updates, { clientIdEncrypted: encryptCredential(newClientId), clientIdLast4: secretLast4(newClientId) })
      if (newClientSecret) Object.assign(updates, { clientSecretEncrypted: encryptCredential(newClientSecret), clientSecretLast4: secretLast4(newClientSecret) })
    }
    if (updates.syncEnabled === true && !existing.syncEnabled && !updates.nextSyncAt) updates.nextSyncAt = now()

    const row = await db.rakutenAccount.update({ where: { id: existing.id }, data: updates })
    return { account: presentRakutenAccount(row), test: test ? { ok: test.ok, message: test.message } : null }
  })

  app.delete('/accounts/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    // Automação que dependia desta conta fica pausada (não some).
    const paused = await db.offerAutomation.updateMany({
      where: { userId: req.user.sub, source: 'rakuten', rakutenAccountId: existing.id },
      data: { enabled: false, rakutenAccountId: null },
    })
    await db.rakutenAccount.deleteMany({ where: { id: existing.id, userId: req.user.sub } })
    return { ok: true, pausedAutomations: paused.count }
  })

  app.post('/accounts/:id/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    const test = await testRakutenCredentials({ client, creds: storedCreds(existing) })
    const at = now()
    const data = { lastTestAt: at }
    if (test.reason === 'auth') Object.assign(data, { status: RAKUTEN_ACCOUNT_STATUS.INVALID_CREDENTIAL, statusDetail: RAKUTEN_MESSAGES.auth, nextSyncAt: null })
    else if (test.ok && existing.status !== RAKUTEN_ACCOUNT_STATUS.OK) Object.assign(data, { status: RAKUTEN_ACCOUNT_STATUS.PENDING, statusDetail: null, nextSyncAt: existing.nextSyncAt ?? at })
    const row = await db.rakutenAccount.update({ where: { id: existing.id }, data })
    return { ok: test.ok, message: test.message, account: presentRakutenAccount(row) }
  })

  app.post('/accounts/:id/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    if (existing.status === RAKUTEN_ACCOUNT_STATUS.INVALID_CREDENTIAL) return reply.code(400).send({ error: RAKUTEN_MESSAGES.auth })
    if (isRakutenAccountSyncing(existing.id)) return reply.code(409).send({ error: 'Essa conta já está sendo atualizada. Espere um pouco.' })
    const result = await sync(existing.id, { db, client, now, trigger: 'manual', ...(decrypt ? { decrypt } : {}) })
    if (result?.skipped === 'busy') return reply.code(409).send({ error: 'Essa conta já está sendo atualizada. Espere um pouco.' })
    const row = await db.rakutenAccount.findFirst({ where: { id: existing.id, userId: req.user.sub } })
    const counts = await activeCounts(req.user.sub)
    return { result, account: row ? presentRakutenAccount(row, { activePromotions: counts.get(row.id) || 0 }) : null }
  })

  app.get('/accounts/:id/runs', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    const rows = await db.rakutenSyncRun.findMany({
      where: { accountId: existing.id, userId: req.user.sub },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })
    return rows.map(presentRakutenSyncRun)
  })

  // Lojas com promoção ativa nesta conta (filtro das ofertas automáticas).
  app.get('/accounts/:id/advertisers', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    const rows = await db.rakutenPromotion.groupBy({
      by: ['advertiserId', 'advertiserName'],
      where: { accountId: existing.id, userId: req.user.sub, status: 'active' },
      _count: { _all: true },
    })
    return rows
      .map((row) => ({ id: row.advertiserId, name: row.advertiserName, activePromotions: row._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  })

  // Amostra das promoções ativas (para a cliente conferir o que chegou).
  app.get('/accounts/:id/promotions', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Rakuten não encontrada.' })
    return db.rakutenPromotion.findMany({
      where: { accountId: existing.id, userId: req.user.sub, status: 'active' },
      orderBy: [{ endDate: 'asc' }],
      take: 50,
      select: { id: true, advertiserName: true, title: true, couponCode: true, startDate: true, endDate: true, clickUrl: true },
    })
  })
}
