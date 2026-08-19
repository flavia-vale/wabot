// T075 (specs/012-shein-store-support): o painel manda a cliente colar o link
// do Gerador de Link da SHEIN — um oneLink (`onelink.shein.com/...`) — mas
// `validateCredentialData` é pura/offline e não consegue extrair o número
// dele (só aparece depois de resolver o link pela rede). Antes deste fix, o
// cadastro recusava exatamente o que a instrução mandava colar, com uma
// mensagem que pedia de volta a mesma coisa colada.
//
// A rota PUT /credentials/shein agora resolve o oneLink (reusando
// `resolveSheinShortLink`) e persiste o número extraído. Sem rede real:
// `resolveSheinShortLink` é injetado.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { credentialsRoutes } from '../src/api/routes/credentials.js'

let userCounter = 0
function nextUserId() {
  return `shein-onelink-route-user-${++userCounter}-${Date.now()}`
}

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

async function buildApp({ userId, db, resolveSheinShortLink }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, {
    db,
    resolveSheinShortLink,
    reloadConfig: async () => true,
    getBotMetrics: async () => null,
    restartStaleWorker: async () => ({ attempted: false, reason: 'test' }),
  })
  return app
}

function withEncryptionKey(fn) {
  const prev = process.env.CREDENTIAL_ENCRYPTION_KEY
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'b'.repeat(64)
  return Promise.resolve(fn()).finally(() => {
    if (prev === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
    else process.env.CREDENTIAL_ENCRYPTION_KEY = prev
  })
}

const ONE_LINK = 'https://onelink.shein.com/48/5z6ad6oma2ac'

test('PUT /credentials/shein: oneLink do Gerador de Link é resolvido e o número extraído é salvo', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const app = await buildApp({
      userId: nextUserId(),
      db,
      resolveSheinShortLink: async (url) => {
        assert.equal(url, ONE_LINK)
        return 'https://m.shein.com/br/ark/default?scene=1&koc_id=1150365562&url_from=affiliate_koc_1150365562&goods_id=485735309'
      },
    })
    const res = await app.inject({ method: 'PUT', url: '/shein', payload: { tag: ONE_LINK } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.validation.configured, true)
    assert.equal(body.data.tag, '1150365562')
    await app.close()
  })
})

test('PUT /credentials/shein: falha de rede na resolução não vira recusa seca — explica e sugere colar o número', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const app = await buildApp({
      userId: nextUserId(),
      db,
      resolveSheinShortLink: async () => { throw new Error('network down') },
    })
    const res = await app.inject({ method: 'PUT', url: '/shein', payload: { tag: ONE_LINK } })
    assert.equal(res.statusCode, 400)
    const body = res.json()
    assert.match(body.error, /n[ãa]o deu para conferir/i)
    // Vocabulário do painel: a SHEIN chama de "ID de afiliado" (Minha conta),
    // e a tela usa esse mesmo nome — a mensagem de falha tem que combinar com
    // o que a cliente vê no campo, senão ela procura uma coisa que não existe.
    assert.match(body.error, /ID de afiliado/i)
    assert.doesNotMatch(body.error, /n[ãa]o reconhecemos esse texto/i)
    await app.close()
  })
})

test('PUT /credentials/shein: resolução que não revela identificador (captcha/instabilidade) também explica em vez de recusar seco', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    const app = await buildApp({
      userId: nextUserId(),
      db,
      // resolveSheinShortLink nunca lança (contrato do módulo real) — degrada
      // devolvendo a última URL conhecida, que pode não expor o identificador.
      resolveSheinShortLink: async () => ONE_LINK,
    })
    const res = await app.inject({ method: 'PUT', url: '/shein', payload: { tag: ONE_LINK } })
    assert.equal(res.statusCode, 400)
    const body = res.json()
    assert.match(body.error, /n[ãa]o deu para conferir/i)
    await app.close()
  })
})

test('PUT /credentials/shein: link do botão de compartilhar continua recusado com a mensagem específica (não regride)', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    let calledResolve = false
    const app = await buildApp({
      userId: nextUserId(),
      db,
      resolveSheinShortLink: async () => { calledResolve = true; return 'nunca deveria chamar' },
    })
    const shareUrl = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=abc&link=xyz&url_from=GM7999'
    const res = await app.inject({ method: 'PUT', url: '/shein', payload: { tag: shareUrl } })
    assert.equal(res.statusCode, 400)
    const body = res.json()
    assert.match(body.error, /bot[ãa]o de compartilhar/i)
    assert.equal(calledResolve, false, 'link de compartilhamento não é oneLink — não deve tentar resolver pela rede')
    await app.close()
  })
})

test('PUT /credentials/shein: número puro continua salvando direto, sem tentar resolver pela rede', async () => {
  await withEncryptionKey(async () => {
    const db = fakeDb()
    let calledResolve = false
    const app = await buildApp({
      userId: nextUserId(),
      db,
      resolveSheinShortLink: async () => { calledResolve = true; return 'x' },
    })
    const res = await app.inject({ method: 'PUT', url: '/shein', payload: { tag: '1150365562' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().data.tag, '1150365562')
    assert.equal(calledResolve, false)
    await app.close()
  })
})
