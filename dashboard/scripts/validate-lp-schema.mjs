import { getAllLpSlugs, getPainLpSlugs } from '../lib/lp-config.mjs'

const PAIN_SLUGS = new Set(getPainLpSlugs())
const VALIDATION_TARGETS = [
  ...getAllLpSlugs().map((slug) => ({ path: `/${slug}`, label: slug, requiredTypes: getRequiredTypesForLp(slug) })),
  { path: '/suporte', label: 'suporte', requiredTypes: ['FAQPage'] },
]

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

function flattenSchemaNodes(block) {
  if (!block) return []
  if (Array.isArray(block)) return block.flatMap(flattenSchemaNodes)
  if (Array.isArray(block['@graph'])) return [block, ...block['@graph'].flatMap(flattenSchemaNodes)]
  return [block]
}

function collectSchemaTypes(blocks) {
  const types = new Set()
  for (const node of blocks.flatMap(flattenSchemaNodes)) {
    const rawType = node?.['@type']
    const values = Array.isArray(rawType) ? rawType : [rawType]
    for (const value of values) {
      if (value) types.add(value)
    }
  }
  return types
}

function getRequiredTypesForLp(slug) {
  const required = ['FAQPage', 'HowTo', 'SoftwareApplication']
  if (PAIN_SLUGS.has(slug)) required.push('BreadcrumbList')
  return required
}

async function validateTarget(target) {
  const url = `${baseUrl}${target.path}`
  const response = await fetch(url)

  if (!response.ok) {
    return { label: target.label, ok: false, reason: `HTTP ${response.status}` }
  }

  const html = await response.text()
  const blocks = extractJsonLdBlocks(html)
  const types = collectSchemaTypes(blocks)

  const missing = target.requiredTypes.filter((t) => !types.has(t))

  return {
    label: target.label,
    ok: missing.length === 0,
    reason: missing.length === 0 ? 'OK' : `Missing: ${missing.join(', ')}`,
  }
}

async function main() {
  const results = await Promise.all(VALIDATION_TARGETS.map(validateTarget))
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
