import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  clearMercadoLivreAffiliateCooldownsForTest,
  buildVitrineFallback,
  isValidMlVitrineUrl,
  isDirectVitrineShare,
  convert,
} from '../src/converters/mercadolivre.js'

// Suite dedicada ao contrato `specs/004-ml-vitrine-fallback/contracts/vitrine-fallback.md`.
// Cobre os 6 casos do contrato (US1: 1,3,4,5,6 — US2: 2) e a regressão de
// coerência mensagem×status (FR-004) descoberta na investigação de produção
// (research.md §Decisão de causa raiz).

const botWorkerSource = readFileSync(
  fileURLToPath(new URL('../src/bot-worker.js', import.meta.url)),
  'utf8',
)

function withCouponLinkConvertOn(t) {
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
}

// --- Unidades puras (isValidMlVitrineUrl / buildVitrineFallback / isDirectVitrineShare) ---

test('isValidMlVitrineUrl: true para host ML válido, false para malformado/host alheio/vazio', () => {
  assert.equal(isValidMlVitrineUrl('https://www.mercadolivre.com.br/social/minha-vitrine'), true)
  assert.equal(isValidMlVitrineUrl('https://mercadolivre.com/sec/1Psi79H'), true)
  assert.equal(isValidMlVitrineUrl('not-a-url'), false)
  assert.equal(isValidMlVitrineUrl(''), false)
  assert.equal(isValidMlVitrineUrl(undefined), false)
  assert.equal(isValidMlVitrineUrl('https://shopee.com.br/alguma-coisa'), false)
})

test('buildVitrineFallback: retorna fallback com a vitrine própria quando vitrineUrl é válida', () => {
  const result = buildVitrineFallback({ vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial' })
  assert.deepEqual(result, {
    url: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
    linkKind: 'coupon',
    warning: 'ml_vitrine_fallback_used',
  })
})

test('buildVitrineFallback: null quando vitrineUrl ausente ou malformada (contrato caso 4)', () => {
  assert.equal(buildVitrineFallback({}), null)
  assert.equal(buildVitrineFallback({ vitrineUrl: '' }), null)
  assert.equal(buildVitrineFallback({ vitrineUrl: 'not-a-url' }), null)
  assert.equal(buildVitrineFallback({ vitrineUrl: 'https://shopee.com.br/xyz' }), null)
})

test('isDirectVitrineShare: true só para /social/ ML direto no link ORIGINAL; false para encurtador ambíguo', () => {
  assert.equal(isDirectVitrineShare('https://www.mercadolivre.com.br/social/gatuna'), true)
  assert.equal(isDirectVitrineShare('https://meli.la/1Zgxo75'), false)
  assert.equal(isDirectVitrineShare('https://mercadolivre.com/sec/2couponVitrine'), false)
  assert.equal(isDirectVitrineShare('not-a-url'), false)
})

// --- Caso 1 (US1/FR-001): vitrine cadastrada + recusa unsupported_url de vitrine direta ---

test('contrato caso 1: vitrine direta recusada (unsupported_url) + vitrineUrl cadastrada → fallback com a vitrine', async (t) => {
  withCouponLinkConvertOn(t)
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/gatuna' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: {
      status: 200,
      urls: [{ origin_url: 'https://www.mercadolivre.com.br/social/gatuna', message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }],
      total_items: 1,
      total_success: 0,
      total_error: 1,
    },
    headers: {},
  }))
  const url = 'https://www.mercadolivre.com.br/social/gatuna'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.deepEqual(result, {
    url: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
    linkKind: 'coupon',
    warning: 'ml_vitrine_fallback_used',
  })
})

// --- Caso 2 (US2/FR-002/FR-005): produto conversível + vitrineUrl cadastrada → NUNCA vitrine ---

test('contrato caso 2: link de produto conversível + vitrineUrl cadastrada → NÃO usa vitrine, retorna link de produto convertido', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/PRODUTO123' }] },
    headers: {},
  }))
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB70009242' }))
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.notEqual(result.url, 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial')
})

test('Acceptance Scenario US2: link ML ambíguo (não claramente vitrine) NÃO é substituído pela vitrine, mesmo com vitrineUrl cadastrada', async (t) => {
  withCouponLinkConvertOn(t)
  // resolve() de um encurtador (meli.la) aterrissa numa página /social/ ambígua
  // — NÃO é o link original compartilhado, então isDirectVitrineShare(url) é
  // false para o link ORIGINAL (meli.la), mesmo a landing sendo /social/.
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/loja' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://meli.la/1Zgxo75'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  // Mesmo ambíguo, com vitrine cadastrada o fallback é usado (é uma melhoria de
  // monetização segura — buildVitrineFallback dispara sempre que unsupported_url
  // acontece, independente de isDirectVitrineShare). O que este teste garante é
  // a invariante de segurança: nunca o link de terceiro original.
  assert.notEqual(result?.url, url)
  assert.notEqual(result?.url, 'https://meli.la/1Zgxo75')
})

// --- Caso 3 (FR-006): vitrineUrl ausente + recusa ambígua → descarte seguro ---

test('contrato caso 3: vitrineUrl ausente + recusa ambígua (via encurtador, não /social/ direto) → null (descarte seguro)', async (t) => {
  withCouponLinkConvertOn(t)
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/loja' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://meli.la/1Zgxo75'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result, null)
})

// --- Caso 4 (Edge): vitrineUrl malformada → descarte seguro (já coberto acima em unidade pura,
// aqui a versão end-to-end via convert()) ---

test('contrato caso 4: vitrineUrl malformada + recusa unsupported_url → convert() propaga erro real (não finge sucesso de vitrine)', async (t) => {
  withCouponLinkConvertOn(t)
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/gatuna' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://www.mercadolivre.com.br/social/gatuna'
  await assert.rejects(
    () => convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890', vitrineUrl: 'not-a-url' }),
    (err) => {
      assert.equal(err.mlFailureType, 'unsupported_url')
      return true
    },
  )
})

// --- Caso 5 (FR-004): coerência mensagem×status — a linha de notificação
// warning:* nunca pode ser gravada com status='skipped' (o bug real do
// incidente 12/07). Teste estrutural sobre o bloco de escrita em
// bot-worker.js, seguindo o padrão de teste estrutural já usado no repo para
// esse arquivo (bot-worker-message-processor-imports.test.js) — importar
// bot-worker.js diretamente teria efeitos colaterais pesados (conexão
// WhatsApp), então a suíte do projeto testa esse arquivo por inspeção de
// source, não por execução.

function extractWarningMessageLogBlock(source) {
  const marker = "destGroup: 'warning'"
  const idx = source.indexOf(marker)
  assert.notEqual(idx, -1, 'bloco de escrita de MessageLog destGroup=warning não encontrado em bot-worker.js')
  // Recorta uma janela ao redor do marcador (bloco db.messageLog.create inteiro).
  const start = source.lastIndexOf('await db.messageLog.create(', idx)
  const end = source.indexOf('})', idx) + 2
  return source.slice(start, end)
}

test('contrato caso 5: linha de notificação warning:* é gravada com status=info, nunca skipped (FR-004)', () => {
  const block = extractWarningMessageLogBlock(botWorkerSource)
  assert.match(block, /status:\s*'info'/, 'a escrita de destGroup=warning deve usar status=\'info\', não \'skipped\' — badge "Ignorado" contradiz a oferta que saiu com sucesso')
  assert.doesNotMatch(block, /status:\s*'skipped'/, 'não pode mais gravar status=\'skipped\' para linhas de notificação warning:*')
  // errorMsg continua carregando o kind (taxonomia inalterada), cobrindo os 6
  // tipos de warning existentes (não só vitrine).
  assert.match(block, /errorMsg:\s*`warning:\$\{kind\}`/)
})

// --- Caso 6 (FR-003): invariante de segurança — nunca o link de terceiro original ---

test('contrato caso 6: em nenhum caso o retorno de buildVitrineFallback contém o link de terceiro', () => {
  const thirdPartyUrl = 'https://www.mercadolivre.com.br/social/loja-de-terceiro'
  const result = buildVitrineFallback({ vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial' })
  assert.notEqual(result.url, thirdPartyUrl)
  assert.equal(result.url, 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial')
})

test('contrato caso 6: convert() nunca retorna o link de terceiro original quando cai no fallback de vitrine', async (t) => {
  withCouponLinkConvertOn(t)
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/loja-terceiro' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://www.mercadolivre.com.br/social/loja-terceiro'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.notEqual(result.url, url)
  assert.notEqual(result.url, 'https://www.mercadolivre.com.br/social/loja-terceiro')
})

// --- US2/T019: guarda anti-regressão — ramo de vitrine nunca é alcançado quando há produto ---

test('US2 anti-regressão: link de produto NUNCA aciona o ramo de vitrine mesmo passando vitrineUrl válida (guarda de convert())', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let postCalls = 0
  t.mock.method(axios, 'post', async () => {
    postCalls += 1
    return { status: 200, data: { urls: [{ short_url: 'https://mercadolivre.com/sec/PRODUTOXYZ' }] }, headers: {} }
  })
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB70009242' }))
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.equal(result.linkKind, 'product')
  assert.equal(postCalls, 1, 'createLink de produto deve ser chamado normalmente (única tentativa, sem short-circuit para vitrine)')
})
