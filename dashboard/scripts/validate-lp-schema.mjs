import { PROGRAMMATIC_SEO_ROUTES } from '../lib/seo-registry.mjs'

const baseUrl = (process.env.LP_BASE_URL || process.argv[2] || 'http://localhost:3006').replace(/\/$/, '')

function extractJsonLdBlocks(html) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  return matches
    .map((m) => {
      try {
        return JSON.parse(m[1])
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function validateStructuredData(route, blocks) {
  const types = new Set(blocks.map((b) => b?.['@type']).filter(Boolean))
  const missing = route.schemaTypes.filter((type) => !types.has(type))
  const softwareApplication = blocks.find((block) => block?.['@type'] === 'SoftwareApplication')
  const missingSoftwareFields = []

  if (softwareApplication) {
    if (!softwareApplication.url) missingSoftwareFields.push('SoftwareApplication.url')
    if (!softwareApplication.mainEntityOfPage) missingSoftwareFields.push('SoftwareApplication.mainEntityOfPage')
    if (!Array.isArray(softwareApplication.offers) || softwareApplication.offers.length === 0) {
      missingSoftwareFields.push('SoftwareApplication.offers')
    } else if (softwareApplication.offers.some((offer) => offer.priceCurrency !== 'BRL')) {
      missingSoftwareFields.push('SoftwareApplication.offers.priceCurrency=BRL')
    }
  }

  return [...missing, ...missingSoftwareFields]
}

async function validateSlug(route) {
  const url = `${baseUrl}${route.path}`
  const response = await fetch(url)

  if (!response.ok) {
    return { slug: route.slug, ok: false, reason: `HTTP ${response.status}` }
  }

  const html = await response.text()
  const blocks = extractJsonLdBlocks(html)
  const missing = validateStructuredData(route, blocks)

  return {
    slug: route.slug,
    ok: missing.length === 0,
    reason: missing.length === 0 ? 'OK' : `Missing: ${missing.join(', ')}`,
  }
}

async function main() {
  const results = await Promise.all(PROGRAMMATIC_SEO_ROUTES.map(validateSlug))
  const failed = results.filter((r) => !r.ok)

  for (const result of results) {
    const marker = result.ok ? 'OK' : 'FALHA'
    console.log(`${marker} - ${result.label} (${result.reason})`)
  }

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Erro ao validar LPs:', error)
  process.exitCode = 1
})
