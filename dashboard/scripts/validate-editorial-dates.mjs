import { EDITORIAL_DATES } from '../lib/editorial-content.js'
import { getIndexableSeoRoutes } from '../lib/seo-registry.mjs'

const baseUrl = (process.env.LP_BASE_URL || process.argv[2] || 'http://localhost:3006').replace(/\/$/, '')
const routes = getIndexableSeoRoutes().filter(({ path }) => !path.endsWith('.txt') && !path.endsWith('.md'))

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(([, value]) => {
      try { return [JSON.parse(value)] } catch { return [] }
    })
}

const failures = []
for (const route of routes) {
  const response = await fetch(`${baseUrl}${route.path}`)
  const html = await response.text()
  const dates = EDITORIAL_DATES[route.path]
  const schemas = jsonLdBlocks(html)
  const datedSchema = schemas.find((schema) => schema.dateModified === dates?.updatedAt)

  if (!response.ok) failures.push(`${route.path}: HTTP ${response.status}`)
  if (!dates) failures.push(`${route.path}: sem EDITORIAL_DATES`)
  if (!html.includes(`Revisado em`)) failures.push(`${route.path}: sem “Revisado em” visível`)
  if (!datedSchema) failures.push(`${route.path}: dateModified ausente ou divergente no JSON-LD`)
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FALHA: ${failure}`))
  process.exitCode = 1
} else {
  console.log(`OK: ${routes.length} páginas indexáveis com “Revisado em” e dateModified no JSON-LD.`)
}
