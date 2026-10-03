// Conversão de links pela Awin (docs/rca/afiliados-awin.md): lojas aprovadas,
// detector, sanitizador, conversor (curto guardado → longo como plano B),
// contexto do banco, sync das lojas e rotas.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import db from '../src/db.js'
import {
  buildAwinDeepLink,
  cleanDestinationUrl,
  createAwinStoreMatcher,
  extractProgrammes,
  isAwinTrackingUrl,
  normalizeStoreDomain,
  parseAwinClickUrl,
} from '../src/integrations/awin/storeMatcher.js'
import { detectLinks, isOfferUrl } from '../src/detector.js'
import { sanitizeInviteLinks } from '../src/messageProcessor.js'
import { findUnconvertedStoreLinks } from '../src/core/mirrorLinkGuard.js'
import { findCandidateLinks } from '../src/core/customDomainLinkResolver.js'
import { AWIN_NOT_JOINED_ERROR, AWIN_SHORT_RETRY_MS, convert, resolveAwinShortUrl } from '../src/converters/awin.js'
import { convertLink } from '../src/converters/index.js'
import { AwinRateLimitError } from '../src/integrations/awin/errors.js'
import { createTokenRateLimiter } from '../src/integrations/awin/rateLimiter.js'
import { loadAwinConversionContext, refineAwinOptionsForText } from '../src/integrations/awin/conversionContext.js'
import { syncAwinAccount } from '../src/integrations/awin/syncService.js'
import { validateCredentialData } from '../src/credentialHealth.js'
import { buildNoValidConversionsErrorMsg, CONVERSION_FAILURE } from '../src/core/conversionFailureReason.js'
import { describeConversionFailure } from '../src/credentialBlockAlert/message.js'
import { linkConversionRoutes } from '../src/api/routes/linkConversion.js'

const PUBLISHER = '2701264'
// Formato real medido em 2026-09-29 (conta 2701264).
const PROGRAMMES = [
  { id: 17729, name: 'Kabum BR', displayUrl: 'https://www.kabum.com.br/', validDomains: [{ domain: '*.kabum.com' }, { domain: 'kabum.com.br' }, { domain: '*.kabum.com.br' }] },
  { id: 17648, name: 'C&A BR', displayUrl: 'https://www.cea.com.br', validDomains: [{ domain: '*.cea.com' }, { domain: 'cea.com.br' }, { domain: '*.cea.com.br' }] },
  { id: 32675, name: 'PUMA BR', displayUrl: 'https://br.puma.com/', validDomains: [{ domain: 'br.puma.com' }, { domain: '*.br.puma.com' }] },
]

function storesFor(accountId = 'acc-1') {
  return extractProgrammes(PROGRAMMES).map((store) => ({ ...store, accountId, publisherId: PUBLISHER }))
}

function memoryLinkStore() {
  const rows = new Map()
  const key = ({ accountId, advertiserId, destinationKey }) => `${accountId}|${advertiserId}|${destinationKey}`
  return {
    rows,
    get: async (where) => rows.get(key(where)) ?? null,
    save: async (row) => { rows.set(key(row), { ...row, createdAt: new Date() }) },
  }
}

function context({ client, linkStore = memoryLinkStore(), resolveShortUrl, now } = {}) {
  const stores = storesFor()
  return {
    accountsById: new Map([['acc-1', { id: 'acc-1', publisherId: PUBLISHER, token: 'tok' }]]),
    publisherIds: new Set([PUBLISHER]),
    stores,
    matcher: createAwinStoreMatcher(stores, { publisherIds: [PUBLISHER] }),
    linkStore,
    client,
    resolveShortUrl,
    now,
  }
}

function fakeClient(response = { url: 'https://www.awin1.com/cread.php?x=1', shortUrl: 'https://tidd.ly/abc' }) {
  const calls = []
  return {
    calls,
    generateLink: async (token, publisherId, body) => {
      calls.push({ token, publisherId, ...body })
      if (response instanceof Error) throw response
      return response
    },
  }
}

// ---------- lojas e domínios ----------

test('lojas da Awin: domínios da resposta real viram base sem "*." nem "www."', () => {
  const [kabum, cea, puma] = extractProgrammes(PROGRAMMES)
  assert.deepEqual(kabum, { advertiserId: 17729, name: 'Kabum BR', displayUrl: 'https://www.kabum.com.br/', logoUrl: null, domains: ['kabum.com', 'kabum.com.br'] })
  assert.equal(extractProgrammes([{ id: 1, name: 'X', logoUrl: 'https://ui.awin.com/images/upload/merchant/profile/17729.png' }])[0].logoUrl, 'https://ui.awin.com/images/upload/merchant/profile/17729.png')
  assert.equal(extractProgrammes([{ id: 1, name: 'X', logoUrl: 'javascript:alert(1)' }])[0].logoUrl, null)
  assert.deepEqual(cea.domains, ['cea.com', 'cea.com.br'])
  assert.deepEqual(puma.domains, ['br.puma.com'])
  assert.equal(normalizeStoreDomain('https://tidd.ly/x'), null)
  assert.equal(normalizeStoreDomain('lixo sem ponto'), null)
  assert.equal(extractProgrammes({ nada: 1 }), null)
})

test('matcher reconhece loja por domínio e subdomínio, nunca por pedaço de nome', () => {
  const matcher = createAwinStoreMatcher(storesFor())
  assert.equal(matcher.storeForUrl('https://www.kabum.com.br/produto/123/x')?.advertiserId, 17729)
  assert.equal(matcher.storeForUrl('https://m.kabum.com.br/p')?.advertiserId, 17729)
  assert.equal(matcher.storeForUrl('https://br.puma.com/tenis')?.advertiserId, 32675)
  assert.equal(matcher.storeForUrl('https://puma.com/tenis'), null)
  assert.equal(matcher.storeForUrl('https://kabum.com.br.golpe.net/x'), null)
  assert.equal(matcher.storeForUrl('https://notkabum.com.br/x'), null)
  assert.ok(matcher.isAwinLink('https://tidd.ly/3xYz'))
  assert.equal(matcher.isAwinLink('https://www.awin1.com/pagina-qualquer'), false)
})

test('link de clique da Awin: loja aprovada ou link dela passam; loja não aprovada é apagada sem abrir nada', () => {
  const matcher = createAwinStoreMatcher(storesFor(), { publisherIds: [PUBLISHER] })
  assert.ok(matcher.isAwinLink('https://www.awin1.com/cread.php?awinmid=17729&awinaffid=111&ued=x'))
  assert.ok(matcher.isAwinLink('https://www.awin1.com/cread.php?awinaffid=111&ued=https%3A%2F%2Fwww.cea.com.br%2Fx'))
  assert.ok(matcher.isAwinLink(`https://www.awin1.com/cread.php?awinmid=55555&awinaffid=${PUBLISHER}&ued=x`))
  assert.equal(matcher.isAwinLink('https://www.awin1.com/cread.php?awinmid=55555&awinaffid=111&ued=https%3A%2F%2Fwww.netshoes.com.br%2Fx'), false)
  const text = 'Tênis https://www.awin1.com/cread.php?awinmid=55555&awinaffid=111&ued=https%3A%2F%2Fwww.netshoes.com.br%2Fx e https://shopee.com.br/y'
  assert.doesNotMatch(sanitizeInviteLinks(text, { awin: matcher }), /awin1/)
  assert.match(sanitizeInviteLinks(text, { awin: matcher }), /shopee\.com\.br\/y/)
})

test('tidd.ly no espelhamento: aberto antes do sanitizador; de loja não aprovada é apagado e o resto segue', async () => {
  const ctx = context({})
  const opened = []
  const resolveShortUrl = async (url) => {
    opened.push(url)
    if (url.endsWith('/kabum')) return 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=111&ued=https%3A%2F%2Fwww.kabum.com.br%2Fp'
    if (url.endsWith('/outra')) return 'https://www.awin1.com/cread.php?awinmid=55555&awinaffid=111&ued=https%3A%2F%2Fwww.netshoes.com.br%2Fp'
    return null
  }
  const text = 'A https://tidd.ly/kabum B https://tidd.ly/outra* C https://tidd.ly/quebrado D https://shopee.com.br/z'
  const options = await refineAwinOptionsForText(text, ctx, { resolveShortUrl })
  assert.deepEqual(opened.sort(), ['https://tidd.ly/kabum', 'https://tidd.ly/outra', 'https://tidd.ly/quebrado'])
  const sanitized = sanitizeInviteLinks(text, options)
  assert.match(sanitized, /tidd\.ly\/kabum/)
  assert.doesNotMatch(sanitized, /tidd\.ly\/outra|tidd\.ly\/quebrado/)
  assert.deepEqual(detectLinks(sanitized, options).map((l) => [l.platform, l.url]), [['shopee', 'https://shopee.com.br/z'], ['awin', 'https://tidd.ly/kabum']])
  assert.deepEqual(await refineAwinOptionsForText(text, null), {})
})

test('robô: Awin desligada no grupo = sem opções Awin (link apagado como antes); refine antes do sanitizador', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /const awinBase = awinLigadaNoGrupo \? awinOfferOptions\(cfg\.credentials\.awin\) : \{\}/)
  const refine = src.indexOf('await refineAwinOptionsForText(textoParaEspelhar, cfg.credentials.awin)')
  const sanitize = src.indexOf('sanitizeInviteLinks(textoParaEspelhar, awinOptions)')
  assert.ok(refine > 0 && sanitize > refine)
})

test('link de clique da Awin: lê loja, dono e destino', () => {
  const parsed = parseAwinClickUrl('https://www.awin1.com/cread.php?awinmid=17729&awinaffid=999&ued=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F1')
  assert.deepEqual(parsed, { advertiserId: 17729, publisherId: '999', destinationUrl: 'https://www.kabum.com.br/produto/1' })
  assert.equal(parseAwinClickUrl('https://www.kabum.com.br/x'), null)
  assert.ok(isAwinTrackingUrl('https://www.awin1.com/awclick.php?mid=1&id=2&p=https://x.com'))
  assert.equal(cleanDestinationUrl('https://www.kabum.com.br/p?utm_source=conc&cor=azul&awc=1#top'), 'https://www.kabum.com.br/p?cor=azul')
  assert.equal(
    buildAwinDeepLink({ advertiserId: 17729, publisherId: PUBLISHER, destinationUrl: 'https://www.kabum.com.br/p' }),
    'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=2701264&ued=https%3A%2F%2Fwww.kabum.com.br%2Fp',
  )
})

// ---------- detector e sanitizador ----------

test('sem conta Awin nada muda: link da KaBuM não é loja e o sanitizador apaga', () => {
  const text = 'Oferta https://www.kabum.com.br/produto/1 e https://shopee.com.br/x'
  assert.deepEqual(detectLinks(text).map((l) => l.platform), ['shopee'])
  assert.equal(isOfferUrl('https://www.kabum.com.br/produto/1'), false)
  assert.doesNotMatch(sanitizeInviteLinks(text), /kabum/)
})

test('com conta Awin: link de loja aprovada e tidd.ly são detectados e mantidos; loja fixa continua dela', () => {
  const options = { awin: createAwinStoreMatcher(storesFor()) }
  const text = 'Oferta https://www.kabum.com.br/produto/1 e https://tidd.ly/abc e https://shopee.com.br/x e https://www.netshoes.com.br/y'
  const links = detectLinks(text, options)
  assert.deepEqual(links.map((l) => [l.platform, l.url]), [
    ['shopee', 'https://shopee.com.br/x'],
    ['awin', 'https://www.kabum.com.br/produto/1'],
    ['awin', 'https://tidd.ly/abc'],
  ])
  const sanitized = sanitizeInviteLinks(text, options)
  assert.match(sanitized, /kabum\.com\.br\/produto\/1/)
  assert.match(sanitized, /tidd\.ly\/abc/)
  assert.doesNotMatch(sanitized, /netshoes/)
  // Não é "site próprio de grupo" nem "loja não suportada".
  assert.deepEqual(findCandidateLinks(text, options), ['https://www.netshoes.com.br/y'])
  // Rede de segurança final enxerga o link Awin que sobrou sem converter.
  assert.deepEqual(findUnconvertedStoreLinks('veja https://www.kabum.com.br/produto/1', [], options), ['https://www.kabum.com.br/produto/1'])
})

// ---------- conversor ----------

test('link de loja aprovada → link curto oficial, guardado; o mesmo produto não chama a Awin de novo', async () => {
  const client = fakeClient()
  const creds = context({ client })
  const first = await convert('https://www.kabum.com.br/produto/1?utm_source=concorrente', creds)
  assert.equal(first.url, 'https://tidd.ly/abc')
  assert.equal(first.awin.short, true)
  assert.equal(first.awin.own, false)
  assert.equal(first.awin.storeName, 'Kabum BR')
  assert.deepEqual(client.calls, [{ token: 'tok', publisherId: PUBLISHER, advertiserId: 17729, destinationUrl: 'https://www.kabum.com.br/produto/1', shorten: true, noWait: true }])

  const second = await convert('https://www.kabum.com.br/produto/1', creds)
  assert.equal(second.url, 'https://tidd.ly/abc')
  assert.equal(second.awin.cached, true)
  assert.equal(client.calls.length, 1)
})

test('sem vaga no limite / Awin fora → link longo com o número DELA, sem segurar a oferta e sem guardar', async () => {
  const linkStore = memoryLinkStore()
  const client = fakeClient(new AwinRateLimitError(null))
  const result = await convert('https://www.cea.com.br/blusa', context({ client, linkStore }))
  assert.equal(result.url, buildAwinDeepLink({ advertiserId: 17648, publisherId: PUBLISHER, destinationUrl: 'https://www.cea.com.br/blusa' }))
  assert.equal(result.awin.short, false)
  assert.equal(linkStore.rows.size, 0)
})

test('cota de links curtos no fim (Awin responde sem curto) → longo guardado; tenta o curto de novo depois de 24h', async () => {
  const linkStore = memoryLinkStore()
  let at = Date.parse('2026-09-30T10:00:00Z')
  const noShort = fakeClient({ url: 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=2701264&ued=x', shortUrl: null })
  const creds = context({ client: noShort, linkStore, now: () => at })
  const first = await convert('https://www.kabum.com.br/p/9', creds)
  assert.equal(first.url, 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=2701264&ued=x')
  const again = await convert('https://www.kabum.com.br/p/9', creds)
  assert.equal(again.url, first.url)
  assert.equal(noShort.calls.length, 1)

  const [row] = linkStore.rows.values()
  row.createdAt = new Date(at - AWIN_SHORT_RETRY_MS - 1)
  const withShort = fakeClient({ url: 'https://www.awin1.com/cread.php?y', shortUrl: 'https://tidd.ly/novo' })
  const later = await convert('https://www.kabum.com.br/p/9', { ...creds, client: withShort })
  assert.equal(later.url, 'https://tidd.ly/novo')
  assert.equal(withShort.calls.length, 1)
})

test('link Awin de concorrente numa loja aprovada → vira link DELA para a mesma página', async () => {
  const client = fakeClient()
  const competitor = 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=111111&ued=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F7'
  const result = await convert(competitor, context({ client }))
  assert.equal(result.url, 'https://tidd.ly/abc')
  assert.equal(client.calls[0].destinationUrl, 'https://www.kabum.com.br/produto/7')
  assert.equal(client.calls[0].advertiserId, 17729)
})

test('tidd.ly de concorrente: abre o link curto (sem seguir até a loja) e troca pelo dela', async () => {
  const client = fakeClient()
  const resolveShortUrl = async (url) => {
    assert.equal(url, 'https://tidd.ly/conc')
    return 'https://www.awin1.com/cread.php?awinmid=17648&awinaffid=111111&ued=https%3A%2F%2Fwww.cea.com.br%2Fcalca'
  }
  const result = await convert('https://tidd.ly/conc', context({ client, resolveShortUrl }))
  assert.equal(result.url, 'https://tidd.ly/abc')
  assert.equal(client.calls[0].advertiserId, 17648)
})

test('link Awin de loja em que ela NÃO foi aprovada → não converte (a oferta não sai)', async () => {
  const client = fakeClient()
  const foreign = 'https://www.awin1.com/cread.php?awinmid=55555&awinaffid=111111&ued=https%3A%2F%2Fwww.netshoes.com.br%2Fx'
  await assert.rejects(convert(foreign, context({ client })), (err) => err.stripFromMessage === true && err.awinReason === AWIN_NOT_JOINED_ERROR)
  assert.equal(client.calls.length, 0)
})

test('link que já é dela fica como está, sem chamada nem cota', async () => {
  const client = fakeClient()
  const own = `https://www.awin1.com/cread.php?awinmid=17729&awinaffid=${PUBLISHER}&ued=https%3A%2F%2Fwww.kabum.com.br%2Fp`
  const result = await convert(own, context({ client }))
  assert.equal(result.url, own)
  assert.equal(result.awin.own, true)
  assert.equal(client.calls.length, 0)
})

test('convertLink("awin") usa o contexto das credenciais e devolve o campo awin', async () => {
  const result = await convertLink('awin', 'https://www.kabum.com.br/p', { awin: context({ client: fakeClient() }) })
  assert.equal(result.url, 'https://tidd.ly/abc')
  assert.equal(result.awin.advertiserId, 17729)
  assert.equal(await convertLink('awin', 'https://www.kabum.com.br/p', {}), null)
})

test('resolveAwinShortUrl lê só o Location dos saltos da Awin', async () => {
  const visited = []
  const fetchFn = async (url) => {
    visited.push(url)
    return { status: 301, headers: { get: () => 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Floja.com.br' } }
  }
  const target = await resolveAwinShortUrl('https://tidd.ly/x', { fetchFn })
  assert.equal(target, 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Floja.com.br')
  assert.deepEqual(visited, ['https://tidd.ly/x'])
  assert.equal(await resolveAwinShortUrl('https://tidd.ly/x', { fetchFn: async () => ({ status: 200, headers: { get: () => null } }) }), null)
})

test('limitador: tryAcquire não espera — sem vaga devolve false na hora', () => {
  const limiter = createTokenRateLimiter({ maxPerMinute: 2, now: () => 1000 })
  assert.equal(limiter.tryAcquire('k'), true)
  assert.equal(limiter.tryAcquire('k'), true)
  assert.equal(limiter.tryAcquire('k'), false)
})

// ---------- cadastro, motivo e texto ----------

test('Awin conta como "cadastrada" só com conta e loja aprovada', () => {
  assert.equal(validateCredentialData('awin', null).configured, false)
  assert.equal(validateCredentialData('awin', { accountsById: new Map([['a', {}]]), stores: [] }).configured, false)
  const ok = validateCredentialData('awin', context({}))
  assert.equal(ok.configured, true)
  assert.equal(ok.label, 'Awin')
})

test('motivo "loja da Awin sem aprovação" viaja no errorMsg e explica o que fazer', () => {
  const errorMsg = buildNoValidConversionsErrorMsg([CONVERSION_FAILURE.AWIN_STORE_NOT_JOINED])
  assert.equal(errorMsg, 'skip:no_valid_conversions:awin_store_not_joined')
  const falha = describeConversionFailure(errorMsg, 'awin')
  assert.equal(falha.tag.label, 'loja da Awin sem aprovação')
  assert.match(falha.texto, /ainda não foi aprovada/)
  assert.match(falha.texto, /inscreva-se/)
  // Falta de cadastro de outra loja continua mais acionável.
  assert.equal(
    buildNoValidConversionsErrorMsg([CONVERSION_FAILURE.AWIN_STORE_NOT_JOINED, CONVERSION_FAILURE.MISSING_CREDENTIAL]),
    'skip:no_valid_conversions:missing_credential',
  )
})

// ---------- banco: sync das lojas e contexto ----------

async function makeUser() {
  const userId = `awin-conv-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Awin', email: `${userId}@awin-conv.local`, passwordHash: 'x', plan: 'basic' } })
  return userId
}

async function makeAccount(userId, overrides = {}) {
  return db.awinAccount.create({
    data: { userId, label: 'Conta', publisherId: PUBLISHER, tokenEncrypted: 'token-de-teste-bem-comprido', tokenLast4: 'rido', tokenFingerprint: 'fp', status: 'ok', ...overrides },
  })
}

async function cleanup(userId) {
  await db.awinAccount.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

test('sync grava as lojas aprovadas (joined, BR) e apaga a loja que saiu', async () => {
  const userId = await makeUser()
  try {
    const account = await makeAccount(userId)
    const calls = []
    let list = PROGRAMMES
    const client = {
      listPromotions: async () => ({ data: [], pagination: { total: 0 } }),
      listProgrammes: async (token, publisherId, query) => { calls.push({ token, publisherId, ...query }); return list },
    }
    const deps = { db, client, now: () => new Date('2026-09-30T10:00:00Z'), decrypt: (value) => value }
    const first = await syncAwinAccount(account.id, deps)
    assert.equal(first.status, 'success')
    assert.equal(first.programmes, 3)
    assert.deepEqual(calls[0], { token: 'token-de-teste-bem-comprido', publisherId: PUBLISHER, relationship: 'joined', countryCode: 'BR' })
    const rows = await db.awinProgramme.findMany({ where: { accountId: account.id }, orderBy: { advertiserId: 'asc' } })
    assert.deepEqual(rows.map((row) => row.advertiserId), [17648, 17729, 32675])
    assert.deepEqual(JSON.parse(rows[1].domainsJson), ['kabum.com', 'kabum.com.br'])

    list = PROGRAMMES.filter((item) => item.id !== 17648)
    await syncAwinAccount(account.id, deps)
    const after = await db.awinProgramme.findMany({ where: { accountId: account.id } })
    assert.deepEqual(after.map((row) => row.advertiserId).sort(), [17729, 32675])
  } finally {
    await cleanup(userId)
  }
})

test('sync: falha só na lista de lojas não derruba as promoções e mantém as lojas antigas', async () => {
  const userId = await makeUser()
  try {
    const account = await makeAccount(userId)
    await db.awinProgramme.create({ data: { userId, accountId: account.id, advertiserId: 17729, name: 'Kabum BR', domainsJson: '["kabum.com.br"]' } })
    const client = {
      listPromotions: async () => ({ data: [], pagination: { total: 0 } }),
      listProgrammes: async () => { throw new Error('boom') },
    }
    const result = await syncAwinAccount(account.id, { db, client, now: () => new Date(), decrypt: (v) => v })
    assert.equal(result.status, 'success')
    assert.equal(result.programmes, null)
    assert.ok(result.errors.some((item) => /lista de lojas/.test(item.message)))
    assert.equal(await db.awinProgramme.count({ where: { accountId: account.id } }), 1)
  } finally {
    await cleanup(userId)
  }
})

test('contexto do banco: só contas utilizáveis, lojas por conta, cache de links gravando e lendo', async () => {
  const userId = await makeUser()
  try {
    const ok = await makeAccount(userId)
    const invalid = await makeAccount(userId, { publisherId: '999', status: 'invalid_credential' })
    await db.awinProgramme.create({ data: { userId, accountId: ok.id, advertiserId: 17729, name: 'Kabum BR', domainsJson: '["kabum.com.br"]' } })
    await db.awinProgramme.create({ data: { userId, accountId: invalid.id, advertiserId: 17648, name: 'C&A BR', domainsJson: '["cea.com.br"]' } })

    const ctx = await loadAwinConversionContext(userId, { db, decrypt: (value) => `dec:${value}` })
    assert.equal(ctx.accountsById.size, 1)
    assert.equal(ctx.accountsById.get(ok.id).token, 'dec:token-de-teste-bem-comprido')
    assert.equal(ctx.matcher.storeForUrl('https://www.kabum.com.br/x')?.accountId, ok.id)
    assert.equal(ctx.matcher.storeForUrl('https://www.cea.com.br/x'), null)
    assert.doesNotMatch(JSON.stringify(ctx), /token-de-teste/)

    await ctx.linkStore.save({ accountId: ok.id, advertiserId: 17729, destinationKey: 'k1', destinationUrl: 'https://www.kabum.com.br/x', shortUrl: 'https://tidd.ly/s', longUrl: 'https://www.awin1.com/cread.php?l' })
    const row = await ctx.linkStore.get({ accountId: ok.id, advertiserId: 17729, destinationKey: 'k1' })
    assert.equal(row.shortUrl, 'https://tidd.ly/s')

    assert.equal(await loadAwinConversionContext(`${userId}-sem-conta`, { db }), null)
  } finally {
    await cleanup(userId)
  }
})

// ---------- rotas ----------

async function buildApp({ awinContext, converter, fetchProductInfo, fetchProductImage }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'awin-route-user' } })
  await app.register(linkConversionRoutes, {
    prefix: '/api/link-conversion',
    converter,
    fetchProductInfo: fetchProductInfo ?? (async () => ({})),
    fetchProductImage: fetchProductImage ?? (async () => null),
    findCredentials: async () => [],
    loadAwinContext: async () => awinContext,
  })
  return app
}

test('Converter links: link de loja Awin converte; link que já é dela avisa; loja sem aprovação explica', async (t) => {
  const app = await buildApp({
    awinContext: context({}),
    converter: async (platform, url) => {
      assert.equal(platform, 'awin')
      if (url.includes('awinaffid=2701264')) return { url, awin: { own: true } }
      if (url.includes('tidd.ly')) {
        const err = new Error('não aprovada')
        err.stripFromMessage = true
        err.awinReason = AWIN_NOT_JOINED_ERROR
        throw err
      }
      return { url: 'https://tidd.ly/dela', awin: { own: false } }
    },
  })
  t.after(() => app.close())
  const own = `https://www.awin1.com/cread.php?awinmid=17729&awinaffid=${PUBLISHER}&ued=https%3A%2F%2Fwww.kabum.com.br%2Fp`
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: `a https://www.kabum.com.br/produto/1 b ${own} c https://tidd.ly/conc` } })
  assert.equal(res.statusCode, 200)
  const { results } = JSON.parse(res.body)
  assert.deepEqual(results.map((r) => [r.platform, r.status, r.code]), [
    ['awin', 'converted', null],
    ['awin', 'already_own_link', null],
    ['awin', 'error', 'AWIN_STORE_NOT_JOINED'],
  ])
  assert.equal(results[0].convertedUrl, 'https://tidd.ly/dela')
  assert.equal(results[0].label, 'Awin')
})

test('Converter links sem conta Awin: link da KaBuM continua "não compatível"', async (t) => {
  const app = await buildApp({ awinContext: null, converter: async () => 'nunca' })
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: 'https://www.kabum.com.br/produto/1' } })
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).code, 'LINK_CONVERSION_NO_LINKS')
})

test('Criar oferta: página de loja Awin sai com o link DELA; nome e foto vêm da página da loja', async (t) => {
  const scraped = []
  const images = []
  const app = await buildApp({
    awinContext: context({}),
    converter: async () => ({ url: 'https://tidd.ly/dela', awin: { own: false, destinationUrl: 'https://www.kabum.com.br/produto/1', advertiserId: 17729 } }),
    fetchProductInfo: async (url) => { scraped.push(url); return { title: 'Placa de vídeo', newPrice: 'R$ 999' } },
    fetchProductImage: async (platform, url) => { images.push([platform, url]); return 'https://img.kabum.com.br/1.jpg' },
  })
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: 'https://www.kabum.com.br/produto/1' } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.title, 'Placa de vídeo')
  assert.equal(body.offerUrl, 'https://tidd.ly/dela')
  assert.equal(body.imageUrl, 'https://img.kabum.com.br/1.jpg')
  assert.deepEqual(scraped, ['https://www.kabum.com.br/produto/1'])
  assert.deepEqual(images, [['awin', 'https://www.kabum.com.br/produto/1']])
})

test('Criar oferta: link Awin que já é dela fica como ela colou', async (t) => {
  const own = `https://www.awin1.com/cread.php?awinmid=17729&awinaffid=${PUBLISHER}&ued=https%3A%2F%2Fwww.kabum.com.br%2Fp`
  const app = await buildApp({
    awinContext: context({}),
    converter: async (platform, url) => ({ url, awin: { own: true, destinationUrl: 'https://www.kabum.com.br/p' } }),
    fetchProductInfo: async () => ({ title: 'X' }),
  })
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: own } })
  assert.equal(JSON.parse(res.body).offerUrl, own)
})

// RCA 2026-09-30: oferta espelhada com tidd.ly saía sem foto — a foto era
// buscada abrindo o link de clique (redirecionador da Awin) e não a página da loja.
test('foto de link Awin: vem da página da loja, sem abrir o link de clique até o fim', async () => {
  const { awinStorePageUrl } = await import('../src/converters/awin.js')
  const resolveShortUrl = async (url) => {
    assert.equal(url, 'https://tidd.ly/4xXIjUX')
    return 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=2701264&ued=https://www.kabum.com.br/produto/645897&platform=sl'
  }
  assert.equal(await awinStorePageUrl('https://tidd.ly/4xXIjUX', { resolveShortUrl }), 'https://www.kabum.com.br/produto/645897')
  assert.equal(
    await awinStorePageUrl('https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Fwww.cea.com.br%2Fx%3Futm_source%3Dconc'),
    'https://www.cea.com.br/x',
  )
  assert.equal(await awinStorePageUrl('https://www.kabum.com.br/p/1'), 'https://www.kabum.com.br/p/1')
  assert.equal(await awinStorePageUrl('https://tidd.ly/quebrado', { resolveShortUrl: async () => null }), null)

  const src = readFileSync(new URL('../src/converters/imageScrapers.js', import.meta.url), 'utf8')
  const guard = src.indexOf("if (platform === 'awin') {")
  const cache = src.indexOf('const cached = getCached(productUrl)')
  assert.ok(guard > 0 && guard < cache, 'a troca para a página da loja precisa vir antes do cache e do fetch')
  assert.match(src, /productUrl = storePage/)
})

// ---------- revisão crítica 2026-09-30: casos de borda ----------

test('F1: link Awin de concorrente SEM página vira link dela para a página inicial da mesma loja', async () => {
  const client = fakeClient()
  const result = await convert('https://www.awin1.com/cread.php?awinmid=17729&awinaffid=111111', context({ client }))
  assert.equal(result.url, 'https://tidd.ly/abc')
  assert.equal(client.calls[0].advertiserId, 17729)
  assert.equal('destinationUrl' in client.calls[0], false, 'sem página: a Awin manda para a página inicial')
  // Sem vaga na Awin: o longo sai sem `ued` (página inicial), nunca descarta.
  const fallback = await convert('https://www.awin1.com/cread.php?awinmid=17729&awinaffid=111111', context({ client: fakeClient(new AwinRateLimitError(null)) }))
  assert.equal(fallback.url, 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=2701264')
})

test('F1: página de OUTRO site dentro do link Awin nunca vai junto (vai a página inicial da loja)', async () => {
  const client = fakeClient()
  await convert('https://www.awin1.com/cread.php?awinmid=17729&awinaffid=111111&ued=https%3A%2F%2Fgolpe.example.com%2Fx', context({ client }))
  assert.equal('destinationUrl' in client.calls[0], false)
})

test('F2: sufixo público e plataforma compartilhada nunca viram loja da Awin', () => {
  const stores = extractProgrammes([{ id: 1, name: 'Ruim', displayUrl: 'https://linktr.ee/loja', validDomains: [{ domain: '*.com.br' }, { domain: 'com.br' }, { domain: 'chat.whatsapp.com' }, { domain: 'bit.ly' }, { domain: '*.lojaboa.com.br' }] }])
  assert.deepEqual(stores[0].domains, ['lojaboa.com.br'])
  const matcher = createAwinStoreMatcher(stores.map((s) => ({ ...s, accountId: 'a', publisherId: PUBLISHER })))
  assert.equal(matcher.isAwinLink('https://www.qualquercoisa.com.br/x'), false)
  assert.equal(matcher.isAwinLink('https://chat.whatsapp.com/abc'), false)
  assert.equal(matcher.isAwinLink('https://www.lojaboa.com.br/p/1'), true)
})

test('F3: tidd.ly / awin1.com SEM https no texto final bloqueia o envio (com ou sem conta Awin)', () => {
  assert.deepEqual(findUnconvertedStoreLinks('corre tidd.ly/abc123 agora', []), ['tidd.ly/abc123'])
  assert.deepEqual(findUnconvertedStoreLinks('www.awin1.com/cread.php?awinmid=1&awinaffid=2', []), ['www.awin1.com/cread.php?awinmid=1&awinaffid=2'])
  // O link DELA (convertido) continua liberado.
  assert.deepEqual(findUnconvertedStoreLinks('veja https://tidd.ly/dela', [{ converted: 'https://tidd.ly/dela' }]), [])
  // Menção sem caminho não é link de ninguém.
  assert.deepEqual(findUnconvertedStoreLinks('achei no tidd.ly', []), [])
})

test('F4: site próprio de grupo que leva a loja Awin é desembrulhado; sem conta Awin, não', async () => {
  const { extractStoreUrlsFromHtml } = await import('../src/core/customDomainLinkResolver.js')
  const html = '<a href="https://www.kabum.com.br/produto/931218">Comprar</a> <a href="https://tidd.ly/xyz">x</a>'
  const awin = createAwinStoreMatcher(storesFor())
  assert.deepEqual(extractStoreUrlsFromHtml(html), [])
  assert.deepEqual(extractStoreUrlsFromHtml(html, { awin }).map((l) => [l.platform, l.url]), [
    ['awin', 'https://www.kabum.com.br/produto/931218'],
    ['awin', 'https://tidd.ly/xyz'],
  ])
  const src = readFileSync(new URL('../src/core/customDomainLinkResolver.js', import.meta.url), 'utf8')
  assert.match(src, /const cacheKey = awin \? `awin\|\$\{candidateUrl\}` : candidateUrl/, 'cache separado: resultado com lojas Awin não vaza para outra cliente')
})

// ---------- R2/R3/R7: Awin lenta ou fora do ar não segura a fila ----------

import {
  AWIN_BREAKER_FAILURES,
  AWIN_BREAKER_OPEN_MS,
  AWIN_SHORT_FAIL_TTL_MS,
  awinBreakerIsOpen,
  resetAwinRuntimeState,
  resolveAwinShortUrlCached,
} from '../src/converters/awin.js'
import { AwinAuthError, AwinHttpError } from '../src/integrations/awin/errors.js'

function slowClient(ms) {
  const calls = []
  return {
    calls,
    generateLink: (token, publisherId, body) => {
      calls.push(body)
      return new Promise((resolve) => setTimeout(() => resolve({ shortUrl: 'https://tidd.ly/lento' }), ms).unref())
    },
  }
}

test('R2: Awin lenta → link longo em até 4 s; 3 falhas seguidas abrem o disjuntor (sem chamada por 5 min)', async () => {
  resetAwinRuntimeState()
  let clock = Date.now()
  const client = slowClient(60_000)
  const creds = context({ client, now: () => clock })
  const started = Date.now()
  const first = await convert('https://www.kabum.com.br/produto/1', { ...creds, generateTimeoutMs: 50 })
  assert.ok(Date.now() - started < 1_000)
  assert.match(first.url, /awin1\.com\/cread\.php/)
  await convert('https://www.kabum.com.br/produto/2', { ...creds, generateTimeoutMs: 50 })
  await convert('https://www.kabum.com.br/produto/3', { ...creds, generateTimeoutMs: 50 })
  assert.equal(client.calls.length, AWIN_BREAKER_FAILURES)
  assert.equal(awinBreakerIsOpen('acc-1', clock), true)
  const blocked = await convert('https://www.kabum.com.br/produto/4', creds)
  assert.match(blocked.url, /awin1\.com\/cread\.php\?awinmid=17729&awinaffid=2701264/)
  assert.equal(client.calls.length, AWIN_BREAKER_FAILURES, 'disjuntor aberto: nenhuma chamada')
  // Passados 5 min, tenta de novo; sucesso fecha o disjuntor.
  clock += AWIN_BREAKER_OPEN_MS + 1
  const ok = await convert('https://www.kabum.com.br/produto/5', { ...creds, client: fakeClient() })
  assert.equal(ok.url, 'https://tidd.ly/abc')
  assert.equal(awinBreakerIsOpen('acc-1', clock), false)
  resetAwinRuntimeState()
})

test('R7: código recusado abre o disjuntor na hora; limite por minuto e 4xx de um link não abrem', async () => {
  resetAwinRuntimeState()
  await convert('https://www.kabum.com.br/produto/1', context({ client: fakeClient(new AwinRateLimitError(null)) }))
  await convert('https://www.kabum.com.br/produto/2', context({ client: fakeClient(new AwinRateLimitError(null)) }))
  await convert('https://www.kabum.com.br/produto/3', context({ client: fakeClient(new AwinRateLimitError(null)) }))
  await convert('https://www.kabum.com.br/produto/4', context({ client: fakeClient(new AwinHttpError(400)) }))
  await convert('https://www.kabum.com.br/produto/5', context({ client: fakeClient(new AwinHttpError(400)) }))
  await convert('https://www.kabum.com.br/produto/6', context({ client: fakeClient(new AwinHttpError(400)) }))
  assert.equal(awinBreakerIsOpen('acc-1'), false)
  await convert('https://www.kabum.com.br/produto/7', context({ client: fakeClient(new AwinAuthError(401)) }))
  assert.equal(awinBreakerIsOpen('acc-1'), true)
  resetAwinRuntimeState()
})

test('R2: teto por mensagem — sem tempo sobrando sai o link longo sem chamar a Awin', async () => {
  resetAwinRuntimeState()
  const client = fakeClient()
  const result = await convert('https://www.kabum.com.br/produto/1', context({ client }), { deadline: Date.now() - 1 })
  assert.match(result.url, /awin1\.com\/cread\.php/)
  assert.equal(client.calls.length, 0)
  // Pela rota de sempre (convertLink) o teto chega ao conversor.
  const viaIndex = await convertLink('awin', 'https://www.kabum.com.br/produto/2', { awin: context({ client }) }, { deadline: Date.now() - 1 })
  assert.match(viaIndex.url, /awin1\.com\/cread\.php/)
  assert.equal(client.calls.length, 0)
})

test('R2: tidd.ly que não abriu fica guardado como falha por 5 min (não gasta 3 s de novo)', async () => {
  resetAwinRuntimeState()
  let calls = 0
  let clock = 1_000_000
  const fetchFn = async () => { calls++; throw new Error('rede') }
  assert.equal(await resolveAwinShortUrlCached('https://tidd.ly/falha', { fetchFn, now: () => clock }), null)
  assert.equal(await resolveAwinShortUrlCached('https://tidd.ly/falha', { fetchFn, now: () => clock }), null)
  assert.equal(calls, 1)
  clock += AWIN_SHORT_FAIL_TTL_MS + 1
  await resolveAwinShortUrlCached('https://tidd.ly/falha', { fetchFn, now: () => clock })
  assert.equal(calls, 2)
  resetAwinRuntimeState()
})

test('R3: corpo da resposta do tidd.ly é descartado; teto vale para todos os saltos juntos', async () => {
  let cancelled = 0
  const fetchFn = async (url) => ({
    status: 301,
    headers: { get: () => (url.includes('/a') ? 'https://tidd.ly/b' : 'https://www.awin1.com/cread.php?awinmid=17729&awinaffid=1') },
    body: { cancel: async () => { cancelled++ } },
  })
  const target = await resolveAwinShortUrl('https://tidd.ly/a', { fetchFn })
  assert.match(target, /awin1\.com/)
  assert.equal(cancelled, 2)
  const hang = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort'))))
  const started = Date.now()
  assert.equal(await resolveAwinShortUrl('https://tidd.ly/a', { fetchFn: hang, timeoutMs: 100 }), null)
  assert.ok(Date.now() - started < 1_000)
})

test('bot-worker: conversão da Awin recebe o teto da mensagem', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /const awinDeadline = Date\.now\(\) \+ AWIN_MESSAGE_BUDGET_MS/)
  assert.match(src, /convertLink\(platform, url, cfg\.credentials, platform === 'awin' \? \{ deadline: awinDeadline \} : undefined\)/)
})
