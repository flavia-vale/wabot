// Rotas /api/awin: isolamento por cliente, código de acesso só de escrita,
// campo vazio mantém o código, teste de conexão e pausa das automações.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { awinRoutes } from '../src/api/routes/awin.js'
import { AwinAuthError } from '../src/integrations/awin/errors.js'

const TOKEN = 'tok-primeiro-codigo-da-awin-0001'
const TOKEN2 = 'tok-segundo-codigo-da-awin-0002'
let seq = 0

function fakeClient({ auth = true, accounts = ['2701264'] } = {}) {
  const calls = []
  return {
    calls,
    listAccounts: async (token) => {
      calls.push(token)
      if (!auth) throw new AwinAuthError(401)
      return { userId: 1, accounts: accounts.map((id) => ({ accountId: Number(id), accountName: `Empresa ${id}` })) }
    },
    listPromotions: async () => ({ data: [], pagination: { total: 0 } }),
  }
}

async function buildApp(client = fakeClient(), extra = {}) {
  const n = ++seq
  const userId = `awin-routes-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Awin', email: `${userId}@awin-routes.local`, passwordHash: 'x', plan: 'basic' } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(awinRoutes, { prefix: '/api/awin', client, ...extra })
  return { app, userId, client }
}

async function cleanup(ctx) {
  await db.offerAutomation.deleteMany({ where: { userId: ctx.userId } })
  await db.awinAccount.deleteMany({ where: { userId: ctx.userId } })
  await db.user.deleteMany({ where: { id: ctx.userId } })
  await ctx.app.close()
}

test('cadastro testa a conexão, cifra o código e nunca o devolve', async () => {
  const previousKey = process.env.CREDENTIAL_ENCRYPTION_KEY
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(64)
  const ctx = await buildApp()
  try {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })
    assert.equal(res.statusCode, 201)
    assert.ok(!res.body.includes(TOKEN), 'código voltou na resposta')
    const body = JSON.parse(res.body)
    assert.equal(body.account.tokenMasked, '••••0001')
    assert.equal(body.account.label, 'Empresa 2701264')
    assert.equal(body.test.ok, true)
    assert.equal(ctx.client.calls.length, 1)

    const stored = await db.awinAccount.findFirst({ where: { userId: ctx.userId } })
    assert.ok(stored.tokenEncrypted.startsWith('v1:'), 'código guardado cifrado')
    assert.ok(!stored.tokenEncrypted.includes(TOKEN))
    assert.ok(stored.nextSyncAt, 'primeiro sync já agendado')

    const list = await ctx.app.inject({ method: 'GET', url: '/api/awin/accounts' })
    assert.ok(!list.body.includes(TOKEN))
    assert.ok(!list.body.includes('tokenEncrypted'))
    assert.ok(!list.body.includes('tokenFingerprint'))
    assert.equal(JSON.parse(list.body)[0].tokenMasked, '••••0001')
  } finally {
    if (previousKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
    else process.env.CREDENTIAL_ENCRYPTION_KEY = previousKey
    await cleanup(ctx)
  }
})

test('código recusado ou conta que não é do código: não salva', async () => {
  const denied = await buildApp(fakeClient({ auth: false }))
  try {
    const res = await denied.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })
    assert.equal(res.statusCode, 400)
    assert.match(JSON.parse(res.body).error, /não aceitou o código de acesso/)
    assert.equal(await db.awinAccount.count({ where: { userId: denied.userId } }), 0)
  } finally { await cleanup(denied) }

  const other = await buildApp(fakeClient({ accounts: ['999'] }))
  try {
    const res = await other.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })
    assert.equal(res.statusCode, 400)
    assert.equal(JSON.parse(res.body).reason, 'publisher_not_found')
    assert.match(JSON.parse(res.body).error, /10 minutos/)
  } finally { await cleanup(other) }
})

test('validação do formulário: número da conta só com dígitos e código obrigatório', async () => {
  const ctx = await buildApp()
  try {
    assert.equal((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: 'abc', token: TOKEN } })).statusCode, 400)
    assert.equal((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: '' } })).statusCode, 400)
    assert.equal((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: 'curto' } })).statusCode, 400)
    assert.equal(ctx.client.calls.length, 0)
  } finally { await cleanup(ctx) }
})

test('edição: código vazio mantém o atual; código novo reativa conta com código recusado', async () => {
  const ctx = await buildApp()
  try {
    const created = JSON.parse((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })).body)
    const id = created.account.id
    const before = await db.awinAccount.findUnique({ where: { id } })

    const keep = await ctx.app.inject({ method: 'PUT', url: `/api/awin/accounts/${id}`, payload: { label: 'Minha Awin', token: '' } })
    assert.equal(keep.statusCode, 200)
    const kept = await db.awinAccount.findUnique({ where: { id } })
    assert.equal(kept.tokenEncrypted, before.tokenEncrypted)
    assert.equal(kept.label, 'Minha Awin')
    assert.equal(ctx.client.calls.length, 1, 'sem código novo não testa de novo')

    await db.awinAccount.update({ where: { id }, data: { status: 'invalid_credential', nextSyncAt: null } })
    const renewed = await ctx.app.inject({ method: 'PUT', url: `/api/awin/accounts/${id}`, payload: { token: TOKEN2 } })
    assert.equal(renewed.statusCode, 200)
    assert.ok(!renewed.body.includes(TOKEN2))
    const after = await db.awinAccount.findUnique({ where: { id } })
    assert.equal(after.status, 'pending')
    assert.ok(after.nextSyncAt)
    assert.equal(after.tokenLast4, '0002')
    assert.equal(ctx.client.calls.at(-1), TOKEN2)
  } finally { await cleanup(ctx) }
})

test('isolamento: uma cliente não vê, não edita, não testa e não apaga a conta da outra', async () => {
  const owner = await buildApp()
  const intruder = await buildApp()
  try {
    const { account } = JSON.parse((await owner.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })).body)
    assert.deepEqual(JSON.parse((await intruder.app.inject({ method: 'GET', url: '/api/awin/accounts' })).body), [])
    for (const [method, suffix] of [['PUT', ''], ['DELETE', ''], ['POST', '/test'], ['POST', '/sync'], ['GET', '/runs'], ['GET', '/advertisers'], ['GET', '/promotions']]) {
      const res = await intruder.app.inject({ method, url: `/api/awin/accounts/${account.id}${suffix}`, payload: method === 'GET' || method === 'DELETE' ? undefined : { label: 'x' } })
      assert.equal(res.statusCode, 404, `${method} ${suffix}`)
    }
    assert.equal(await db.awinAccount.count({ where: { id: account.id } }), 1)
  } finally {
    await cleanup(owner)
    await cleanup(intruder)
  }
})

test('conta repetida é recusada', async () => {
  const ctx = await buildApp()
  try {
    await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })
    const dup = await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN2 } })
    assert.equal(dup.statusCode, 409)
  } finally { await cleanup(ctx) }
})

test('"Testar conexão" com código recusado marca a conta e para o agendamento', async () => {
  const client = fakeClient()
  const ctx = await buildApp(client)
  try {
    const { account } = JSON.parse((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })).body)
    client.listAccounts = async () => { throw new AwinAuthError(403) }
    const res = await ctx.app.inject({ method: 'POST', url: `/api/awin/accounts/${account.id}/test` })
    assert.equal(JSON.parse(res.body).ok, false)
    const row = await db.awinAccount.findUnique({ where: { id: account.id } })
    assert.equal(row.status, 'invalid_credential')
    assert.equal(row.nextSyncAt, null)
    const sync = await ctx.app.inject({ method: 'POST', url: `/api/awin/accounts/${account.id}/sync` })
    assert.equal(sync.statusCode, 400)
  } finally { await cleanup(ctx) }
})

test('"Atualizar agora" roda o sync da conta e devolve o histórico', async () => {
  const ctx = await buildApp()
  try {
    const { account } = JSON.parse((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })).body)
    const res = await ctx.app.inject({ method: 'POST', url: `/api/awin/accounts/${account.id}/sync` })
    assert.equal(res.statusCode, 200)
    assert.equal(JSON.parse(res.body).result.status, 'success')
    const runs = JSON.parse((await ctx.app.inject({ method: 'GET', url: `/api/awin/accounts/${account.id}/runs` })).body)
    assert.equal(runs.length, 1)
    assert.equal(runs[0].trigger, 'manual')
  } finally { await cleanup(ctx) }
})

test('apagar a conta pausa as automações que dependiam dela', async () => {
  const ctx = await buildApp()
  try {
    const { account } = JSON.parse((await ctx.app.inject({ method: 'POST', url: '/api/awin/accounts', payload: { publisherId: '2701264', token: TOKEN } })).body)
    const automation = await db.offerAutomation.create({ data: { userId: ctx.userId, keyword: '', intervalMinutes: 60, source: 'awin', awinAccountId: account.id, destGroupJid: '1@g.us' } })
    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/awin/accounts/${account.id}` })
    assert.equal(JSON.parse(res.body).pausedAutomations, 1)
    const after = await db.offerAutomation.findUnique({ where: { id: automation.id } })
    assert.equal(after.enabled, false)
    assert.equal(after.awinAccountId, null)
  } finally { await cleanup(ctx) }
})
