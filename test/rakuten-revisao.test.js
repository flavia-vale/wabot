// Revisão crítica da Rakuten (docs/revisao-rakuten-2026-10-03.md): um teste
// por achado corrigido. Cada um reproduz o defeito de antes.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import db from '../src/db.js'
import { createRakutenClient, RAKUTEN_MAX_RESPONSE_BYTES } from '../src/integrations/rakuten/client.js'
import { RakutenAccessDeniedError, RakutenAuthError, RakutenHttpError, RakutenResponseError, RakutenTimeoutError } from '../src/integrations/rakuten/errors.js'
import { syncRakutenAccount, __resetRakutenEmptyStreaks } from '../src/integrations/rakuten/syncService.js'
import { tickRakutenSync } from '../src/integrations/rakuten/scheduler.js'
import { loadRakutenConversionContext, RAKUTEN_REFUSED_GRACE_MS } from '../src/integrations/rakuten/conversionContext.js'
import { createRakutenStoreMatcher } from '../src/integrations/rakuten/storeMatcher.js'
import { publicHttpsUrl, extractAdvertiser } from '../src/integrations/rakuten/translate.js'
import { convert } from '../src/converters/rakuten.js'
import { findUnconvertedStoreLinks } from '../src/core/mirrorLinkGuard.js'
import { ensureRakutenCouponLine, formatOfferMessage } from '../src/offerAutomation/dispatcher.js'
import { rakutenPromotionToOffer } from '../src/offerAutomation/rakutenOffers.js'
import { tickOfferAutomations, __resetRakutenBackoff } from '../src/offerAutomation/cron.js'
import { rakutenRoutes } from '../src/api/routes/rakuten.js'

const feed = readFileSync(new URL('./fixtures/rakuten-coupons-page.xml', import.meta.url), 'utf8')
const CREDS = { clientId: 'ClienteFicticio01', clientSecret: 'SegredoFicticio01', sid: '4640819' }
const noLimit = { acquire: async () => {} }
const STORES_XML = '<ns1:getMerchByAppStatusResponse xmlns:ns1="x"><ns1:return><ns1:mid>43984</ns1:mid><ns1:name>Netshoes WL</ns1:name></ns1:return></ns1:getMerchByAppStatusResponse>'
const EMPTY_STORES_XML = '<ns1:getMerchByAppStatusResponse xmlns:ns1="x"></ns1:getMerchByAppStatusResponse>'
const EMPTY_FEED = '<couponfeed><TotalMatches>0</TotalMatches><TotalPages>0</TotalPages></couponfeed>'

function fakeResponse(status, body, { headers = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

// ---------- R1: prazo cobre o corpo ----------

test('R1: resposta que trava no meio do corpo termina em erro de prazo (antes: esperava para sempre)', async () => {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/token')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"access_token":"t","expires_in":3600}')
      return
    }
    res.writeHead(200, { 'content-type': 'application/xml' })
    res.write('<couponfeed>')
  })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const client = createRakutenClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, timeoutMs: 300, limiter: noLimit })
    const started = Date.now()
    await assert.rejects(client.listCoupons(CREDS), RakutenTimeoutError)
    assert.ok(Date.now() - started < 2000, 'terminou perto do prazo')
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('R1: fetch que nunca responde também respeita o prazo', async () => {
  const client = createRakutenClient({ timeoutMs: 200, limiter: noLimit, fetchFn: () => new Promise(() => {}) })
  await assert.rejects(client.verify(CREDS), RakutenTimeoutError)
})

// ---------- R10: teto de tamanho ----------

test('R10: resposta acima de 10 MB é recusada sem ler tudo', async () => {
  const declared = createRakutenClient({ limiter: noLimit, fetchFn: async (url) => (url.endsWith('/token') ? fakeResponse(200, { access_token: 'x', expires_in: 3600 }) : fakeResponse(200, '<couponfeed/>', { headers: { 'content-length': String(RAKUTEN_MAX_RESPONSE_BYTES + 1) } })) })
  await assert.rejects(declared.listCoupons(CREDS), RakutenResponseError)
  const huge = 'x'.repeat(RAKUTEN_MAX_RESPONSE_BYTES + 10)
  const streamed = createRakutenClient({ limiter: noLimit, fetchFn: async (url) => (url.endsWith('/token') ? fakeResponse(200, { access_token: 'x', expires_in: 3600 }) : new Response(huge, { status: 200 })) })
  await assert.rejects(streamed.listCoupons(CREDS), RakutenResponseError)
})

// ---------- R2a: o que é "dado errado" ----------

test('R2a: só invalid_client no token é dado errado; outro 400/401 do token é passageiro', async () => {
  const refused = createRakutenClient({ limiter: noLimit, fetchFn: async () => fakeResponse(401, { error: 'invalid_client' }) })
  await assert.rejects(refused.verify(CREDS), RakutenAuthError)
  const glitch = createRakutenClient({ limiter: noLimit, fetchFn: async () => fakeResponse(400, { error: 'server_error' }) })
  await assert.rejects(glitch.verify(CREDS), RakutenHttpError)
  const htmlPage = createRakutenClient({ limiter: noLimit, fetchFn: async () => fakeResponse(401, '<html>erro</html>') })
  await assert.rejects(htmlPage.verify(CREDS), RakutenHttpError)
})

// ---------- sync com banco real ----------

let seq = 0
async function makeAccount(overrides = {}) {
  const userId = `rk-rev-${++seq}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Rev', email: `${userId}@rk-rev.local`, passwordHash: 'x', plan: 'pro', accessExpiresAt: new Date(Date.now() + 86_400_000) } })
  const account = await db.rakutenAccount.create({
    data: { userId, label: 'Conta', sid: '4640819', clientIdEncrypted: 'a', clientIdLast4: 'aaaa', clientSecretEncrypted: 'b', clientSecretLast4: 'bbbb', credentialFingerprint: 'fp', ...overrides },
  })
  return { userId, account }
}

async function cleanup(userId) {
  await db.offerAutomation.deleteMany({ where: { userId } })
  await db.rakutenAccount.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

function fakeClient({ coupons = feed, stores = STORES_XML, couponsError = null } = {}) {
  return {
    verify: async () => true,
    listCoupons: async () => {
      if (couponsError) throw couponsError
      return coupons
    },
    getAdvertiser: async (creds, id) => ({ advertiser: { url: 'https://www.netshoes.com.br/', logo_url: `https://merchant.linksynergy.com/fs/logo/lg_${id}` } }),
    listApprovedMerchants: async () => stores,
  }
}

const deps = (options) => ({ db, client: fakeClient(options), decrypt: (value) => value, trigger: 'manual' })
const active = (accountId) => db.rakutenPromotion.count({ where: { accountId, status: 'active' } })

test('R3: feed vazio 1× não vence nada; 2× seguidas vencem por ausência', async () => {
  __resetRakutenEmptyStreaks()
  const { userId, account } = await makeAccount()
  try {
    await syncRakutenAccount(account.id, deps())
    assert.equal(await active(account.id), 4)
    await syncRakutenAccount(account.id, deps({ coupons: EMPTY_FEED }))
    assert.equal(await active(account.id), 4, 'um soluço não apaga as promoções')
    await syncRakutenAccount(account.id, deps({ coupons: EMPTY_FEED }))
    assert.equal(await active(account.id), 0, 'duas vazias seguidas: sumiu de verdade')
    // Leitura com conteúdo zera a contagem.
    await syncRakutenAccount(account.id, deps())
    await syncRakutenAccount(account.id, deps({ coupons: EMPTY_FEED }))
    assert.equal(await active(account.id), 4)
  } finally {
    await cleanup(userId)
  }
})

test('R4: lista de lojas vazia 1× mantém as lojas e a conversão; 2× seguidas apagam', async () => {
  __resetRakutenEmptyStreaks()
  const { userId, account } = await makeAccount()
  try {
    await syncRakutenAccount(account.id, deps())
    assert.equal(await db.rakutenProgramme.count({ where: { accountId: account.id } }), 1)
    await syncRakutenAccount(account.id, deps({ stores: EMPTY_STORES_XML }))
    assert.equal(await db.rakutenProgramme.count({ where: { accountId: account.id } }), 1)
    assert.ok(await loadRakutenConversionContext(userId, { db }), 'conversão segue ligada')
    await syncRakutenAccount(account.id, deps({ stores: EMPTY_STORES_XML }))
    assert.equal(await db.rakutenProgramme.count({ where: { accountId: account.id } }), 0)
  } finally {
    await cleanup(userId)
  }
})

test('R2a: 401 em pedido de dados é passageiro; só a 3ª execução seguida desliga a conta', async () => {
  __resetRakutenEmptyStreaks()
  const { userId, account } = await makeAccount()
  try {
    await syncRakutenAccount(account.id, deps())
    const denied = () => syncRakutenAccount(account.id, deps({ couponsError: new RakutenAccessDeniedError(401) }))
    const first = await denied()
    assert.equal(first.status, 'access_denied')
    let row = await db.rakutenAccount.findUnique({ where: { id: account.id } })
    assert.equal(row.status, 'error')
    assert.ok(row.nextSyncAt, 'continua agendada')
    assert.ok(await loadRakutenConversionContext(userId, { db }), 'conversão segue')
    await denied()
    const third = await denied()
    assert.equal(third.status, 'invalid_credential')
    row = await db.rakutenAccount.findUnique({ where: { id: account.id } })
    assert.equal(row.status, 'invalid_credential')
  } finally {
    await cleanup(userId)
  }
})

test('R2b: conta recusada segue convertendo por 7 dias desde a última sync; depois para', async () => {
  __resetRakutenEmptyStreaks()
  const { userId, account } = await makeAccount()
  try {
    await syncRakutenAccount(account.id, deps())
    await db.rakutenAccount.update({ where: { id: account.id }, data: { status: 'invalid_credential', lastSyncAt: new Date(Date.now() - 24 * 3_600_000) } })
    assert.ok(await loadRakutenConversionContext(userId, { db }), '1 dia depois: converte')
    await db.rakutenAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(Date.now() - RAKUTEN_REFUSED_GRACE_MS - 3_600_000) } })
    assert.equal(await loadRakutenConversionContext(userId, { db }), null, '8 dias depois: não converte')
  } finally {
    await cleanup(userId)
  }
})

test('R1: sync que passa do prazo total termina como falha, libera a conta e reagenda', async () => {
  __resetRakutenEmptyStreaks()
  const { userId, account } = await makeAccount()
  try {
    const slow = { ...fakeClient(), listCoupons: async () => { await new Promise((resolve) => setTimeout(resolve, 30)); return feed.replace('<TotalPages>1</TotalPages>', '<TotalPages>5</TotalPages>') } }
    const result = await syncRakutenAccount(account.id, { db, client: slow, decrypt: (value) => value, trigger: 'manual', deadlineMs: 10 })
    assert.equal(result.status, 'failed')
    const row = await db.rakutenAccount.findUnique({ where: { id: account.id } })
    assert.ok(row.nextSyncAt)
    assert.notEqual((await syncRakutenAccount(account.id, deps())).skipped, 'busy', 'conta liberada')
  } finally {
    await cleanup(userId)
  }
})

test('R11: página grande grava em lotes e o resultado é o mesmo', async () => {
  __resetRakutenEmptyStreaks()
  const { userId, account } = await makeAccount()
  try {
    const block = feed.match(/<link type="TEXT">[\s\S]*?<\/link>/)[0]
    const many = Array.from({ length: 250 }, (_, i) => block.replace('offerid=1897539.1097', `offerid=1897539.${5000 + i}`)).join('')
    const page = `<couponfeed><TotalMatches>250</TotalMatches><TotalPages>1</TotalPages>${many}</couponfeed>`
    const result = await syncRakutenAccount(account.id, deps({ coupons: page }))
    assert.equal(result.inserted, 250)
    assert.equal(await active(account.id), 250)
  } finally {
    await cleanup(userId)
  }
})

test('R1: agendador preso há mais de 30 min deixa o próximo tick rodar', async () => {
  let release
  const stuck = tickRakutenSync({ db: { rakutenAccount: { findMany: () => new Promise((resolve) => { release = () => resolve([]) }) } }, logger: { warn() {}, error() {} } })
  const busy = await tickRakutenSync({ db: { rakutenAccount: { findMany: async () => [] } }, logger: { warn() {}, error() {} } })
  assert.equal(busy.skipped, 'busy')
  const realNow = Date.now
  Date.now = () => realNow() + 31 * 60_000
  try {
    const next = await tickRakutenSync({ db: { rakutenAccount: { findMany: async () => [] } }, logger: { warn() {}, error() {} } })
    assert.notEqual(next.skipped, 'busy')
  } finally {
    Date.now = realNow
    release()
    await stuck
  }
})

// ---------- R13: "Atualizar agora" não segura a requisição ----------

test('R13: atualização manual demorada responde 202 e segue sozinha', async () => {
  const { userId, account } = await makeAccount({ status: 'ok' })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  let finish
  await app.register(rakutenRoutes, { prefix: '/api/rakuten', client: fakeClient(), manualSyncWaitMs: 50, syncFn: () => new Promise((resolve) => { finish = resolve }) })
  try {
    const res = await app.inject({ method: 'POST', url: `/api/rakuten/accounts/${account.id}/sync` })
    assert.equal(res.statusCode, 202)
    assert.equal(JSON.parse(res.body).started, true)
    finish({ status: 'success' })
  } finally {
    await app.close()
    await cleanup(userId)
  }
})

// ---------- R5 / R6: links de outra pessoa ----------

test('R5: link Rakuten sem https:// no texto final é pego pela trava (antes: ia para o grupo)', () => {
  assert.deepEqual(findUnconvertedStoreLinks('Corre! click.linksynergy.com/deeplink?id=OUTRO&mid=1&murl=x', []), ['click.linksynergy.com/deeplink?id=OUTRO&mid=1&murl=x'])
  assert.deepEqual(findUnconvertedStoreLinks('Texto sem link nenhum', []), [])
})

test('R6: mid aprovado com página de loja fixa (Amazon) é apagado; domínio desconhecido segue pelo mid', async () => {
  const stores = [{ accountId: 'a1', linkId: 'MEU', advertiserId: '43984', name: 'Netshoes WL', domains: ['netshoes.com.br'] }]
  const matcher = createRakutenStoreMatcher(stores, { linkIds: ['MEU'] })
  const creds = { matcher, accountsById: new Map([['a1', { id: 'a1', linkId: 'MEU' }]]) }
  const amazon = 'https://click.linksynergy.com/deeplink?id=OUTRO&mid=43984&murl=https%3A%2F%2Fwww.amazon.com.br%2Fdp%2FX'
  assert.equal(matcher.isRakutenLink(amazon), false)
  await assert.rejects(convert(amazon, creds), (error) => error.stripFromMessage === true)
  const outlet = 'https://click.linksynergy.com/deeplink?id=OUTRO&mid=43984&murl=https%3A%2F%2Foutlet.netshoes.net%2Fx'
  assert.equal(matcher.isRakutenLink(outlet), true)
  assert.match((await convert(outlet, creds)).url, /id=MEU&mid=43984/)
})

// ---------- R8: robô guarda o último contexto bom ----------

test('R8: robô usa a última leitura boa da Rakuten quando a carga falha (até 10 min)', () => {
  const source = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(source, /RAKUTEN_CONTEXT_FALLBACK_MS = 10 \* 60_000/)
  assert.match(source, /lastGoodRakutenContext = \{ value: rakuten, at: Date\.now\(\) \}/)
  assert.match(source, /if \(fallback\) credentials\.rakuten = fallback/)
})

// ---------- R14: cupom nunca some ----------

test('R14: modelo sem {descrição} ainda leva o cupom da Rakuten; outras origens não mudam', () => {
  const offer = rakutenPromotionToOffer({ id: 'r1', accountId: 'a', promotionId: '1.1', advertiserId: '43984', advertiserName: 'Netshoes WL', title: 'Cupom de 10% OFF', couponCode: 'BEMVINDO10', clickUrl: 'https://click.linksynergy.com/fs-bin/click?id=X&offerid=1.1', endDate: null, status: 'active' })
  const text = formatOfferMessage(offer, '', '🏷️ *{produto}*\n\n👉 {link}')
  assert.match(text, /Use o cupom: BEMVINDO10/)
  assert.ok(text.indexOf('BEMVINDO10') < text.indexOf('👉'), 'antes do link')
  assert.equal(ensureRakutenCouponLine('texto', { source: 'awin', description: 'x' }), 'texto')
  assert.equal(ensureRakutenCouponLine('texto 🎟️ Use o cupom: A', { source: 'rakuten', description: '🎟️ Use o cupom: A' }), 'texto 🎟️ Use o cupom: A')
})

// ---------- R7: Rakuten sem promoção não roda todo minuto ----------

test('R7: automação Rakuten que pulou espera 15 min; Shopee que pulou roda no minuto seguinte como hoje', async () => {
  __resetRakutenBackoff()
  const automations = [
    { id: 'rk1', userId: 'u1', source: 'rakuten', enabled: true, intervalMinutes: 15, lastSentAt: null, publicationMode: 'direct', instagramDestinations: [] },
    { id: 'sp1', userId: 'u1', source: 'shopee', enabled: true, intervalMinutes: 15, lastSentAt: null, publicationMode: 'direct', instagramDestinations: [] },
  ]
  const runs = []
  const tick = (now) => tickOfferAutomations({
    db: { offerAutomation: { findMany: async () => automations.map((a) => ({ ...a })) } },
    now: () => now,
    runAutomationFn: async (automation) => { runs.push(automation.id); return { skipped: 'all_offers_filtered' } },
    getPlanAccessFn: async () => ({ entitlements: { canUseOfferAutomations: true, canUseInstagramStories: true } }),
    listRunningBotsFn: async () => ['u1'],
    env: {},
  })
  const t0 = new Date('2026-10-03T12:00:00Z')
  await tick(t0)
  await tick(new Date(t0.getTime() + 60_000))
  assert.deepEqual(runs, ['rk1', 'sp1', 'sp1'], 'Rakuten não roda de novo no minuto seguinte; Shopee sim')
  await tick(new Date(t0.getTime() + 16 * 60_000))
  assert.deepEqual(runs.slice(3), ['rk1', 'sp1'], 'depois de 15 min a Rakuten volta')
})

// ---------- R16: logo só de endereço público ----------

test('R16: logo só https e host público', () => {
  assert.equal(publicHttpsUrl('https://merchant.linksynergy.com/fs/logo/lg_1'), 'https://merchant.linksynergy.com/fs/logo/lg_1')
  for (const bad of ['http://merchant.linksynergy.com/x', 'https://127.0.0.1/x', 'https://10.1.2.3/x', 'https://192.168.0.1/x', 'https://localhost/x']) {
    assert.equal(publicHttpsUrl(bad), null, bad)
  }
  assert.equal(extractAdvertiser({ advertiser: { name: 'X', url: 'https://x.com.br/', logo_url: 'http://127.0.0.1/logo' } }).logoUrl, null)
})
