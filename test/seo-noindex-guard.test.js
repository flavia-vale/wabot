// Guarda de P2 (specs/013-inbound-leads-strategy): o sinal de "não indexar"
// (buildSeoRobots) precisa estar de fato ligado nos quatro chokepoints de
// metadata, nenhuma rota pode sumir do build por virar não indexável, e
// título/descrição de uma mesma rota continuam morando em UM lugar só
// (fonte única, FR-001) em todo o registro — não só nas 10 páginas de P1.
//
// Ordem de execução (tasks.md): este teste é escrito DEPOIS de T012 (helpers
// buildSeoRobots/getSeoRoute/getAllSeoRoutes) e T013 (ajuste do guard de
// cobertura), mas ANTES de T015 (checagem nova no validate-seo-consistency)
// e T016 (ligar buildSeoRobots nos chokepoints). Por isso a checagem (a)
// deve FALHAR agora: os helpers existem, mas nenhum chokepoint os referencia
// ainda.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  SEO_ROUTES,
  CONTENT_SEO_ROUTES,
  HUB_SEO_ROUTES,
  PROGRAMMATIC_SEO_ROUTES,
  getAllSeoRoutes,
  getSeoRoute,
  buildSeoRobots,
  getProgrammaticSeoSlugs,
} from '../dashboard/lib/seo-registry.mjs'

const raiz = new URL('..', import.meta.url)
const lerFonte = (caminho) => fs.readFileSync(new URL(caminho, raiz), 'utf8')

// Piso de rotas conhecido no momento em que este teste foi escrito (T014).
// FR-010/SC-007: marcar indexable:false nunca pode fazer esse número cair —
// só a decisão de indexação muda, a página continua existindo.
const MIN_SEO_ROUTES_COUNT = 106

const CHOKEPOINT_FILES = [
  'dashboard/app/_lpShared.js',
  'dashboard/app/_seoHubShared.js',
  'dashboard/app/_preservationCommercialPages.js',
  'dashboard/app/_comparisonContent.js',
]

test('helpers de robots existem e são puros (getSeoRoute, buildSeoRobots, getAllSeoRoutes)', () => {
  assert.equal(typeof getSeoRoute, 'function')
  assert.equal(typeof buildSeoRobots, 'function')
  assert.equal(typeof getAllSeoRoutes, 'function')
  assert.deepEqual(getAllSeoRoutes(), SEO_ROUTES)
})

test('buildSeoRobots nunca emite index:true explícito — indexável devolve undefined', () => {
  const rotaIndexavel = SEO_ROUTES.find((r) => r.indexable !== false)
  assert.ok(rotaIndexavel, 'não achei nenhuma rota indexável para testar')
  assert.equal(buildSeoRobots(rotaIndexavel.path), undefined)
})

test('buildSeoRobots devolve { index:false, follow:true } para rota não indexável (FR-009)', () => {
  const rotasNaoIndexaveis = SEO_ROUTES.filter((r) => r.indexable === false)
  for (const rota of rotasNaoIndexaveis) {
    assert.deepEqual(buildSeoRobots(rota.path), { index: false, follow: true })
  }
})

test('(a) os quatro chokepoints de metadata referenciam buildSeoRobots — nenhum emite metadata sem checar indexação', () => {
  for (const arquivo of CHOKEPOINT_FILES) {
    const fonte = lerFonte(arquivo)
    assert.match(
      fonte,
      /buildSeoRobots/,
      `${arquivo}: não referencia buildSeoRobots — uma rota marcada indexable:false aqui sairia do sitemap/IndexNow mas continuaria com robots ausente no HTML (a página seguiria sendo indexada)`
    )
  }
})

test('(a) toda rota indexable:false tem robots emitido pelo chokepoint que gera a metadata dela (regressão futura)', () => {
  // Vacuamente verdadeiro enquanto T018 não marcar nenhuma rota — existe para
  // travar a regressão quando a primeira rota virar indexable:false sem que
  // T016 já tenha ligado o chokepoint correspondente.
  const rotasNaoIndexaveis = getAllSeoRoutes().filter((r) => r.indexable === false)
  for (const rota of rotasNaoIndexaveis) {
    const robots = buildSeoRobots(rota.path)
    assert.deepEqual(robots, { index: false, follow: true }, `${rota.path}: indexable:false sem robots correspondente`)
  }
})

test('(b) nenhuma rota some de generateStaticParams()/da lista de builds ao virar não indexável (FR-010)', () => {
  // getProgrammaticSeoSlugs() alimenta app/[slug]/page.js#generateStaticParams
  // e NÃO pode ser filtrado por indexable — senão marcar uma rota como
  // indexable:false a tiraria do build, não só do índice.
  assert.equal(getProgrammaticSeoSlugs().length, PROGRAMMATIC_SEO_ROUTES.length)

  const fonteSlugPage = lerFonte('dashboard/app/[slug]/page.js')
  assert.match(fonteSlugPage, /generateStaticParams/)
  assert.match(fonteSlugPage, /getProgrammaticSeoSlugs\(\)/)
  assert.doesNotMatch(fonteSlugPage, /getIndexableSeoRoutes/, 'generateStaticParams não pode filtrar por indexável — isso tiraria a rota do build (FR-010)')

  assert.ok(
    SEO_ROUTES.length >= MIN_SEO_ROUTES_COUNT,
    `SEO_ROUTES caiu para ${SEO_ROUTES.length} (piso conhecido: ${MIN_SEO_ROUTES_COUNT}) — nenhuma página pode ser apagada (FR-010/SC-007)`
  )
})

// (c) Fonte única (FR-001), espelhando a checagem que lint-seo-metadata-duplicates.mjs
// ganhou em T003 — mesmos DOIS módulos que o parser ali entende
// (_preservationCommercialPages.js e _comparisonContent.js, mais
// _seoHubShared.js para o hub que migrou em T009). Escopo idêntico ao do
// lint script de propósito: `_preservationBlogPosts.js` tem outras rotas com
// title duplicado no registry além das 4 de FR-004 (achado durante a escrita
// deste teste) — mas isso é preexistente e mais amplo do que esta feature
// contratou consertar (nem T003 nem contracts/seo-robots.md pedem o parser
// para blog posts fora dos 4 nomeados em FR-004). Reportado à parte para
// virar backlog, não resolvido silenciosamente aqui.
function contentModulePaths() {
  const paths = new Set()

  // _preservationCommercialPages.js: chaveado por pageKey, path vem do campo path:
  const preservationSource = lerFonte('dashboard/app/_preservationCommercialPages.js')
  for (const match of preservationSource.matchAll(/path:\s*'([^']+)'/g)) paths.add(match[1])

  // _comparisonContent.js: chaveado pelo próprio path.
  const comparisonSource = lerFonte('dashboard/app/_comparisonContent.js')
  for (const match of comparisonSource.matchAll(/^\s*'(\/[^']+)':\s*\{/gm)) paths.add(match[1])

  // _seoHubShared.js: HUB_CONTENT chaveado por slug (sem barra) — só entram
  // os que declaram title ali dentro (os que não migraram continuam servidos
  // pelo registry, sem conflito).
  const hubSource = lerFonte('dashboard/app/_seoHubShared.js')
  const hubBlockRegex = /'([^']+)':\s*\{[^}]*?title:\s*'[^']+'[^}]*?\n {2}\},/gs
  for (const match of hubSource.matchAll(hubBlockRegex)) paths.add(`/${match[1]}`)

  return paths
}

test('(c) fonte única (FR-001) vale para o registro inteiro nos módulos cobertos por lint-seo-metadata-duplicates.mjs (T003)', () => {
  const pathsComModulo = contentModulePaths()
  const rotasComTituloNoRegistry = SEO_ROUTES.filter((route) => route.title)

  for (const route of rotasComTituloNoRegistry) {
    assert.ok(
      !pathsComModulo.has(route.path),
      `${route.path}: title existe no seo-registry.mjs E no módulo de conteúdo que renderiza a página — fonte única quebrada (FR-001)`
    )
  }
})
