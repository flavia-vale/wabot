// Conversão de links pela Rakuten (docs/rca/afiliados-rakuten.md): lojas
// aprovadas, detector com prioridade entre redes (Awin antes da Rakuten),
// sanitizador, conversor (deep link montado sem chamada), nunca abrir o link
// de clique, sync das lojas + id dos links, contexto do banco e rotas.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import db from '../src/db.js'
import {
  buildRakutenDeepLink,
  cleanRakutenDestinationUrl,
  createRakutenStoreMatcher,
  extractApprovedMerchants,
  extractRakutenLinkId,
  normalizeRakutenStoreDomain,
  parseRakutenClickUrl,
  storeDomainsFromUrl,
} from '../src/integrations/rakuten/storeMatcher.js'
import { createAwinStoreMatcher, extractProgrammes } from '../src/integrations/awin/storeMatcher.js'
import { AFFILIATE_NETWORK_PRIORITY, detectLinks, isOfferUrl, networkForUrl } from '../src/detector.js'
import { sanitizeInviteLinks } from '../src/messageProcessor.js'
import { findUnconvertedStoreLinks } from '../src/core/mirrorLinkGuard.js'
import { findCandidateLinks } from '../src/core/customDomainLinkResolver.js'
import { RAKUTEN_NOT_JOINED_ERROR, convert, rakutenStorePageUrl } from '../src/converters/rakuten.js'
import { convertLink } from '../src/converters/index.js'
import { buildScrapedOffer } from '../src/converters/offerEngine.js'
import { fetchProductImage } from '../src/converters/imageScrapers.js'
import { buildMonitoredMessagePayload, firstPreviewUrlCountsClick } from '../src/monitoredMessagePayload.js'
import { loadRakutenConversionContext, rakutenOfferOptions } from '../src/integrations/rakuten/conversionContext.js'
import { syncRakutenAccount } from '../src/integrations/rakuten/syncService.js'
import { validateCredentialData } from '../src/credentialHealth.js'
import { buildNoValidConversionsErrorMsg, CONVERSION_FAILURE } from '../src/core/conversionFailureReason.js'
import { describeConversionFailure } from '../src/credentialBlockAlert/message.js'
import { describeConversionTest } from '../src/domain/painel/conversionTest.js'
import { linkConversionRoutes } from '../src/api/routes/linkConversion.js'

const LINK_ID = 'AbCdEfGhIjK'
const OTHER_ID = 'ZzConcorren'
// Formato documentado do Link Locator (⚠️ a confirmar com diag-rakuten.mjs).
const MERCHANTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ns1:getMerchByAppStatusResponse xmlns:ns1="http://endpoint.linkservice.linkshare.com/">
  <ns1:return><ns1:applicationStatus>Approved</ns1:applicationStatus><ns1:categories>1 2</ns1:categories><ns1:mid>43984</ns1:mid><ns1:name>Netshoes WL</ns1:name><ns1:offer><ns1:offerId>1897539</ns1:offerId><ns1:offerName>Padrão</ns1:offerName></ns1:offer></ns1:return>
  <ns1:return><ns1:applicationStatus>Approved</ns1:applicationStatus><ns1:mid>54198</ns1:mid><ns1:name>Cruzeiro Store &amp; Cia</ns1:name></ns1:return>
</ns1:getMerchByAppStatusResponse>`

const STORES = [
  { accountId: 'acc-1', linkId: LINK_ID, advertiserId: '43984', name: 'Netshoes WL', domains: ['netshoes.com.br'] },
  { accountId: 'acc-1', linkId: LINK_ID, advertiserId: '54198', name: 'Cruzeiro Store', domains: ['cruzeirostore.com.br'] },
]

function context() {
  return {
    accountsById: new Map([['acc-1', { id: 'acc-1', linkId: LINK_ID }]]),
    linkIds: new Set([LINK_ID]),
    stores: STORES,
    matcher: createRakutenStoreMatcher(STORES, { linkIds: [LINK_ID] }),
  }
}

const deepLink = (id, mid, page) => `https://click.linksynergy.com/deeplink?id=${id}&mid=${mid}&murl=${encodeURIComponent(page)}`

// ---------- lojas e links (puro) ----------

test('Link Locator: lojas aprovadas (mid + nome), sem confundir com o nome da oferta; resposta estranha = null', () => {
  assert.deepEqual(extractApprovedMerchants(MERCHANTS_XML), [
    { advertiserId: '43984', name: 'Netshoes WL' },
    { advertiserId: '54198', name: 'Cruzeiro Store & Cia' },
  ])
  assert.equal(extractApprovedMerchants('<html>erro</html>'), null)
  assert.deepEqual(extractApprovedMerchants('<ns1:getMerchByAppStatusResponse xmlns:ns1="x"></ns1:getMerchByAppStatusResponse>'), [])
})

test('domínio da loja sai do site dela; nunca a própria Rakuten', () => {
  assert.deepEqual(storeDomainsFromUrl('https://www.netshoes.com.br/'), ['netshoes.com.br'])
  assert.deepEqual(storeDomainsFromUrl(null), [])
  assert.equal(normalizeRakutenStoreDomain('https://click.linksynergy.com/x'), null)
})

test('link da Rakuten: lê id, loja e página; o id da cliente sai do clickurl das promoções', () => {
  assert.deepEqual(parseRakutenClickUrl(deepLink(OTHER_ID, '43984', 'https://www.netshoes.com.br/tenis-x')), {
    linkId: OTHER_ID, advertiserId: '43984', destinationUrl: 'https://www.netshoes.com.br/tenis-x',
  })
  assert.deepEqual(parseRakutenClickUrl(`https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=1897539.1097&type=3`), {
    linkId: OTHER_ID, advertiserId: null, destinationUrl: null,
  })
  assert.equal(parseRakutenClickUrl('https://www.netshoes.com.br/x'), null)
  assert.equal(extractRakutenLinkId(`https://click.linksynergy.com/fs-bin/click?id=${LINK_ID}&offerid=1.2&type=3&subid=0`), LINK_ID)
  assert.equal(
    buildRakutenDeepLink({ linkId: LINK_ID, advertiserId: '43984', destinationUrl: 'https://www.netshoes.com.br/p?cor=azul' }),
    `https://click.linksynergy.com/deeplink?id=${LINK_ID}&mid=43984&murl=https%3A%2F%2Fwww.netshoes.com.br%2Fp%3Fcor%3Dazul`,
  )
})

test('página limpa: sai o rastreio do concorrente (utm, ranSiteID…) e fica o que muda a página', () => {
  assert.equal(
    cleanRakutenDestinationUrl('https://www.netshoes.com.br/p?cor=azul&utm_source=conc&ranMID=43984&ranEAID=x&ranSiteID=conc-123&siteID=conc#topo'),
    'https://www.netshoes.com.br/p?cor=azul',
  )
})

test('matcher: loja aprovada por domínio/subdomínio; link de outra pessoa só com página E loja aprovada; o dela sempre', () => {
  const { matcher } = context()
  assert.ok(matcher.isRakutenLink('https://www.netshoes.com.br/tenis'))
  assert.ok(matcher.isRakutenLink('https://m.netshoes.com.br/tenis'))
  assert.ok(!matcher.isRakutenLink('https://fakenetshoes.com.br/tenis'))
  assert.ok(!matcher.isRakutenLink('https://www.centauro.com.br/x'), 'loja não aprovada')
  assert.ok(matcher.isRakutenLink(deepLink(OTHER_ID, '43984', 'https://www.netshoes.com.br/x')), 'concorrente, loja aprovada')
  assert.ok(matcher.isRakutenLink(deepLink(OTHER_ID, '99999', 'https://www.netshoes.com.br/x')), 'mid desconhecido mas página de loja aprovada')
  assert.ok(!matcher.isRakutenLink(deepLink(OTHER_ID, '99999', 'https://www.centauro.com.br/x')), 'concorrente, loja não aprovada')
  // Sem `murl` não dá para saber a loja sem abrir o link — e abrir conta clique.
  assert.ok(!matcher.isRakutenLink(`https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=1.2&type=3`))
  assert.ok(matcher.isRakutenLink(`https://click.linksynergy.com/fs-bin/click?id=${LINK_ID}&offerid=1.2&type=3`), 'link dela, mesmo sem página')
})

// ---------- detector: prioridade entre redes ----------

const AWIN_STORES = extractProgrammes([
  { id: 17729, name: 'Kabum BR', displayUrl: 'https://www.kabum.com.br/', validDomains: [{ domain: 'kabum.com.br' }] },
  // Mesma loja nas duas redes (Netshoes) → decide a ordem fixa.
  { id: 555, name: 'Netshoes BR', displayUrl: 'https://www.netshoes.com.br/', validDomains: [{ domain: 'netshoes.com.br' }] },
]).map((store) => ({ ...store, accountId: 'awin-1', publisherId: '2701264' }))
const awinMatcher = createAwinStoreMatcher(AWIN_STORES, { publisherIds: ['2701264'] })

test('ordem fixa: Awin antes da Rakuten (decisão 2026-09-30); Lomadee ainda não entra', () => {
  assert.deepEqual(AFFILIATE_NETWORK_PRIORITY.map(([network]) => network), ['awin', 'rakuten'])
})

test('mesma loja nas duas redes sai pela Awin; Awin desligada/sem conta → Rakuten; loja só da Rakuten → Rakuten', () => {
  const { matcher } = context()
  const both = { awin: awinMatcher, rakuten: matcher }
  assert.equal(networkForUrl('https://www.netshoes.com.br/tenis', both), 'awin')
  assert.equal(networkForUrl('https://www.netshoes.com.br/tenis', { rakuten: matcher }), 'rakuten')
  assert.equal(networkForUrl('https://www.cruzeirostore.com.br/camisa', both), 'rakuten')
  assert.equal(networkForUrl('https://www.kabum.com.br/p', both), 'awin')
  // Link de rastreio fica na rede dele: a Awin não reconhece link da Rakuten.
  assert.equal(networkForUrl(deepLink(OTHER_ID, '43984', 'https://www.netshoes.com.br/x'), both), 'rakuten')
  assert.equal(networkForUrl('https://www.centauro.com.br/x', both), null)
})

test('detector: lojas fixas sempre ganham; links de rede aparecem na ordem do texto com a rede certa', () => {
  const both = { awin: awinMatcher, rakuten: context().matcher }
  const text = 'a https://www.cruzeirostore.com.br/c b https://www.netshoes.com.br/n c https://shopee.com.br/s d https://www.kabum.com.br/k'
  assert.deepEqual(detectLinks(text, both).map((l) => [l.platform, l.url]), [
    ['shopee', 'https://shopee.com.br/s'],
    ['rakuten', 'https://www.cruzeirostore.com.br/c'],
    ['awin', 'https://www.netshoes.com.br/n'],
    ['awin', 'https://www.kabum.com.br/k'],
  ])
  // Loja fixa que um dia aparecer na Rakuten continua dela.
  const shopeeNaRakuten = createRakutenStoreMatcher([{ accountId: 'acc-1', advertiserId: '1', name: 'Shopee', domains: ['shopee.com.br'] }], { linkIds: [LINK_ID] })
  assert.deepEqual(detectLinks('https://shopee.com.br/x', { rakuten: shopeeNaRakuten }).map((l) => l.platform), ['shopee'])
})

test('sem conta Rakuten nada muda: link da Netshoes não é loja e o sanitizador apaga', () => {
  const text = 'Tênis https://www.netshoes.com.br/tenis e https://shopee.com.br/x'
  assert.deepEqual(detectLinks(text).map((l) => l.platform), ['shopee'])
  assert.ok(!isOfferUrl('https://www.netshoes.com.br/tenis'))
  assert.doesNotMatch(sanitizeInviteLinks(text), /netshoes/)
  assert.deepEqual(rakutenOfferOptions(null), {})
})

test('com conta Rakuten: link de loja aprovada fica; link de outra pessoa sem página é apagado e o resto segue', () => {
  const options = rakutenOfferOptions(context())
  const semPagina = `https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=1.2&type=3`
  const text = `Tênis https://www.netshoes.com.br/tenis\nCupom ${semPagina}\nMais https://shopee.com.br/x`
  const sanitized = sanitizeInviteLinks(text, options)
  assert.match(sanitized, /netshoes\.com\.br\/tenis/)
  assert.doesNotMatch(sanitized, /fs-bin\/click/)
  assert.deepEqual(detectLinks(sanitized, options).map((l) => l.platform), ['shopee', 'rakuten'])
  // Loja aprovada não é "site próprio de grupo": não é desembrulhada (aberta).
  assert.deepEqual(findCandidateLinks('https://www.netshoes.com.br/tenis', options), [])
})

test('rede de segurança final: link da loja Rakuten sem converter é barrado; o convertido passa', () => {
  const options = rakutenOfferOptions(context())
  const converted = deepLink(LINK_ID, '43984', 'https://www.netshoes.com.br/tenis')
  assert.deepEqual(findUnconvertedStoreLinks(`Oferta ${converted}`, [{ converted }], options), [])
  assert.deepEqual(findUnconvertedStoreLinks('Oferta https://www.netshoes.com.br/tenis', [], options), ['https://www.netshoes.com.br/tenis'])
})

// ---------- conversor ----------

test('página de loja aprovada → deep link DELA, montado sem chamada, sem o rastreio do concorrente', async () => {
  const result = await convert('https://www.netshoes.com.br/tenis-x?utm_source=conc&ranSiteID=conc-1&cor=azul', context())
  assert.equal(result.url, deepLink(LINK_ID, '43984', 'https://www.netshoes.com.br/tenis-x?cor=azul').replace(/%20/g, '+'))
  assert.deepEqual(result.rakuten, { own: false, advertiserId: '43984', storeName: 'Netshoes WL', destinationUrl: 'https://www.netshoes.com.br/tenis-x?cor=azul' })
})

test('deep link de concorrente → mesma página com o link DELA', async () => {
  const result = await convert(deepLink(OTHER_ID, '54198', 'https://www.cruzeirostore.com.br/camisa'), context())
  assert.ok(result.url.startsWith(`https://click.linksynergy.com/deeplink?id=${LINK_ID}&mid=54198&murl=`))
  assert.equal(result.rakuten.destinationUrl, 'https://www.cruzeirostore.com.br/camisa')
})

test('link que já é dela fica como está (mesmo sem página)', async () => {
  const own = `https://click.linksynergy.com/fs-bin/click?id=${LINK_ID}&offerid=1897539.1097&type=3`
  const result = await convert(own, context())
  assert.equal(result.url, own)
  assert.equal(result.rakuten.own, true)
})

test('loja em que ela NÃO foi aprovada, ou sem página → não converte (a oferta não sai com o link de outra pessoa)', async () => {
  await assert.rejects(convert(deepLink(OTHER_ID, '777', 'https://www.centauro.com.br/x'), context()), (err) => err.stripFromMessage && err.rakutenReason === RAKUTEN_NOT_JOINED_ERROR)
  await assert.rejects(convert('https://www.centauro.com.br/x', context()), (err) => err.rakutenReason === RAKUTEN_NOT_JOINED_ERROR)
  await assert.rejects(convert(`https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=1.2`, context()), (err) => err.stripFromMessage)
  await assert.rejects(convert('https://www.netshoes.com.br/x', null), (err) => err.stripFromMessage && err.rakutenReason === 'no_account')
})

// Mesmo critério da Awin: a loja vem da página OU do `mid`. Página num domínio
// que não conhecemos (outro site da mesma loja) segue pela loja do `mid`; a
// Rakuten confere o domínio no clique.
test('link de outra pessoa com loja aprovada no mid e página em outro domínio → segue pela loja do mid', async () => {
  const result = await convert(deepLink(OTHER_ID, '43984', 'https://outlet.netshoes.net/x'), context())
  assert.equal(result.rakuten.advertiserId, '43984')
  assert.ok(result.url.startsWith(`https://click.linksynergy.com/deeplink?id=${LINK_ID}&mid=43984&murl=`))
})

test('convertLink("rakuten") usa o contexto das credenciais e devolve o campo rakuten', async () => {
  const result = await convertLink('rakuten', 'https://www.netshoes.com.br/x', { rakuten: context() })
  assert.ok(result.url.includes(`id=${LINK_ID}`))
  assert.equal(result.rakuten.advertiserId, '43984')
})

// ---------- nunca abrir o link de clique ----------

test('página da loja por trás de um link da Rakuten: só pelo murl; sem ele, null (nunca o link de clique)', () => {
  assert.equal(rakutenStorePageUrl(deepLink(OTHER_ID, '43984', 'https://www.netshoes.com.br/x?utm_source=a')), 'https://www.netshoes.com.br/x')
  assert.equal(rakutenStorePageUrl(`https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=1.2`), null)
  assert.equal(rakutenStorePageUrl('https://www.netshoes.com.br/x'), 'https://www.netshoes.com.br/x')
})

test('foto de link Rakuten sem página: devolve null sem fazer NENHUMA chamada de rede', async (t) => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url) => { calls.push(String(url)); throw new Error('não era para buscar') }
  t.after(() => { globalThis.fetch = original })
  const stages = []
  const image = await fetchProductImage('rakuten', `https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=9.9`, {}, { onDiagnostic: (e) => stages.push(e.stage) })
  assert.equal(image, null)
  assert.deepEqual(calls, [])
  assert.deepEqual(stages, ['rakuten_sem_pagina_da_loja'])
})

test('mensagem só com texto cujo 1º link é da Rakuten: desliga a prévia automática (o Baileys abriria o link)', () => {
  const link = deepLink(LINK_ID, '43984', 'https://www.netshoes.com.br/x')
  assert.ok(firstPreviewUrlCountsClick(`Oferta ${link}`))
  assert.ok(!firstPreviewUrlCountsClick(`Oferta https://shopee.com.br/x ${link}`), 'o Baileys só olha o 1º link')
  assert.ok(!firstPreviewUrlCountsClick('Oferta https://www.netshoes.com.br/x'))
  assert.equal(buildMonitoredMessagePayload({ finalText: `Oferta ${link}`, useLinkPreview: true }).primary.linkPreview, null)
  assert.ok(!('linkPreview' in buildMonitoredMessagePayload({ finalText: 'Oferta https://shopee.com.br/x' }).primary), 'outras lojas: como antes')
  const manual = { 'matched-text': link, title: 'T' }
  assert.deepEqual(buildMonitoredMessagePayload({ finalText: `Oferta ${link}`, useLinkPreview: true, linkPreview: manual }).primary.linkPreview, manual, 'card montado por nós continua')
})

test('Criar oferta: título/preço lidos da página da loja (murl), nunca do link de clique', async () => {
  const scraped = []
  const fetchProductInfo = async (url) => { scraped.push(url); return { title: 'Tênis', newPrice: 'R$ 199' } }
  const offer = await buildScrapedOffer({
    url: deepLink(OTHER_ID, '43984', 'https://www.netshoes.com.br/tenis'),
    platform: 'rakuten',
    credentialsMap: { rakuten: context() },
    convertLink,
    fetchProductInfo,
  })
  assert.equal(offer.title, 'Tênis')
  assert.ok(offer.offerUrl.includes(`id=${LINK_ID}`))
  assert.deepEqual(scraped, ['https://www.netshoes.com.br/tenis'])

  // Não converteu (loja não aprovada) e sem página: não lê nada.
  scraped.length = 0
  await buildScrapedOffer({
    url: `https://click.linksynergy.com/fs-bin/click?id=${OTHER_ID}&offerid=1.2`,
    platform: 'rakuten',
    credentialsMap: { rakuten: context() },
    convertLink,
    fetchProductInfo,
  })
  assert.deepEqual(scraped, [])
})

// ---------- cadastro, motivo e textos ----------

test('Rakuten conta como "cadastrada" só com conta pronta (id dos links) e loja aprovada', () => {
  assert.equal(validateCredentialData('rakuten', context()).configured, true)
  assert.equal(validateCredentialData('rakuten', null).configured, false)
  const semLojas = validateCredentialData('rakuten', { ...context(), stores: [] })
  assert.equal(semLojas.configured, false)
  assert.match(semLojas.warnings[0], /Nenhuma loja aprovada/)
})

test('motivo "loja da Rakuten sem aprovação" viaja no errorMsg e explica o que fazer', () => {
  const errorMsg = buildNoValidConversionsErrorMsg([CONVERSION_FAILURE.RAKUTEN_STORE_NOT_JOINED])
  assert.equal(errorMsg, 'skip:no_valid_conversions:rakuten_store_not_joined')
  const described = describeConversionFailure(errorMsg, 'rakuten')
  assert.equal(described.tag.label, 'loja da Rakuten sem aprovação')
  assert.match(described.texto, /inscreva-se no programa dela na Rakuten/)
  assert.match(describeConversionTest({ code: 'RAKUTEN_STORE_NOT_JOINED' }).titulo, /Rakuten/)
})

test('robô: Rakuten respeita a chave do grupo, entra em todas as pontas e o motivo certo vai para o painel', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /const rakutenBase = lojasLigadasNoGrupo\.includes\('rakuten'\) \? rakutenOfferOptions\(cfg\.credentials\.rakuten\) : \{\}/)
  assert.match(src, /offerOptions: \{ \.\.\.awinBase, \.\.\.rakutenBase \}/)
  assert.match(src, /\.\.\.rakutenBase,\n\s+\}/)
  assert.match(src, /err\.rakutenReason === RAKUTEN_NOT_JOINED_ERROR\s+\? CONVERSION_FAILURE\.RAKUTEN_STORE_NOT_JOINED/)
  assert.match(src, /loadRakutenConversionContext\(userId, \{ db \}\)/)
  const groups = readFileSync(new URL('../src/api/routes/groups.js', import.meta.url), 'utf8')
  assert.match(groups, /'awin', 'rakuten'\]\.includes\(p\)/)
  for (const script of ['deploy_safe_dashboard.sh', 'deploy_safe_staging.sh']) {
    assert.match(readFileSync(new URL(`../scripts/${script}`, import.meta.url), 'utf8'), /src\/integrations\/rakuten\//, `${script}: o robô carrega a conversão da Rakuten`)
  }
})

// ---------- banco: sync e contexto ----------

let seq = 0
async function makeAccount(overrides = {}) {
  const userId = `rk-conv-${++seq}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Rakuten', email: `${userId}@rakuten.local`, passwordHash: 'x', plan: 'basic' } })
  const account = await db.rakutenAccount.create({
    data: {
      userId, label: 'Conta', sid: String(4640000 + seq),
      clientIdEncrypted: 'client-id-de-teste', clientIdLast4: 'este',
      clientSecretEncrypted: 'segredo-de-teste', clientSecretLast4: 'este',
      credentialFingerprint: 'fp', ...overrides,
    },
  })
  return { userId, account }
}

async function cleanup(userId) {
  await db.rakutenAccount.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

const feedXml = readFileSync(new URL('./fixtures/rakuten-coupons-page.xml', import.meta.url), 'utf8')

function fakeClient({ merchants = MERCHANTS_XML, feed = feedXml } = {}) {
  const calls = { advertisers: [] }
  return {
    calls,
    listCoupons: async (creds, { page }) => (page === 1 ? feed : '<couponfeed></couponfeed>'),
    getAdvertiser: async (creds, id) => {
      calls.advertisers.push(id)
      return { advertiser: { id: Number(id), name: `Loja ${id}`, url: id === '54198' ? 'https://www.cruzeirostore.com.br/' : 'https://www.netshoes.com.br/', logo_url: `https://merchant.linksynergy.com/fs/logo/lg_${id}` } }
    },
    listApprovedMerchants: async () => {
      if (merchants instanceof Error) throw merchants
      return merchants
    },
  }
}

const syncDeps = (client) => ({ db, client, now: () => new Date('2026-09-30T12:00:00Z'), decrypt: (value) => value })

test('sync grava as lojas aprovadas com domínio, o id dos links dela e apaga a loja que saiu', async () => {
  const { userId, account } = await makeAccount()
  try {
    await db.rakutenProgramme.create({ data: { userId, accountId: account.id, advertiserId: '11111', name: 'Saiu', domainsJson: '["saiu.com.br"]' } })
    const client = fakeClient()
    const result = await syncRakutenAccount(account.id, syncDeps(client))
    assert.equal(result.programmes, 2)
    const rows = await db.rakutenProgramme.findMany({ where: { accountId: account.id }, orderBy: { advertiserId: 'asc' } })
    assert.deepEqual(rows.map((row) => [row.advertiserId, row.name, JSON.parse(row.domainsJson)]), [
      ['43984', 'Netshoes WL', ['netshoes.com.br']],
      ['54198', 'Cruzeiro Store & Cia', ['cruzeirostore.com.br']],
    ])
    assert.equal((await db.rakutenAccount.findUnique({ where: { id: account.id } })).linkId, LINK_ID)

    // Segunda hora: site já conhecido não gasta chamada.
    const again = fakeClient()
    await syncRakutenAccount(account.id, syncDeps(again))
    assert.deepEqual(again.calls.advertisers, [])
  } finally {
    await cleanup(userId)
  }
})

test('sync: falha ou resposta estranha só na lista de lojas não derruba as promoções e mantém as lojas antigas', async () => {
  const { userId, account } = await makeAccount()
  try {
    await db.rakutenProgramme.create({ data: { userId, accountId: account.id, advertiserId: '43984', name: 'Netshoes', domainsJson: '["netshoes.com.br"]' } })
    const broken = await syncRakutenAccount(account.id, syncDeps(fakeClient({ merchants: new Error('fora do ar') })))
    assert.equal(broken.status, 'success')
    assert.ok(broken.errors.some((error) => /lista de lojas aprovadas/.test(error.message)))
    const weird = await syncRakutenAccount(account.id, syncDeps(fakeClient({ merchants: '<html>manutenção</html>' })))
    assert.equal(weird.programmes, null)
    assert.equal(await db.rakutenProgramme.count({ where: { accountId: account.id } }), 1)
    assert.ok(await db.rakutenPromotion.count({ where: { accountId: account.id } }) > 0)
  } finally {
    await cleanup(userId)
  }
})

test('sync sem promoção nesta hora mantém o id dos links que já tinha', async () => {
  const { userId, account } = await makeAccount({ linkId: 'IdAntigo123' })
  try {
    await syncRakutenAccount(account.id, syncDeps(fakeClient({ feed: '<couponfeed><TotalMatches>0</TotalMatches><TotalPages>0</TotalPages></couponfeed>' })))
    assert.equal((await db.rakutenAccount.findUnique({ where: { id: account.id } })).linkId, 'IdAntigo123')
  } finally {
    await cleanup(userId)
  }
})

test('contexto do banco: só contas com id dos links e dados válidos; lojas por conta; sem conta → null', async () => {
  const { userId, account } = await makeAccount({ linkId: LINK_ID })
  try {
    await db.rakutenAccount.create({ data: { userId, label: 'Sem id', sid: '999', clientIdEncrypted: 'a', clientIdLast4: 'a', clientSecretEncrypted: 'b', clientSecretLast4: 'b', credentialFingerprint: 'fp2' } })
    await db.rakutenAccount.create({ data: { userId, label: 'Recusada', sid: '998', linkId: 'OutroId1234', status: 'invalid_credential', clientIdEncrypted: 'a', clientIdLast4: 'a', clientSecretEncrypted: 'b', clientSecretLast4: 'b', credentialFingerprint: 'fp3' } })
    await db.rakutenProgramme.create({ data: { userId, accountId: account.id, advertiserId: '43984', name: 'Netshoes WL', domainsJson: '["netshoes.com.br"]' } })
    const ctx = await loadRakutenConversionContext(userId, { db })
    assert.equal(ctx.accountsById.size, 1)
    assert.deepEqual([...ctx.linkIds], [LINK_ID])
    assert.equal(ctx.matcher.storeForUrl('https://www.netshoes.com.br/x').advertiserId, '43984')
    assert.equal(JSON.stringify(ctx), JSON.stringify({ userId, accounts: 1, stores: 1 }))
    assert.equal(await loadRakutenConversionContext(`${userId}-sem-conta`, { db }), null)
  } finally {
    await cleanup(userId)
  }
})

// ---------- rotas ----------

async function buildApp({ awinContext = null, rakutenContext, converter, fetchProductInfo, fetchProductImage }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'rakuten-route-user' } })
  await app.register(linkConversionRoutes, {
    prefix: '/api/link-conversion',
    converter,
    fetchProductInfo: fetchProductInfo ?? (async () => ({})),
    fetchProductImage: fetchProductImage ?? (async () => null),
    findCredentials: async () => [],
    loadAwinContext: async () => awinContext,
    loadRakutenContext: async () => rakutenContext,
  })
  return app
}

test('Converter links: loja Rakuten converte; link que já é dela avisa; loja sem aprovação explica', async (t) => {
  const own = `https://click.linksynergy.com/fs-bin/click?id=${LINK_ID}&offerid=1.2&type=3`
  const app = await buildApp({ rakutenContext: context(), converter: (platform, url, credentials) => convertLink(platform, url, credentials) })
  t.after(() => app.close())
  const conc = deepLink(OTHER_ID, '777', 'https://www.cruzeirostore.com.br/x')
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: `a https://www.netshoes.com.br/tenis b ${own} c ${conc}` } })
  assert.equal(res.statusCode, 200)
  const { results } = JSON.parse(res.body)
  assert.deepEqual(results.map((r) => [r.platform, r.status]), [['rakuten', 'converted'], ['rakuten', 'already_own_link'], ['rakuten', 'converted']])
  assert.equal(results[0].label, 'Rakuten')

  // Loja não aprovada nem chega ao conversor: o detector não a reconhece.
  const notJoined = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: `x ${deepLink(OTHER_ID, '777', 'https://www.centauro.com.br/x')}` } })
  assert.equal(JSON.parse(notJoined.body).code, 'LINK_CONVERSION_NO_LINKS')
})

test('Converter links: se o conversor recusar a loja (lista mudou no meio), explica como se inscrever', async (t) => {
  const app = await buildApp({
    rakutenContext: context(),
    converter: async () => {
      const err = new Error('não aprovada')
      err.stripFromMessage = true
      err.rakutenReason = RAKUTEN_NOT_JOINED_ERROR
      throw err
    },
  })
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: 'https://www.netshoes.com.br/tenis' } })
  const [result] = JSON.parse(res.body).results
  assert.equal(result.code, 'RAKUTEN_STORE_NOT_JOINED')
  assert.match(result.error, /Inscreva-se no programa dela na Rakuten/)
})

test('Converter links sem conta Rakuten: link da Netshoes continua "não compatível"', async (t) => {
  const app = await buildApp({ rakutenContext: null, converter: async () => 'nunca' })
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: 'https://www.netshoes.com.br/tenis' } })
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).code, 'LINK_CONVERSION_NO_LINKS')
})

test('Criar oferta: página de loja Rakuten sai com o link DELA; nome e foto vêm da página da loja', async (t) => {
  const scraped = []
  const images = []
  const app = await buildApp({
    rakutenContext: context(),
    converter: (platform, url, credentials) => convertLink(platform, url, credentials),
    fetchProductInfo: async (url) => { scraped.push(url); return { title: 'Tênis', newPrice: 'R$ 199' } },
    fetchProductImage: async (platform, url) => { images.push([platform, url]); return 'https://static.netshoes.com.br/1.jpg' },
  })
  t.after(() => app.close())
  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: 'https://www.netshoes.com.br/tenis' } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(body.offerUrl.startsWith(`https://click.linksynergy.com/deeplink?id=${LINK_ID}&mid=43984`))
  assert.deepEqual(scraped, ['https://www.netshoes.com.br/tenis'])
  assert.deepEqual(images, [['rakuten', 'https://www.netshoes.com.br/tenis']])
})

test('reenvio pós-reinício: loja do link principal é "rakuten" (foto pela página, nunca pelo rótulo "shopee+rakuten")', async () => {
  const { primaryPlatformFromLog } = await import('../src/core/primaryPlatformFromLog.js')
  const row = { platform: 'shopee+rakuten', originalUrl: 'https://www.netshoes.com.br/tenis', convertedUrl: deepLink(LINK_ID, '43984', 'https://www.netshoes.com.br/tenis') }
  assert.equal(primaryPlatformFromLog(row, rakutenOfferOptions(context())), 'rakuten')
})
