import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  PROGRAMMATIC_SEO_ROUTES,
  getIndexableSeoRoutes,
  getProgrammaticSeoSlugs,
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
    assert.equal(route.indexable, true)
    assert.match(route.path, /^\/[a-z0-9-]+$/)
    assert.deepEqual(route.schemaTypes, ['FAQPage', 'HowTo', 'SoftwareApplication', 'BreadcrumbList'])
  }
})

test('indexable SEO route registry has unique paths for sitemap generation', () => {
  const paths = getIndexableSeoRoutes().map((route) => route.path)
  assert.equal(new Set(paths).size, paths.length)
})
