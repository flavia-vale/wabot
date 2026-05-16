import { getIndexableSeoRoutes } from '../lib/seo-registry.mjs'
import { EDITORIAL_DATES } from '../lib/editorial-content.js'

const STALE_DAYS_LIMIT = Number(process.env.EDITORIAL_STALE_DAYS || 120)
const now = new Date()

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

const editorialRoutes = getIndexableSeoRoutes().filter((r) => r.template === 'article' || r.template === 'benchmark' || r.template === 'lead-magnet' || r.template === 'content-hub' || r.template === 'case-studies' || r.template === 'glossary' || r.template === 'methodology' || r.template === 'comparison' || r.template === 'alternatives' || r.template === 'listicle')

const stale = []
for (const route of editorialRoutes) {
  const dates = EDITORIAL_DATES[route.path]
  if (!dates?.updatedAt) continue
  const age = daysBetween(now, new Date(dates.updatedAt))
  if (age > STALE_DAYS_LIMIT) stale.push({ path: route.path, age })
}

if (stale.length) {
  console.error(`ERRO: ${stale.length} rotas editoriais acima do limite de ${STALE_DAYS_LIMIT} dias sem atualização:`)
  stale.forEach((s) => console.error(` - ${s.path} (${s.age} dias)`))
  process.exitCode = 1
} else {
  console.log(`OK: rotas editoriais dentro da janela de atualização (${STALE_DAYS_LIMIT} dias).`)
}
