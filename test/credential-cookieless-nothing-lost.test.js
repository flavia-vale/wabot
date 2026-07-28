// GARANTIA: "nada se perde, nem com o código de acesso nem sem ele".
//
// O modo sem código (cookielessMode) só é honesto se a cliente puder ligar e
// desligar sem perder NADA do que importa para ela:
//   1. a oferta continua saindo (nunca vira mensagem descartada);
//   2. o link continua sendo DELA (a etiqueta/tag vai junto nos dois caminhos);
//   3. o link de terceiro NUNCA é encaminhado (comissão não vaza para o
//      concorrente);
//   4. o resto da configuração (etiqueta, vitrine, demais campos) sobrevive a
//      ligar, desligar e apagar.
//
// Este arquivo trava esses quatro pontos em teste. Se algum quebrar, alguém
// regrediu a promessa feita para a usuária no painel.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { convert as convertMl } from '../src/converters/mercadolivre.js'
import { convert as convertAmazon } from '../src/converters/amazon.js'
import { sanitizeCredentialBody, validateCredentialData } from '../src/credentialHealth.js'

const ML_PRODUCT = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
const ML_TAG = '475630078'
const AMAZON_PRODUCT = 'https://www.amazon.com.br/dp/B09VQ39F41'
const AMAZON_TAG = 'flaviavale-20'

function mockAxiosGet(impl) {
  const original = axios.get
  axios.get = impl
  return () => { axios.get = original }
}

// ---------------------------------------------------------------------------
// 1 e 2: a oferta sai e o link é da cliente — COM e SEM o código de acesso
// ---------------------------------------------------------------------------

test('ML COM o código: sai o link curto de afiliado da cliente', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/2Abcd' }] },
    headers: {},
  }))
  // Validação do redirect cai no muro anti-bot do VPS (inconclusiva) — o link
  // é mantido, comportamento já canônico.
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/gz/account-verification' }))

  const result = await convertMl(ML_PRODUCT, { tag: ML_TAG, ssid: 'ssid-valido-1234567890' })
  assert.equal(result.url, 'https://mercadolivre.com/sec/2Abcd')
  assert.equal(result.linkKind, 'product')
})

test('ML SEM o código: a oferta NÃO se perde — sai com a etiqueta da cliente', async () => {
  const result = await convertMl(ML_PRODUCT, { tag: ML_TAG })

  assert.ok(result, 'sem o código a conversão não pode devolver nada (isso descartaria a oferta)')
  assert.equal(result.linkKind, 'product')
  assert.match(result.url, new RegExp(`partner_id=${ML_TAG}`), 'a etiqueta da cliente tem que ir no link')
  assert.match(result.url, /MLB-?4049246221/, 'o link tem que apontar para o MESMO produto')
})

test('ML SEM o código: link de terceiro nunca é repassado (comissão não vaza)', async () => {
  const linkDeTerceiro = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM?partner_id=999999999&matt_tool=88888888'
  const result = await convertMl(linkDeTerceiro, { tag: ML_TAG })

  assert.match(result.url, new RegExp(`partner_id=${ML_TAG}`))
  assert.doesNotMatch(result.url, /partner_id=999999999/, 'a etiqueta do concorrente não pode sobreviver')
  assert.doesNotMatch(result.url, /matt_tool=88888888/)
})

test('Amazon COM o código: sai o link curto (amzn.to)', async () => {
  const restore = mockAxiosGet(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) return { status: 200, data: { shortUrl: 'https://amzn.to/abc123' }, headers: {} }
    return { status: 200, request: { res: { responseUrl: AMAZON_PRODUCT } }, config: { url: AMAZON_PRODUCT } }
  })
  try {
    const result = await convertAmazon(AMAZON_PRODUCT, {
      tag: AMAZON_TAG,
      'ubid-acbbr': 'ubid-1234567890',
      'at-acbbr': 'at-1234567890',
      'x-acbbr': 'x-1234567890',
    })
    assert.deepEqual(result, { url: 'https://amzn.to/abc123', linkKind: 'product' })
  } finally {
    restore()
  }
})

test('Amazon SEM o código: a oferta NÃO se perde — sai com a etiqueta da cliente', async () => {
  const restore = mockAxiosGet(async () => {
    throw new Error('sem código de acesso não deve haver chamada autenticada à Amazon')
  })
  try {
    const result = await convertAmazon(AMAZON_PRODUCT, { tag: AMAZON_TAG })
    assert.ok(result, 'sem o código a conversão não pode devolver nada')
    assert.equal(result.linkKind, 'product')
    assert.match(result.url, new RegExp(`tag=${AMAZON_TAG}`), 'a etiqueta da cliente tem que ir no link')
    assert.match(result.url, /B09VQ39F41/, 'o link tem que apontar para o MESMO produto')
  } finally {
    restore()
  }
})

test('Amazon SEM o código: etiqueta de terceiro é substituída pela da cliente', async () => {
  const restore = mockAxiosGet(async () => {
    throw new Error('sem código de acesso não deve haver chamada autenticada à Amazon')
  })
  try {
    const result = await convertAmazon(`${AMAZON_PRODUCT}?tag=concorrente-20`, { tag: AMAZON_TAG })
    assert.match(result.url, new RegExp(`tag=${AMAZON_TAG}`))
    assert.doesNotMatch(result.url, /tag=concorrente-20/)
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// 4: ligar, desligar e apagar não levam junto o resto da configuração
// ---------------------------------------------------------------------------

test('ligar o modo sem código preserva TUDO que não é código de acesso', () => {
  const antes = {
    tag: ML_TAG,
    ssid: 'ghy-codigo-secreto_-1',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-loja',
    cookielessMode: true,
  }
  const depois = sanitizeCredentialBody('mercadolivre', antes)

  assert.equal(depois.tag, ML_TAG, 'a etiqueta não pode se perder ao ligar o modo')
  assert.equal(depois.vitrineUrl, antes.vitrineUrl, 'a vitrine cadastrada não pode se perder ao ligar o modo')
  assert.equal('ssid' in depois, false, 'só o código de acesso sai')
})

test('desligar o modo mantém a configuração — só volta a pedir o código', () => {
  const guardado = { tag: ML_TAG, vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-loja', cookielessMode: false }
  const validacao = validateCredentialData('mercadolivre', guardado)

  assert.equal(validacao.configured, false)
  assert.deepEqual(validacao.missing, ['ssid/cookie'], 'o único pendente é o código de acesso')
  // A configuração em si continua intacta no corpo salvo.
  const salvo = sanitizeCredentialBody('mercadolivre', guardado)
  assert.equal(salvo.tag, ML_TAG)
  assert.equal(salvo.vitrineUrl, guardado.vitrineUrl)
})

test('a etiqueta sozinha já deixa a loja pronta para enviar no modo sem código', () => {
  for (const [plataforma, dados] of [
    ['mercadolivre', { tag: ML_TAG, cookielessMode: true }],
    ['amazon', { tag: AMAZON_TAG, cookielessMode: true }],
  ]) {
    const validacao = validateCredentialData(plataforma, dados)
    assert.equal(validacao.configured, true, `${plataforma} deveria estar pronta só com a etiqueta`)
    assert.deepEqual(validacao.missing, [])
  }
})
