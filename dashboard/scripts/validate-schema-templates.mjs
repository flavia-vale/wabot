import { getIndexableSeoRoutes } from '../lib/seo-registry.mjs'

const baseUrl = (process.env.LP_BASE_URL || process.argv[2] || 'http://localhost:3006').replace(/\/$/, '')

const preferredSamplesByTemplate = {
  home: '/',
  'seo-hub': '/espelhar-grupos-whatsapp',
  'programmatic-lp': '/espelhar-grupos-whatsapp-sao-paulo',
  'organic-niche': '/bot-ofertas-restaurantes-whatsapp',
  article: '/blog/como-escalar-grupos-sem-operacao-manual',
  benchmark: '/benchmarks/operacao-grupos-ofertas-whatsapp',
  'lead-magnet': '/materiais/checklist-operacao-whatsapp',
  'content-hub': '/conteudos',
}

function extractJsonLdTypes(html) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const types = []
  for (const [, json] of matches) {
    try {
      const parsed = JSON.parse(json)
      if (parsed?.['@type']) types.push(parsed['@type'])
    } catch {}
  }
  return new Set(types)
}

const routes = getIndexableSeoRoutes().filter((r) => Array.isArray(r.schemaTypes) && r.schemaTypes.length > 0)
const templates = [...new Set(routes.map((r) => r.template))]

async function validateTemplate(template) {
  const expectedTypes = new Set(routes.filter((r) => r.template === template).flatMap((r) => r.schemaTypes))
  const samplePath = preferredSamplesByTemplate[template] || routes.find((r) => r.template === template)?.path
  if (!samplePath) return { template, ok: false, reason: 'Sem rota de amostra' }

  const response = await fetch(`${baseUrl}${samplePath}`)
  if (!response.ok) return { template, ok: false, reason: `HTTP ${response.status} em ${samplePath}` }
  const html = await response.text()
  const foundTypes = extractJsonLdTypes(html)
  const missingTypes = [...expectedTypes].filter((t) => !foundTypes.has(t))

  return { template, ok: missingTypes.length === 0, reason: missingTypes.length ? `Missing: ${missingTypes.join(', ')} (${samplePath})` : `OK (${samplePath})` }
}

const results = await Promise.all(templates.map(validateTemplate))
results.forEach((r) => console.log(`${r.ok ? 'OK' : 'FALHA'} - template ${r.template}: ${r.reason}`))
if (results.some((r) => !r.ok)) process.exitCode = 1
