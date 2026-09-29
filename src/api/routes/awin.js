// Contas Awin da cliente (docs/rca/afiliados-awin.md). Disponível no Basic:
// só as ofertas automáticas que USAM as promoções são PRO.
//
// Isolamento: TODA consulta filtra por userId (req.user.sub). O código de
// acesso é só de escrita: entra cifrado, sai como ••••1234, e campo vazio na
// edição mantém o atual. Nunca logar corpo destas rotas.

import dbDefault from '../../db.js'
import { decryptCredential, encryptCredential } from '../../credentialCrypto.js'
import { getDefaultAwinClient, isValidPublisherId, tokenFingerprint } from '../../integrations/awin/client.js'
import {
  AWIN_ACCOUNT_STATUS,
  AWIN_MESSAGES,
  presentAwinAccount,
  presentAwinSyncRun,
  testAwinCredentials,
  tokenLast4,
} from '../../integrations/awin/accountService.js'
import { isAwinAccountSyncing, syncAwinAccount } from '../../integrations/awin/syncService.js'

const MAX_ACCOUNTS_PER_USER = 10
const LABEL_MAX = 60
const TOKEN_MIN = 16
const TOKEN_MAX = 4096

function cleanLabel(value, fallback) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX)
  return text || fallback
}

function cleanToken(value) {
  return String(value ?? '').trim()
}

function tokenShapeError(token) {
  if (token.length < TOKEN_MIN || token.length > TOKEN_MAX || /\s/.test(token)) {
    return 'Esse código de acesso não parece certo. Copie de novo o código inteiro na Awin.'
  }
  return null
}

export async function awinRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const client = opts.client ?? getDefaultAwinClient()
  const sync = opts.syncFn ?? syncAwinAccount
  const now = opts.now ?? (() => new Date())

  async function ownedAccount(req) {
    return db.awinAccount.findFirst({ where: { id: String(req.params.id), userId: req.user.sub } })
  }

  async function activeCounts(userId) {
    const rows = await db.awinPromotion.groupBy({
      by: ['accountId'],
      where: { userId, status: 'active' },
      _count: { _all: true },
    })
    return new Map(rows.map((row) => [row.accountId, row._count._all]))
  }

  app.get('/accounts', { onRequest: [app.authenticate] }, async (req) => {
    const rows = await db.awinAccount.findMany({ where: { userId: req.user.sub }, orderBy: { createdAt: 'asc' } })
    const counts = await activeCounts(req.user.sub)
    return rows.map((row) => presentAwinAccount(row, { activePromotions: counts.get(row.id) || 0 }))
  })

  app.post('/accounts', { onRequest: [app.authenticate] }, async (req, reply) => {
    const publisherId = String(req.body?.publisherId ?? '').trim()
    const token = cleanToken(req.body?.token)
    if (!isValidPublisherId(publisherId)) return reply.code(400).send({ error: 'Digite só os números da sua conta na Awin.' })
    if (!token) return reply.code(400).send({ error: 'Cole o código de acesso da Awin.' })
    const shapeError = tokenShapeError(token)
    if (shapeError) return reply.code(400).send({ error: shapeError })

    const count = await db.awinAccount.count({ where: { userId: req.user.sub } })
    if (count >= MAX_ACCOUNTS_PER_USER) return reply.code(400).send({ error: `Você pode cadastrar até ${MAX_ACCOUNTS_PER_USER} contas Awin.` })
    const duplicate = await db.awinAccount.findFirst({ where: { userId: req.user.sub, publisherId } })
    if (duplicate) return reply.code(409).send({ error: 'Essa conta Awin já está cadastrada. Edite a que já existe.' })

    const test = await testAwinCredentials({ client, token, publisherId })
    if (!test.ok && test.reason !== 'unavailable') return reply.code(400).send({ error: test.message, reason: test.reason })

    const at = now()
    const row = await db.awinAccount.create({
      data: {
        userId: req.user.sub,
        label: cleanLabel(req.body?.label, test.accountName || `Conta ${publisherId}`),
        publisherId,
        tokenEncrypted: encryptCredential(token),
        tokenLast4: tokenLast4(token),
        tokenFingerprint: tokenFingerprint(token),
        status: test.ok ? AWIN_ACCOUNT_STATUS.PENDING : AWIN_ACCOUNT_STATUS.ERROR,
        statusDetail: test.ok ? null : test.message,
        lastTestAt: at,
        nextSyncAt: at,
      },
    })
    return reply.code(201).send({ account: presentAwinAccount(row), test: { ok: test.ok, message: test.message } })
  })

  app.put('/accounts/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    const body = req.body ?? {}
    const updates = {}

    if (body.label !== undefined) updates.label = cleanLabel(body.label, existing.label)
    if (body.syncEnabled !== undefined) updates.syncEnabled = Boolean(body.syncEnabled)

    const publisherId = body.publisherId === undefined ? existing.publisherId : String(body.publisherId).trim()
    if (!isValidPublisherId(publisherId)) return reply.code(400).send({ error: 'Digite só os números da sua conta na Awin.' })
    if (publisherId !== existing.publisherId) {
      const duplicate = await db.awinAccount.findFirst({ where: { userId: req.user.sub, publisherId, NOT: { id: existing.id } } })
      if (duplicate) return reply.code(409).send({ error: 'Essa conta Awin já está cadastrada. Edite a que já existe.' })
      updates.publisherId = publisherId
    }

    // Campo vazio = manter o código atual.
    const newToken = cleanToken(body.token)
    if (newToken) {
      const shapeError = tokenShapeError(newToken)
      if (shapeError) return reply.code(400).send({ error: shapeError })
    }

    let test = null
    if (newToken || updates.publisherId) {
      const token = newToken || decryptCredential(existing.tokenEncrypted)
      test = await testAwinCredentials({ client, token, publisherId })
      if (!test.ok && test.reason !== 'unavailable') return reply.code(400).send({ error: test.message, reason: test.reason })
      const at = now()
      Object.assign(updates, {
        status: test.ok ? AWIN_ACCOUNT_STATUS.PENDING : AWIN_ACCOUNT_STATUS.ERROR,
        statusDetail: test.ok ? null : test.message,
        lastTestAt: at,
        nextSyncAt: at,
      })
      if (newToken) {
        Object.assign(updates, {
          tokenEncrypted: encryptCredential(newToken),
          tokenLast4: tokenLast4(newToken),
          tokenFingerprint: tokenFingerprint(newToken),
        })
      }
    }
    if (updates.syncEnabled === true && !existing.syncEnabled && !updates.nextSyncAt) updates.nextSyncAt = now()

    const row = await db.awinAccount.update({ where: { id: existing.id }, data: updates })
    return { account: presentAwinAccount(row), test: test ? { ok: test.ok, message: test.message } : null }
  })

  app.delete('/accounts/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    // Automação que dependia desta conta fica pausada (não some): a cliente
    // decide se troca a conta ou apaga.
    const paused = await db.offerAutomation.updateMany({
      where: { userId: req.user.sub, source: 'awin', awinAccountId: existing.id },
      data: { enabled: false, awinAccountId: null },
    })
    await db.awinAccount.deleteMany({ where: { id: existing.id, userId: req.user.sub } })
    return { ok: true, pausedAutomations: paused.count }
  })

  app.post('/accounts/:id/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    const test = await testAwinCredentials({ client, token: decryptCredential(existing.tokenEncrypted), publisherId: existing.publisherId })
    const at = now()
    const data = { lastTestAt: at }
    if (test.reason === 'auth') Object.assign(data, { status: AWIN_ACCOUNT_STATUS.INVALID_CREDENTIAL, statusDetail: AWIN_MESSAGES.auth, nextSyncAt: null })
    else if (test.reason === 'publisher_not_found') Object.assign(data, { status: AWIN_ACCOUNT_STATUS.ERROR, statusDetail: test.message })
    else if (test.ok && existing.status !== AWIN_ACCOUNT_STATUS.OK) Object.assign(data, { status: AWIN_ACCOUNT_STATUS.PENDING, statusDetail: null, nextSyncAt: existing.nextSyncAt ?? at })
    const row = await db.awinAccount.update({ where: { id: existing.id }, data })
    return { ok: test.ok, message: test.message, account: presentAwinAccount(row) }
  })

  app.post('/accounts/:id/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    if (existing.status === AWIN_ACCOUNT_STATUS.INVALID_CREDENTIAL) return reply.code(400).send({ error: AWIN_MESSAGES.auth })
    if (isAwinAccountSyncing(existing.id)) return reply.code(409).send({ error: 'Essa conta já está sendo atualizada. Espere um pouco.' })
    const result = await sync(existing.id, { db, client, now, trigger: 'manual' })
    if (result?.skipped === 'busy') return reply.code(409).send({ error: 'Essa conta já está sendo atualizada. Espere um pouco.' })
    const row = await db.awinAccount.findFirst({ where: { id: existing.id, userId: req.user.sub } })
    const counts = await activeCounts(req.user.sub)
    return { result, account: row ? presentAwinAccount(row, { activePromotions: counts.get(row.id) || 0 }) : null }
  })

  app.get('/accounts/:id/runs', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    const rows = await db.awinSyncRun.findMany({
      where: { accountId: existing.id, userId: req.user.sub },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })
    return rows.map(presentAwinSyncRun)
  })

  // Lojas com promoção ativa nesta conta (filtro das ofertas automáticas).
  app.get('/accounts/:id/advertisers', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await ownedAccount(req)
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    const rows = await db.awinPromotion.groupBy({
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
    if (!existing) return reply.code(404).send({ error: 'Conta Awin não encontrada.' })
    const rows = await db.awinPromotion.findMany({
      where: { accountId: existing.id, userId: req.user.sub, status: 'active' },
      orderBy: [{ endDate: 'asc' }],
      take: 50,
      select: { id: true, advertiserName: true, title: true, description: true, startDate: true, endDate: true, urlTracking: true },
    })
    return rows
  })
}
