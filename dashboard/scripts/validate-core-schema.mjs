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

function isValidAbsoluteUrl(value) {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function isValidAbsoluteUrlArray(values) {
  return Array.isArray(values) && values.length > 0 && values.every((value) => isValidAbsoluteUrl(value))
}

async function validateHomeSchemas() {
  const response = await fetch(`${baseUrl}/`)
  if (!response.ok) {
    throw new Error(`Falha ao carregar home: HTTP ${response.status}`)
  }

  const html = await response.text()
  const blocks = extractJsonLdBlocks(html)
  const organizations = blocks.filter((b) => b?.['@type'] === 'Organization')
  const softwareApps = blocks.filter((b) => b?.['@type'] === 'SoftwareApplication')

  if (organizations.length !== 1) {
    throw new Error(`Home deve conter exatamente 1 Organization. Encontrado: ${organizations.length}`)
  }

  if (softwareApps.length !== 1) {
    throw new Error(`Home deve conter exatamente 1 SoftwareApplication. Encontrado: ${softwareApps.length}`)
  }

  const [organization] = organizations
  const [softwareApplication] = softwareApps

  const missingFields = []
  if (!organization.name) missingFields.push('Organization.name')
  if (!organization.url || !isValidAbsoluteUrl(organization.url)) missingFields.push('Organization.url(abs)')
  if (!organization.logo || !isValidAbsoluteUrl(organization.logo)) missingFields.push('Organization.logo(abs)')
  if (!isValidAbsoluteUrlArray(organization.sameAs)) missingFields.push('Organization.sameAs(abs[])')

  if (!softwareApplication.url || !isValidAbsoluteUrl(softwareApplication.url)) missingFields.push('SoftwareApplication.url(abs)')
  if (!softwareApplication.description) missingFields.push('SoftwareApplication.description')
  if (!Array.isArray(softwareApplication.offers) || softwareApplication.offers.length === 0) {
    missingFields.push('SoftwareApplication.offers')
  }

  if (missingFields.length > 0) {
    throw new Error(`Campos obrigatórios ausentes/inválidos: ${missingFields.join(', ')}`)
  }
  console.log('OK: Home contém Organization e SoftwareApplication em JSON-LD.')
}

validateHomeSchemas().catch((error) => {
  console.error(`ERRO: ${error.message}`)
  process.exitCode = 1
})
