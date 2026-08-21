import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { buildMlPictureUrl } from '../src/converters/mercadolivre.js'
import { fetchMercadoLivreApiImageId } from '../src/converters/productInfoScraper.js'

const imageScrapersSource = readFileSync(new URL('../src/converters/imageScrapers.js', import.meta.url), 'utf8')

// RCA 2026-08-19/21: o muro anti-robô do ML barra o IP do servidor na PÁGINA do
// produto (medido: 200 + ~39KB + sem og:image). A foto do card de preview vinha
// só dali, então todo link de produto DIRETO saía sem foto. A API do ML já era
// chamada para título e preço e traz `pictures[]` na mesma resposta — a foto
// estava sendo descartada.

test('sem link de produto reconhecível, nem tenta a API (não gasta token)', async () => {
  assert.equal(await fetchMercadoLivreApiImageId('https://www.mercadolivre.com.br/ofertas'), null)
  assert.equal(await fetchMercadoLivreApiImageId(''), null)
  assert.equal(await fetchMercadoLivreApiImageId(null), null)
})

test('link de anúncio sem credencial OAuth da cliente devolve null (cai na próxima fonte)', async () => {
  const semToken = await fetchMercadoLivreApiImageId(
    'https://produto.mercadolivre.com.br/MLB-4715816813-fone-_JM',
    { mlCredentials: null },
  )
  assert.equal(semToken, null)
})

test('a foto da API usa a MESMA variante grande da vitrine (2X/-F, medida em 1080x1080)', () => {
  assert.equal(
    buildMlPictureUrl('856678-MLA79924600925_102024'),
    'https://http2.mlstatic.com/D_NQ_NP_2X_856678-MLA79924600925_102024-F.jpg',
  )
  // id inválido não pode virar URL (o HTML/JSON vem de terceiro)
  assert.equal(buildMlPictureUrl('../../etc/passwd'), null)
  assert.equal(buildMlPictureUrl(''), null)
  assert.equal(buildMlPictureUrl(null), null)
})

// Guarda de ORDEM: a sequência das fontes é a decisão que não pode regredir.
test('ordem das fontes do ML: vitrine → API → página do produto (a página é a bloqueada)', () => {
  const bloco = imageScrapersSource.slice(
    imageScrapersSource.indexOf('async function resolveMercadoLivreImage'),
    imageScrapersSource.indexOf('const SHEIN_IMAGE_THUMBNAIL_SUFFIX_RE'),
  )
  const posVitrine = bloco.indexOf('fetchFeaturedSocialImage')
  const posApi = bloco.indexOf('fetchMercadoLivreApiImageId')
  const posPagina = bloco.indexOf('fetchHtml(')
  assert.ok(posVitrine > -1 && posApi > -1 && posPagina > -1, 'as três fontes precisam existir')
  assert.ok(posVitrine < posApi, 'a vitrine vem primeiro (provada em produção, não gasta token)')
  assert.ok(posApi < posPagina, 'a API vem antes da página do produto (a página é a que o muro barra)')
})

test('o muro anti-robô continua com sinal próprio (não vira "sem foto" genérico)', () => {
  assert.match(imageScrapersSource, /recordOperationalSignal\('ml_anti_bot_wall'/)
})

test('as credenciais da cliente chegam ao caminho de imagem do ML', () => {
  assert.match(imageScrapersSource, /resolveMercadoLivreImage\(productUrl, creds\)/)
  assert.match(imageScrapersSource, /mlCredentials: creds\?\.mercadolivre/)
})
