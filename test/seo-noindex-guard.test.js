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
import { execFileSync } from 'node:child_process'
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

// Composição exata da retirada de 2026-08-19, aprovada pela usuária. Fica
// travada aqui porque os dois erros possíveis são caros e silenciosos: tirar
// de menos não destrava o rastreamento, e tirar de mais apaga do Google uma
// página que produz.
const CIDADES_FORA = 15
const NICHOS_FORA = 10
const DORES_FORA = 0

// Está na família de nicho, mas é uma das dez páginas cujo título US1
// reescreveu para ganhar clique (49 impressões). Tirá-la do índice desfaria
// essa entrega na mesma rodada.
const EXCECAO_INDEXAVEL = '/bot-ofertas-afiliados-whatsapp'

test('a retirada do índice pegou exatamente as rotas de grade mortas (15 cidade + 10 nicho, 0 dor)', () => {
  const fora = getAllSeoRoutes().filter((r) => r.indexable === false)
  const porTipo = (tipo) => fora.filter((r) => r.type === tipo).length

  assert.equal(porTipo('city'), CIDADES_FORA, 'mudou o número de rotas de cidade fora do índice')
  assert.equal(porTipo('niche'), NICHOS_FORA, 'mudou o número de rotas de nicho fora do índice')
  assert.equal(
    porTipo('pain'),
    DORES_FORA,
    'rota de dor operacional saiu do índice — essa família CONVERTE (/automatizar-divulgacao-em-grupos-whatsapp tem 173 impressões e 8% de clique) e não pode ser retirada'
  )
  // /cadastro entrou fora do índice em 2026-09-11 e NÃO é rota de grade: é um
  // redirecionamento para /login?mode=register, que existe só para preservar o
  // ?aff= dos links de indicação. Pedir indexação de um redirect não faz
  // sentido — o Google segue e indexa outra coisa, ou nada.
  const REDIRECIONAMENTOS_FORA = ['/cadastro']
  for (const rota of REDIRECIONAMENTOS_FORA) {
    assert.ok(
      fora.some((r) => r.path === rota),
      `${rota} é um redirecionamento e precisa continuar fora do índice`
    )
  }
  assert.equal(fora.length, CIDADES_FORA + NICHOS_FORA + DORES_FORA + REDIRECIONAMENTOS_FORA.length)
})

test('a página de nicho que US1 reescreveu continua indexável (não desfazer entrega na mesma rodada)', () => {
  const rota = getSeoRoute(EXCECAO_INDEXAVEL)
  assert.ok(rota, `${EXCECAO_INDEXAVEL}: sumiu do registro`)
  assert.notEqual(
    rota.indexable,
    false,
    `${EXCECAO_INDEXAVEL} saiu do índice — mas é uma das dez páginas de US1, com título reescrito para ganhar clique. Tirá-la joga fora essa entrega.`
  )
  assert.equal(buildSeoRobots(EXCECAO_INDEXAVEL), undefined)
})

test('(a) toda rota indexable:false tem robots emitido pelo chokepoint que gera a metadata dela (regressão futura)', () => {
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
// ganhou em T003 — mesmos módulos que o parser ali entende
// (_preservationCommercialPages.js, _comparisonContent.js, _seoHubShared.js,
// _preservationBlogPosts.js, _preservationDecisionPages.js e
// _organicNicheLanding.js), para as duas checagens (lint script + este teste)
// enxergarem o mesmo escopo.
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

  // _preservationBlogPosts.js (T046): chaveado por postKey, path vem do
  // campo slug: dentro do próprio bloco (não path:, diferente do módulo
  // comercial acima).
  const blogSource = lerFonte('dashboard/app/blog/_preservationBlogPosts.js')
  const blogBlockRegex = /'[^']+':\s*\{\s*slug:\s*'([^']+)'[^}]*?title:\s*'[^']+'/gs
  for (const match of blogSource.matchAll(blogBlockRegex)) paths.add(match[1])

  // _preservationDecisionPages.js: chaveado pelo próprio path.
  const decisionSource = lerFonte('dashboard/app/_preservationDecisionPages.js')
  for (const match of decisionSource.matchAll(/^\s*'(\/[^']+)':\s*\{/gm)) paths.add(match[1])

  // _organicNicheLanding.js: chaveado por nome sem barra; o path vem de slug:.
  const organicNicheSource = lerFonte('dashboard/app/_organicNicheLanding.js')
  const organicNicheBlockRegex = /'[^']+':\s*\{\s*slug:\s*'([^']+)'[^}]*?title:\s*'[^']+'/gs
  for (const match of organicNicheSource.matchAll(organicNicheBlockRegex)) paths.add(match[1])

  return paths
}

const REQUIRED_DECISION_MODULE_PATHS = [
  '/bot-comum-vs-botinho',
  '/faq-antiban-whatsapp',
  '/como-funciona-botinho-canais',
  '/protecao-antiban-botinho',
]

const REQUIRED_ORGANIC_NICHE_PATHS = [
  '/bot-ofertas-restaurantes-whatsapp',
  '/bot-ofertas-marketplace-whatsapp',
]

test('(c) parsers de módulos cobrem todas as rotas orgânicas e de decisão esperadas (FR-001/FR-007/FR-041)', () => {
  const pathsComModulo = contentModulePaths()

  for (const routePath of [...REQUIRED_DECISION_MODULE_PATHS, ...REQUIRED_ORGANIC_NICHE_PATHS]) {
    assert.ok(
      pathsComModulo.has(routePath),
      `${routePath}: parser de fonte única deixou de reconhecer a rota no módulo de conteúdo`
    )
  }
})

test('(c) lint inclui as rotas orgânicas em completeRecords e mantém somente a lacuna conhecida', () => {
  const dashboardDir = new URL('../dashboard/', import.meta.url)
  const output = execFileSync(
    process.execPath,
    ['scripts/lint-seo-metadata-duplicates.mjs', '--report-json'],
    { cwd: dashboardDir, encoding: 'utf8' }
  )
  const report = JSON.parse(output)

  for (const routePath of REQUIRED_ORGANIC_NICHE_PATHS) {
    assert.ok(
      report.completePaths.includes(routePath),
      `${routePath}: o próprio lint deixou de colocar a rota orgânica em completeRecords`
    )
  }
  assert.equal(report.incompletePaths.length, 1, `o lint deve manter exatamente uma lacuna conhecida: ${JSON.stringify(report.incompletePaths)}`)
  assert.equal(report.completePaths.length, report.total - 1)
})

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
