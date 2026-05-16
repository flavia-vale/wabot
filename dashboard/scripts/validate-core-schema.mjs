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

async function validateHomeSchemas() {
  const response = await fetch(`${baseUrl}/`)
  if (!response.ok) {
    throw new Error(`Falha ao carregar home: HTTP ${response.status}`)
  }

  const html = await response.text()
  const blocks = extractJsonLdBlocks(html)
  const types = new Set(blocks.map((b) => b?.['@type']).filter(Boolean))

  const missing = []
  if (!types.has('Organization')) missing.push('Organization')
  if (!types.has('SoftwareApplication')) missing.push('SoftwareApplication')

  if (missing.length > 0) {
    throw new Error(`Schema ausente na home: ${missing.join(', ')}`)
  }

  console.log('OK: Home contém Organization e SoftwareApplication em JSON-LD.')
}

validateHomeSchemas().catch((error) => {
  console.error(`ERRO: ${error.message}`)
  process.exitCode = 1
})
