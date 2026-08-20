import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  HUB_SEO_ROUTES,
  PROGRAMMATIC_SEO_ROUTES,
  getHubSeoRoute,
  getIndexableSeoRoutes,
  getProgrammaticSeoSlugs,
  getRelatedProgrammaticSeoRoutes,
  getSeoRoutesByCluster,
} from '../dashboard/lib/seo-registry.mjs'

function extractLpConfigSlugs() {
  const source = fs.readFileSync(new URL('../dashboard/app/_lpShared.js', import.meta.url), 'utf8')
  return [...source.matchAll(/^  '([^']+)':/gm)].map((match) => match[1])
}

test('SEO registry is the canonical source for every programmatic LP slug', () => {
  const lpConfigSlugs = extractLpConfigSlugs().sort()
  const registrySlugs = getProgrammaticSeoSlugs().sort()

  assert.deepEqual(registrySlugs, lpConfigSlugs)
})

test('programmatic LP registry requires the rendered schema types validated in staging', () => {
  assert.equal(PROGRAMMATIC_SEO_ROUTES.length, 36)

  for (const route of PROGRAMMATIC_SEO_ROUTES) {
    assert.equal(route.template, 'programmatic-lp')
    // `indexable` deixou de ser sempre `true` em 2026-08-19: 25 rotas de
    // grade (cidade e nicho) saíram do índice sem sair do site. A composição
    // exata é travada em `test/seo-noindex-guard.test.js`; aqui só importa
    // que a rota siga existindo e sendo construída.
    assert.equal(typeof route.indexable, 'boolean')
    assert.match(route.path, /^\/[a-z0-9-]+$/)
    assert.ok(route.parentPath, `${route.slug} must link back to a hub`)
    assert.deepEqual(route.schemaTypes, ['FAQPage', 'HowTo', 'SoftwareApplication', 'BreadcrumbList'])
  }
})

test('hub routes anchor every programmatic SEO cluster', () => {
  assert.equal(HUB_SEO_ROUTES.length, 3)

  for (const hub of HUB_SEO_ROUTES) {
    assert.equal(hub.template, 'seo-hub')
    assert.deepEqual(hub.schemaTypes, ['CollectionPage', 'ItemList', 'BreadcrumbList'])
    assert.ok(getSeoRoutesByCluster(hub.cluster).length > 0, `${hub.cluster} must have spokes`)
  }

  for (const route of PROGRAMMATIC_SEO_ROUTES) {
    assert.equal(getHubSeoRoute(route.parentPath)?.cluster, route.cluster)
  }
})

test('related route helper returns same-cluster spokes without the current page', () => {
  const current = PROGRAMMATIC_SEO_ROUTES.find((route) => route.slug === 'bot-ofertas-farmacia-whatsapp')
  const related = getRelatedProgrammaticSeoRoutes(current, 4)

  assert.equal(related.length, 4)
  assert.ok(related.every((route) => route.cluster === current.cluster))
  assert.ok(related.every((route) => route.path !== current.path))
})

test('indexable SEO route registry has unique paths for sitemap generation', () => {
  const paths = getIndexableSeoRoutes().map((route) => route.path)
  assert.equal(new Set(paths).size, paths.length)
  assert.ok(paths.includes('/espelhar-grupos-whatsapp'))
  assert.ok(paths.includes('/bot-ofertas-whatsapp'))
  assert.ok(paths.includes('/automacao-whatsapp-afiliados'))
  assert.ok(paths.includes('/benchmarks/operacao-grupos-ofertas-whatsapp'))
})
