import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { credentialsRoutes } from '../src/api/routes/credentials.js'
import { decryptCredential } from '../src/credentialCrypto.js'

let userCounter = 0

function fakeDb(initialCred) {
  let cred = initialCred
  let updateCalls = 0
  return {
    credential: {
      findUnique: async () => cred,
      update: async ({ data }) => {
        updateCalls++
        cred = { ...cred, ...data }
        return cred
      },
    },
    getUpdateCalls: () => updateCalls,
  }
}

// Cache TTL puro (amazonSessionProbeCache.js) é um módulo singleton — para não
// vazar estado entre testes/casos, cada teste usa `getCachedProbe`/`setCachedProbe`
// isolados via injeção (não o módulo real), como um cache in-memory local ao teste.
function fakeProbeCache() {
  const store = new Map()
  return {
    getCachedProbe: (userId) => store.get(userId) ?? null,
    setCachedProbe: (userId, result) => { store.set(userId, result) },
  }
}

async function buildApp({ userId, db, checkAmazonSession, probeCache = fakeProbeCache() }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, {
    db,
    checkAmazonSession,
    getCachedProbe: probeCache.getCachedProbe,
    setCachedProbe: probeCache.setCachedProbe,
  })
  return app
}

function nextUserId() {
  return `amz-session-route-user-${++userCounter}-${Date.now()}`
}

function withEncryptionKey(fn) {
  const prev = process.env.CREDENTIAL_ENCRYPTION_KEY
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(64)
  return Promise.resolve(fn()).finally(() => {
    if (prev === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
    else process.env.CREDENTIAL_ENCRYPTION_KEY = prev
  })
}

test('GET /amazon/session: persiste credentialPatch cifrado (D-3) sem expor no HTTP', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const originalData = { tag: 'x-20', cookie: 'session-token=tokVelho' }
    const db = fakeDb({ userId, platform: 'amazon', data: JSON.stringify(originalData) })
    const checkAmazonSession = async () => ({
      configured: true,
      alive: true,
      reason: 'ok',
      credentialPatch: { cookie: 'session-token=tokNOVO' },
    })

    const app = await buildApp({ userId, db, checkAmazonSession })
    const res = await app.inject({ method: 'GET', url: '/amazon/session' })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.configured, true)
    assert.equal(body.alive, true)
    assert.equal(body.reason, 'ok')
    assert.ok(body.checkedAt)
    assert.equal('credentialPatch' in body, false, 'credentialPatch nunca aparece na resposta HTTP')

    assert.equal(db.getUpdateCalls(), 1)
    const stored = (await db.credential.findUnique()).data
    assert.match(stored, /^v1:/, 'Credential.data cifrado com prefixo v1: (D-3)')
    const decrypted = JSON.parse(decryptCredential(stored))
    assert.equal(decrypted.cookie, 'session-token=tokNOVO')
    assert.equal(decrypted.tag, 'x-20')
  })
})

test('GET /amazon/session: sem credentialPatch não chama db.credential.update', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const db = fakeDb({ userId, platform: 'amazon', data: JSON.stringify({ tag: 'x-20', cookie: 'a=1' }) })
    const checkAmazonSession = async () => ({ configured: true, alive: true, reason: 'ok' })

    const app = await buildApp({ userId, db, checkAmazonSession })
    const res = await app.inject({ method: 'GET', url: '/amazon/session' })

    assert.equal(res.statusCode, 200)
    assert.equal(db.getUpdateCalls(), 0)
  })
})

test('GET /amazon/session: network_error (transitório) não persiste e não mascara o estado', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const db = fakeDb({ userId, platform: 'amazon', data: JSON.stringify({ tag: 'x-20', cookie: 'a=1' }) })
    const checkAmazonSession = async () => ({ configured: true, alive: null, reason: 'network_error' })

    const app = await buildApp({ userId, db, checkAmazonSession })
    const res = await app.inject({ method: 'GET', url: '/amazon/session' })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.alive, null)
    assert.equal(body.reason, 'network_error')
    assert.equal(db.getUpdateCalls(), 0, 'transitório não é persistido como expiração')
  })
})

test('GET /amazon/session: 2 chamadas consecutivas dentro da janela TTL só sondam a Amazon 1 vez', async () => {
  const userId = nextUserId()
  const db = fakeDb({ userId, platform: 'amazon', data: JSON.stringify({ tag: 'x-20', cookie: 'a=1' }) })
  let calls = 0
  const checkAmazonSession = async () => {
    calls++
    return { configured: true, alive: true, reason: 'ok' }
  }
  const probeCache = fakeProbeCache()

  const app = await buildApp({ userId, db, checkAmazonSession, probeCache })

  const res1 = await app.inject({ method: 'GET', url: '/amazon/session' })
  const res2 = await app.inject({ method: 'GET', url: '/amazon/session' })

  assert.equal(res1.statusCode, 200)
  assert.equal(res2.statusCode, 200)
  assert.equal(calls, 1, 'segunda chamada deve ser servida pelo cache, sem sondar a Amazon de novo')
  assert.deepEqual(JSON.parse(res1.body), JSON.parse(res2.body))
})

test('GET /amazon/session: cache não é compartilhado entre usuários diferentes', async () => {
  const probeCache = fakeProbeCache()
  let calls = 0
  const checkAmazonSession = async () => {
    calls++
    return { configured: true, alive: true, reason: 'ok' }
  }

  const userA = nextUserId()
  const dbA = fakeDb({ userId: userA, platform: 'amazon', data: JSON.stringify({ tag: 'a-20', cookie: 'a=1' }) })
  const appA = await buildApp({ userId: userA, db: dbA, checkAmazonSession, probeCache })
  await appA.inject({ method: 'GET', url: '/amazon/session' })

  const userB = nextUserId()
  const dbB = fakeDb({ userId: userB, platform: 'amazon', data: JSON.stringify({ tag: 'b-20', cookie: 'b=1' }) })
  const appB = await buildApp({ userId: userB, db: dbB, checkAmazonSession, probeCache })
  await appB.inject({ method: 'GET', url: '/amazon/session' })

  assert.equal(calls, 2, 'usuários diferentes não compartilham cache — cada um sonda 1 vez')
})

test('GET /amazon/session: credencial não cadastrada devolve not_configured sem sondar nem cachear', async () => {
  const userId = nextUserId()
  const db = fakeDb(null)
  let calls = 0
  const checkAmazonSession = async () => { calls++; return { configured: true, alive: true, reason: 'ok' } }

  const app = await buildApp({ userId, db, checkAmazonSession })
  const res = await app.inject({ method: 'GET', url: '/amazon/session' })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { configured: false, alive: null, reason: 'not_configured' })
  assert.equal(calls, 0)
})
