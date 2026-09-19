// RCA 2026-09-17 — "ofertas da Magalu estão indo sem imagem".
//
// A Magalu era a única loja habilitada sem ramo próprio em `fetchProductImage`
// e caía só no leitor genérico de HTML — o caminho que a loja fecha. Medido do
// servidor: 403 com a página de erro de marca em todo User-Agent de navegador/
// bot, e **200** com o desafio JavaScript do Akamai no User-Agent do WhatsApp.
// O caso de 200 chegava ao log como `scrape_sem_imagem` ("a loja não tem foto
// deste produto"), que pede ação OPOSTA à real.
//
// Os testes abaixo não tocam a loja: o muro é reproduzido por um servidor
// local, e as regras de URL são puras.

import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'

import {
  isMagaluBotWallHtml,
  isMagaluBlockedStatus,
  isMagaluImageUrl,
  buildMagaluImageUrlCandidates,
} from '../src/converters/magaluImage.js'
import { fetchProductImage } from '../src/converters/imageScrapers.js'

// Corpo real da página de erro servida pela Magalu com status 403 (recortado).
const MURO_403 = '<!DOCTYPE html><html lang="pt-BR"><head><title>Magazine Luiza | Não é possível acessar a página</title>'
  + '<link rel="stylesheet" href="https://wx.mlcdn.com.br/akamai-bot/css/styles-v0.css"></head>'
  + '<body><h1 class="title">Não é possível acessar a página</h1><p>(Erro <span id="error-code">403</span>)</p></body></html>'

// Corpo real do desafio JavaScript do Akamai, servido com status **200**.
const MURO_200 = '<!DOCTYPE html><html><body><script src="/8X-k/Nr6K/DDW/by04?v=1a30&t=350425820"></script>'
  + '<div id="sec-if-cpt-container" role="main" style="display: none"><div class="behavioral-content">'
  + '<p class="scf-akamai-protected-by">Powered and protected by</p></div></div></body></html>'

const PAGINA_DE_PRODUTO = '<!DOCTYPE html><html><head>'
  + '<meta property="og:image" content="https://a-static.mlcdn.com.br/450x450/geladeira/magazineluiza/155603000/abc.jpg">'
  + '</head><body>Geladeira</body></html>'

test('o muro da Magalu é reconhecido nas DUAS formas (403 de marca e 200 com desafio)', () => {
  assert.equal(isMagaluBotWallHtml(MURO_403), true)
  assert.equal(isMagaluBotWallHtml(MURO_200), true)
})

test('página de produto legítima NUNCA é confundida com o muro', () => {
  assert.equal(isMagaluBotWallHtml(PAGINA_DE_PRODUTO), false)
  assert.equal(isMagaluBotWallHtml(''), false)
  assert.equal(isMagaluBotWallHtml(null), false)
  assert.equal(isMagaluBotWallHtml(undefined), false)
})

test('403 e 429 são bloqueio de borda; 404 continua sendo link morto', () => {
  assert.equal(isMagaluBlockedStatus(403), true)
  assert.equal(isMagaluBlockedStatus(429), true)
  // 404 acusar bloqueio mandaria procurar defeito na loja quando o link é que
  // não existe mais — os dois casos têm ações opostas.
  assert.equal(isMagaluBlockedStatus(404), false)
  assert.equal(isMagaluBlockedStatus(200), false)
  assert.equal(isMagaluBlockedStatus(null), false)
})

test('reconhece o CDN de imagem da Magalu e ignora host de fora', () => {
  assert.equal(isMagaluImageUrl('https://a-static.mlcdn.com.br/450x450/x/y/1/a.jpg'), true)
  assert.equal(isMagaluImageUrl('https://wx.mlcdn.com.br/shared/logo.svg'), true)
  // Ancoragem no host: sufixo colado num domínio de terceiro não é Magalu.
  assert.equal(isMagaluImageUrl('https://mlcdn.com.br.evil.net/1/a.jpg'), false)
  assert.equal(isMagaluImageUrl('https://http2.mlstatic.com/D_NQ_NP_1.jpg'), false)
  assert.equal(isMagaluImageUrl('nao-e-url'), false)
})

test('pede as variantes grandes primeiro e PRESERVA a original como último recurso', () => {
  const candidatas = buildMagaluImageUrlCandidates('https://a-static.mlcdn.com.br/450x450/geladeira/magazineluiza/155603000/abc.jpg')
  assert.deepEqual(candidatas, [
    'https://a-static.mlcdn.com.br/1500x1500/geladeira/magazineluiza/155603000/abc.jpg',
    'https://a-static.mlcdn.com.br/1000x1000/geladeira/magazineluiza/155603000/abc.jpg',
    'https://a-static.mlcdn.com.br/800x800/geladeira/magazineluiza/155603000/abc.jpg',
    'https://a-static.mlcdn.com.br/450x450/geladeira/magazineluiza/155603000/abc.jpg',
  ])
  // A original por último é o que impede a oferta de sair SEM foto quando o
  // CDN não serve o tamanho pedido (mesmo contrato de Amazon/SHEIN).
  assert.equal(candidatas[candidatas.length - 1].includes('/450x450/'), true)
})

test('nunca pede variante MENOR do que a que a loja já anunciou', () => {
  const candidatas = buildMagaluImageUrlCandidates('https://a-static.mlcdn.com.br/1500x1500/x/y/1/a.jpg')
  assert.deepEqual(candidatas, ['https://a-static.mlcdn.com.br/1500x1500/x/y/1/a.jpg'])
})

test('URL sem tamanho no caminho sai intacta', () => {
  const url = 'https://a-static.mlcdn.com.br/x/y/1/a.jpg'
  assert.deepEqual(buildMagaluImageUrlCandidates(url), [url])
})

async function comServidor(handler, fn) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(base)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('muro com status 200 é reportado como bloqueio da loja, não como "sem foto"', async () => {
  await comServidor((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(MURO_200)
  }, async base => {
    const diagnosticos = []
    const image = await fetchProductImage('magazineluiza', `${base}/p/muro-200/`, {}, {
      onDiagnostic: d => diagnosticos.push(d),
    })
    assert.equal(image, null)
    assert.deepEqual(diagnosticos.map(d => d.stage), ['loja_bloqueou'])
    assert.equal(diagnosticos[0].detail.status, 200)
  })
})

test('403 de bloqueio também é reportado com nome próprio', async () => {
  await comServidor((req, res) => {
    res.writeHead(403, { 'content-type': 'text/html' })
    res.end(MURO_403)
  }, async base => {
    const diagnosticos = []
    const image = await fetchProductImage('magazineluiza', `${base}/p/muro-403/`, {}, {
      onDiagnostic: d => diagnosticos.push(d),
    })
    assert.equal(image, null)
    assert.deepEqual(diagnosticos.map(d => d.stage), ['loja_bloqueou'])
    assert.equal(diagnosticos[0].detail.status, 403)
  })
})

test('página de produto que responde normalmente devolve a foto, sem diagnóstico de bloqueio', async () => {
  await comServidor((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(PAGINA_DE_PRODUTO)
  }, async base => {
    const diagnosticos = []
    const image = await fetchProductImage('magazineluiza', `${base}/p/produto-ok/`, {}, {
      onDiagnostic: d => diagnosticos.push(d),
    })
    assert.equal(image, 'https://a-static.mlcdn.com.br/450x450/geladeira/magazineluiza/155603000/abc.jpg')
    assert.deepEqual(diagnosticos, [])
  })
})

test('a Magalu tem ramo próprio em fetchProductImage e não repete o fetch genérico', () => {
  const src = readFileSync(new URL('../src/converters/imageScrapers.js', import.meta.url), 'utf8')
  // Sem o ramo, a Magalu volta a cair só no leitor genérico — que é o caminho
  // que a loja fecha, e era a causa raiz.
  assert.match(src, /platform === 'magazineluiza'[\s\S]{0,120}resolveMagaluImage/)
  // E o leitor genérico não pode reler a MESMA página: seriam dois fetches do
  // mesmo HTML dentro do orçamento de 25s da mensagem.
  assert.match(src, /!image && platform !== 'magazineluiza'/)
})

test('o sinal do bloqueio da Magalu está nas duas allowlists (senão é descartado em silêncio)', () => {
  const mapa = readFileSync(new URL('../src/observability/operationalSignals.js', import.meta.url), 'utf8')
  assert.match(mapa, /magalu_bot_wall: 'ops_magalu_bot_wall'/)
  const analytics = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  assert.match(analytics, /'ops_magalu_bot_wall'/)
})
