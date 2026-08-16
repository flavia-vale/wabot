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
      upsert: async ({ create, update }) => {
        cred = cred ? { ...cred, ...update } : { ...create }
        return cred
      },
    },
    getUpdateCalls: () => updateCalls,
  }
}

// Cache TTL puro (mercadolivreSessionProbeCache.js) é um módulo singleton —
// para não vazar estado entre testes/casos, cada teste usa um cache
// in-memory local injetado via opts (mesmo padrão do teste da Amazon).
function fakeProbeCache() {
  const store = new Map()
  return {
    getCachedProbe: (userId) => store.get(userId) ?? null,
    setCachedProbe: (userId, result) => { store.set(userId, result) },
    invalidateCachedProbe: (userId) => { store.delete(userId) },
    has: (userId) => store.has(userId),
  }
}

async function buildApp({ userId, db, checkMercadoLivreSession, probeCache = fakeProbeCache(), reloadConfig, getBotMetrics, restartStaleWorker }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, {
    db,
    checkMercadoLivreSession,
    getMlProbeCache: probeCache.getCachedProbe,
    setMlProbeCache: probeCache.setCachedProbe,
    invalidateMlProbeCache: probeCache.invalidateCachedProbe,
    reloadConfig: reloadConfig ?? (async () => true),
    getBotMetrics: getBotMetrics ?? (async () => null),
    restartStaleWorker: restartStaleWorker ?? (async () => ({ attempted: false, reason: 'test' })),
  })
  return app
}

function nextUserId() {
  return `ml-session-route-user-${++userCounter}-${Date.now()}`
}

function withEncryptionKey(fn) {
  const prev = process.env.CREDENTIAL_ENCRYPTION_KEY
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(64)
  return Promise.resolve(fn()).finally(() => {
    if (prev === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
    else process.env.CREDENTIAL_ENCRYPTION_KEY = prev
  })
}

// --- T008 (US1): persistência do credentialPatch cifrado (D-3) ---

test('GET /mercadolivre/session: persiste credentialPatch cifrado (D-3) sem expor no HTTP', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const originalData = { tag: '475630078', ssid: 'ssid-velho-0000000000' }
    const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify(originalData) })
    const checkMercadoLivreSession = async () => ({
      configured: true,
      alive: true,
      reason: 'ok',
      credentialPatch: { ssid: 'ssid-novo-00000000000' },
    })

    const app = await buildApp({ userId, db, checkMercadoLivreSession })
    const res = await app.inject({ method: 'GET', url: '/mercadolivre/session' })

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
    assert.equal(decrypted.ssid, 'ssid-novo-00000000000')
    assert.equal(decrypted.tag, '475630078')
  })
})

test('GET /mercadolivre/session: sem credentialPatch não chama db.credential.update', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', ssid: 'a'.repeat(20) }) })
    const checkMercadoLivreSession = async () => ({ configured: true, alive: true, reason: 'ok' })

    const app = await buildApp({ userId, db, checkMercadoLivreSession })
    const res = await app.inject({ method: 'GET', url: '/mercadolivre/session' })

    assert.equal(res.statusCode, 200)
    assert.equal(db.getUpdateCalls(), 0)
  })
})

test('GET /mercadolivre/session: network_error/busy (transitório) não persiste e não mascara o estado', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', ssid: 'a'.repeat(20) }) })
    const checkMercadoLivreSession = async () => ({ configured: true, alive: null, reason: 'network_error' })

    const app = await buildApp({ userId, db, checkMercadoLivreSession })
    const res = await app.inject({ method: 'GET', url: '/mercadolivre/session' })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.alive, null)
    assert.equal(body.reason, 'network_error')
    assert.equal(db.getUpdateCalls(), 0, 'transitório não é persistido como expiração')
  })
})

test('GET /mercadolivre/session: reason busy (lock) também é transitório — não persiste, resposta mantém alive:null', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', ssid: 'a'.repeat(20) }) })
    const checkMercadoLivreSession = async () => ({ configured: true, alive: null, reason: 'busy' })

    const app = await buildApp({ userId, db, checkMercadoLivreSession })
    const res = await app.inject({ method: 'GET', url: '/mercadolivre/session' })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.alive, null)
    assert.equal(body.reason, 'busy')
    assert.equal(db.getUpdateCalls(), 0)
  })
})

test('GET /mercadolivre/session: credencial não cadastrada devolve not_configured sem sondar nem cachear', async () => {
  const userId = nextUserId()
  const db = fakeDb(null)
  let calls = 0
  const checkMercadoLivreSession = async () => { calls++; return { configured: true, alive: true, reason: 'ok' } }

  const app = await buildApp({ userId, db, checkMercadoLivreSession })
  const res = await app.inject({ method: 'GET', url: '/mercadolivre/session' })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { configured: false, alive: null, reason: 'not_configured' })
  assert.equal(calls, 0)
})

// --- T012 (US3): cache TTL da sondagem ---

test('GET /mercadolivre/session: 2 chamadas consecutivas dentro da janela TTL só sondam o ML 1 vez', async () => {
  const userId = nextUserId()
  const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', ssid: 'a'.repeat(20) }) })
  let calls = 0
  const checkMercadoLivreSession = async () => {
    calls++
    return { configured: true, alive: true, reason: 'ok' }
  }
  const probeCache = fakeProbeCache()

  const app = await buildApp({ userId, db, checkMercadoLivreSession, probeCache })

  const res1 = await app.inject({ method: 'GET', url: '/mercadolivre/session' })
  const res2 = await app.inject({ method: 'GET', url: '/mercadolivre/session' })

  assert.equal(res1.statusCode, 200)
  assert.equal(res2.statusCode, 200)
  assert.equal(calls, 1, 'segunda chamada deve ser servida pelo cache, sem sondar o ML de novo')
  assert.deepEqual(JSON.parse(res1.body), JSON.parse(res2.body))
})

test('GET /mercadolivre/session: cache não é compartilhado entre usuários diferentes', async () => {
  const probeCache = fakeProbeCache()
  let calls = 0
  const checkMercadoLivreSession = async () => {
    calls++
    return { configured: true, alive: true, reason: 'ok' }
  }

  const userA = nextUserId()
  const dbA = fakeDb({ userId: userA, platform: 'mercadolivre', data: JSON.stringify({ tag: 'a-20', ssid: 'a'.repeat(20) }) })
  const appA = await buildApp({ userId: userA, db: dbA, checkMercadoLivreSession, probeCache })
  await appA.inject({ method: 'GET', url: '/mercadolivre/session' })

  const userB = nextUserId()
  const dbB = fakeDb({ userId: userB, platform: 'mercadolivre', data: JSON.stringify({ tag: 'b-20', ssid: 'b'.repeat(20) }) })
  const appB = await buildApp({ userId: userB, db: dbB, checkMercadoLivreSession, probeCache })
  await appB.inject({ method: 'GET', url: '/mercadolivre/session' })

  assert.equal(calls, 2, 'usuários diferentes não compartilham cache — cada um sonda 1 vez')
})

test('GET /mercadolivre/session: resultado transitório (alive:null) não é cacheado — próxima chamada sonda de novo', async () => {
  const userId = nextUserId()
  const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', ssid: 'a'.repeat(20) }) })
  let calls = 0
  const checkMercadoLivreSession = async () => {
    calls++
    return { configured: true, alive: null, reason: 'network_error' }
  }
  const probeCache = fakeProbeCache()

  const app = await buildApp({ userId, db, checkMercadoLivreSession, probeCache })

  const res1 = await app.inject({ method: 'GET', url: '/mercadolivre/session' })
  assert.equal(JSON.parse(res1.body).alive, null)
  assert.equal(probeCache.has(userId), false, 'resultado indeterminado não deve ser cacheado')

  const res2 = await app.inject({ method: 'GET', url: '/mercadolivre/session' })
  assert.equal(calls, 2, 'segunda chamada deve sondar de novo em vez de servir cache de um blip transitório')
  assert.equal(JSON.parse(res2.body).alive, null)
})

test('PUT /mercadolivre: o próprio save testa o código e deixa o resultado FRESCO em cache', async () => {
  await withEncryptionKey(async () => {
    const userId = nextUserId()
    const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', ssid: 'a'.repeat(20) }) })
    let calls = 0
    let currentAlive = false
    const checkMercadoLivreSession = async () => {
      calls++
      return { configured: true, alive: currentAlive, reason: currentAlive ? 'ok' : 'expired' }
    }
    const probeCache = fakeProbeCache()

    const app = await buildApp({ userId, db, checkMercadoLivreSession, probeCache })

    const res1 = await app.inject({ method: 'GET', url: '/mercadolivre/session' })
    assert.equal(JSON.parse(res1.body).alive, false)
    assert.equal(calls, 1)
    assert.equal(probeCache.has(userId), true, 'resultado definitivo (alive:false) deve estar em cache')

    // Usuária recadastra a credencial com um ssid novo e válido.
    currentAlive = true
    const putRes = await app.inject({
      method: 'PUT',
      url: '/mercadolivre',
      payload: { tag: '475630078', ssid: 'b'.repeat(20) },
    })
    assert.equal(putRes.statusCode, 200)
    // Mudança de contrato (RCA 2026-08-15): antes o PUT só INVALIDAVA o cache e
    // deixava o GET seguinte sondar. Agora o próprio save sonda — é assim que
    // ele consegue dizer na hora se o código funciona — e guarda o resultado
    // FRESCO. A garantia que importa continua valendo: nunca servir valor
    // stale. E gasta-se uma sondagem a menos por recadastro (na Amazon, uma
    // rotação de código a menos).
    assert.equal(calls, 2, 'o próprio PUT deve testar o código recém-colado')
    assert.equal(JSON.parse(putRes.body).sessionCheck.alive, true)
    assert.equal(probeCache.has(userId), true, 'o resultado fresco do save fica em cache')

    const res2 = await app.inject({ method: 'GET', url: '/mercadolivre/session' })
    assert.equal(calls, 2, 'GET após PUT não sonda de novo — serve o resultado fresco do save')
    assert.equal(JSON.parse(res2.body).alive, true, 'e o valor servido é o novo, nunca o stale')
  })
})
