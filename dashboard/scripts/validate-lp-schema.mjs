const SLUGS = [
  'espelhar-grupos-whatsapp-sao-paulo',
  'espelhar-grupos-whatsapp-rio-de-janeiro',
  'espelhar-grupos-whatsapp-belo-horizonte',
  'espelhar-grupos-whatsapp-curitiba',
  'espelhar-grupos-whatsapp-porto-alegre',
  'bot-ofertas-supermercado-whatsapp',
  'bot-ofertas-farmacia-whatsapp',
  'bot-ofertas-eletronicos-whatsapp',
  'bot-ofertas-moda-whatsapp',
  'bot-ofertas-beleza-whatsapp',
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

async function validateSlug(slug) {
  const url = `${baseUrl}/${slug}`
  const response = await fetch(url)

  if (!response.ok) {
    return { slug, ok: false, reason: `HTTP ${response.status}` }
  }

  const html = await response.text()
  const blocks = extractJsonLdBlocks(html)
  const types = new Set(blocks.map((b) => b?.['@type']).filter(Boolean))

  const required = ['FAQPage', 'HowTo', 'Product']
  const missing = required.filter((t) => !types.has(t))

  return {
    slug,
    ok: missing.length === 0,
    reason: missing.length === 0 ? 'OK' : `Missing: ${missing.join(', ')}`,
  }
}

async function main() {
  const results = await Promise.all(SLUGS.map(validateSlug))
  const failed = results.filter((r) => !r.ok)

  for (const result of results) {
    const marker = result.ok ? 'OK' : 'FALHA'
    console.log(`${marker} - ${result.slug} (${result.reason})`)
  }

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Erro ao validar LPs:', error)
  process.exitCode = 1
})
