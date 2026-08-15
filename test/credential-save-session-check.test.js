import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { credentialsRoutes } from '../src/api/routes/credentials.js'
import { describeSaveSessionCheck, platformSupportsSessionCheck } from '../src/credentialSaveCheck.js'

// RCA 2026-08-15: salvar o código de acesso respondia "Tudo certo!" mesmo quando
// a loja recusa o código. Um cliente novo salvou 17 vezes em 4h30 sem descobrir
// que o código não servia — o painel dizia verde toda vez.

// ===== Módulo puro: qual frase e qual cor =====

const VALIDATION_OK = { configured: true, label: 'Mercado Livre', warnings: [], missing: [], status: 'configured' }

test('loja recusou o código: banner vermelho e frase que manda pegar um novo', () => {
  const out = describeSaveSessionCheck({
    platform: 'mercadolivre',
    validation: VALIDATION_OK,
    probe: { configured: true, alive: false, reason: 'expired' },
    fallbackMessage: 'Tudo certo! A Mercado Livre está pronta.',
  })
  assert.equal(out.tone, 'error')
  assert.match(out.message, /não aceitou esse código de acesso/i)
  assert.match(out.message, /cole aqui/i)
  // Não pode dizer que parou de enviar — o plano B segue enviando (AGENTS.md).
  assert.match(out.message, /continuam saindo/i)
  assert.doesNotMatch(out.message, /pausad/i)
})

test('código funcionando: diz que testamos agora (o verde passa a significar algo)', () => {
  const out = describeSaveSessionCheck({
    platform: 'mercadolivre',
    validation: VALIDATION_OK,
    probe: { configured: true, alive: true, reason: 'ok' },
    fallbackMessage: 'Tudo certo!',
  })
  assert.equal(out.tone, 'success')
  assert.match(out.message, /Testamos agora/i)
})

test('não deu para testar: nunca afirma que funciona nem que não funciona', () => {
  for (const probe of [
    { configured: true, alive: null, reason: 'network_error' },
    { configured: true, alive: null, reason: 'rate_limited' },
    { configured: true, alive: null, reason: 'check_failed' },
    null,
  ]) {
    const out = describeSaveSessionCheck({ platform: 'amazon', validation: { ...VALIDATION_OK, label: 'Amazon' }, probe, fallbackMessage: 'Tudo certo!' })
    assert.equal(out.tone, 'warn', `probe=${JSON.stringify(probe)}`)
    assert.match(out.message, /não deu para testar/i)
    assert.doesNotMatch(out.message, /não aceitou/i)
  }
})

test('loja sem código de acesso (Shopee/Magalu) mantém a mensagem histórica', () => {
  assert.equal(platformSupportsSessionCheck('shopee'), false)
  assert.equal(platformSupportsSessionCheck('magalu'), false)
  const out = describeSaveSessionCheck({
    platform: 'shopee',
    validation: { configured: true, label: 'Shopee', warnings: [] },
    probe: null,
    fallbackMessage: 'Tudo certo! A Shopee está pronta.',
  })
  assert.equal(out.tone, 'success')
  assert.equal(out.message, 'Tudo certo! A Shopee está pronta.')
})

test('campo faltando continua com a mensagem de campo faltando', () => {
  const out = describeSaveSessionCheck({
    platform: 'mercadolivre',
    validation: { configured: false, missing: ['ssid'], label: 'Mercado Livre' },
    probe: null,
    fallbackMessage: 'Faltou preencher o código de acesso da Mercado Livre.',
  })
  assert.equal(out.tone, 'error')
  assert.equal(out.message, 'Faltou preencher o código de acesso da Mercado Livre.')
})

test('nenhuma mensagem usa jargão técnico na tela', () => {
  const probes = [{ alive: false, reason: 'expired' }, { alive: true, reason: 'ok' }, { alive: null, reason: 'network_error' }]
  for (const platform of ['mercadolivre', 'amazon']) {
    for (const probe of probes) {
      const { message } = describeSaveSessionCheck({
        platform,
        validation: { ...VALIDATION_OK, label: platform },
        probe,
        fallbackMessage: 'x',
      })
      assert.doesNotMatch(message, /ssid|cookie|sess[ãa]o expirada|partner_id|\?tag=|token/i, `${platform}/${probe.reason}: ${message}`)
    }
  }
})

// ===== Rota: o save testa de verdade, e nunca deixa de salvar =====

function fakeDb() {
  let cred = null
  return {
    credential: {
      findUnique: async () => cred,
      update: async ({ data }) => { cred = { ...cred, ...data }; return cred },
      upsert: async ({ create, update }) => { cred = cred ? { ...cred, ...update } : { ...create }; return cred },
    },
    current: () => cred,
  }
}

function fakeProbeCache() {
  const store = new Map()
  return {
    getCachedProbe: (userId) => store.get(userId) ?? null,
    setCachedProbe: (userId, result) => { store.set(userId, result) },
    invalidateCachedProbe: (userId) => { store.delete(userId) },
    has: (userId) => store.has(userId),
  }
}

async function buildApp({ userId, db, checkMercadoLivreSession, probeCache }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, {
    db,
    checkMercadoLivreSession,
    getMlProbeCache: probeCache.getCachedProbe,
    setMlProbeCache: probeCache.setCachedProbe,
    invalidateMlProbeCache: probeCache.invalidateCachedProbe,
    reloadConfig: async () => true,
    getBotMetrics: async () => null,
    restartStaleWorker: async () => ({ attempted: false, reason: 'test' }),
  })
  return app
}

function withEncryptionKey(fn) {
  const prev = process.env.CREDENTIAL_ENCRYPTION_KEY
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(64)
  return Promise.resolve(fn()).finally(() => {
    if (prev === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
    else process.env.CREDENTIAL_ENCRYPTION_KEY = prev
  })
}

const ML_BODY = { tag: 'minha-etiqueta', ssid: 'ghy-0000000000000000000000000000' }

test('PUT credenciais: código recusado responde 200, salva, e devolve tom de erro', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const probeCache = fakeProbeCache()
    const app = await buildApp({
      userId: 'u-recusado',
      db,
      checkMercadoLivreSession: async () => ({ configured: true, alive: false, reason: 'expired' }),
      probeCache,
    })
    const res = await app.inject({ method: 'PUT', url: '/mercadolivre', payload: ML_BODY })
    assert.equal(res.statusCode, 200, 'a credencial precisa ser salva mesmo quando a loja recusa')
    const body = res.json()
    assert.equal(body.messageTone, 'error')
    assert.equal(body.sessionCheck.alive, false)
    assert.match(body.message, /não aceitou/i)
    assert.ok(db.current(), 'a credencial foi gravada')
    await app.close()
  })
})

test('PUT credenciais: código válido devolve tom de sucesso e popula o cache (evita 2a sondagem)', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const probeCache = fakeProbeCache()
    let probes = 0
    const app = await buildApp({
      userId: 'u-ok',
      db,
      checkMercadoLivreSession: async () => { probes += 1; return { configured: true, alive: true, reason: 'ok' } },
      probeCache,
    })
    const res = await app.inject({ method: 'PUT', url: '/mercadolivre', payload: ML_BODY })
    const body = res.json()
    assert.equal(body.messageTone, 'success')
    assert.equal(body.sessionCheck.alive, true)
    assert.equal(probes, 1)
    assert.equal(probeCache.has('u-ok'), true, 'o resultado precisa ficar em cache para o painel não sondar de novo')
    await app.close()
  })
})

test('PUT credenciais: sondagem que explode não vira "seu código não funciona"', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const probeCache = fakeProbeCache()
    const app = await buildApp({
      userId: 'u-erro',
      db,
      checkMercadoLivreSession: async () => { throw new Error('conexão caiu') },
      probeCache,
    })
    const res = await app.inject({ method: 'PUT', url: '/mercadolivre', payload: ML_BODY })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.messageTone, 'warn')
    assert.equal(body.sessionCheck.alive, null)
    assert.match(body.message, /não deu para testar/i)
    assert.equal(probeCache.has('u-erro'), false, 'resultado indeterminado não pode ser cacheado')
    await app.close()
  })
})

test('PUT credenciais: rotação de código devolvida pela sondagem é persistida', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const probeCache = fakeProbeCache()
    const app = await buildApp({
      userId: 'u-rot',
      db,
      checkMercadoLivreSession: async () => ({ configured: true, alive: true, reason: 'ok', credentialPatch: { csrf: 'csrf-novo' } }),
      probeCache,
    })
    const res = await app.inject({ method: 'PUT', url: '/mercadolivre', payload: ML_BODY })
    const body = res.json()
    assert.equal(body.sessionCheck.alive, true)
    assert.equal(body.sessionCheck.credentialPatch, undefined, 'patch é detalhe interno, não vai para a tela')
    assert.equal(body.data.csrf, undefined, 'a resposta reflete o corpo salvo; o patch entra na linha do banco')
    await app.close()
  })
})

test('PUT credenciais: campo faltando continua 400 e NÃO chama a loja', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const probeCache = fakeProbeCache()
    let probes = 0
    const app = await buildApp({
      userId: 'u-400',
      db,
      checkMercadoLivreSession: async () => { probes += 1; return { configured: true, alive: true, reason: 'ok' } },
      probeCache,
    })
    const res = await app.inject({ method: 'PUT', url: '/mercadolivre', payload: { tag: 'so-a-etiqueta' } })
    assert.equal(res.statusCode, 400)
    assert.equal(probes, 0, 'sem código preenchido não faz sentido gastar uma sondagem')
    await app.close()
  })
})
