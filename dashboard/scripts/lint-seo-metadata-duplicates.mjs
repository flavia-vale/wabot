import fs from 'node:fs'
import path from 'node:path'
import { getIndexableSeoRoutes, PROGRAMMATIC_SEO_ROUTES, HUB_SEO_ROUTES } from '../lib/seo-registry.mjs'

const appDir = path.resolve(process.cwd(), 'app')
const ignoredPaths = new Set(['/llms.txt', '/pricing.md'])

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
}

function parseMetadataFromPage(routePath) {
  const filePath = routePath === '/' ? path.join(appDir, 'page.js') : path.join(appDir, routePath.slice(1), 'page.js')
  if (!fs.existsSync(filePath)) return null
  const src = fs.readFileSync(filePath, 'utf8')

  const titleMatch = src.match(/title:\s*['"`]([^'"`]+)['"`]/)
  const descriptionMatch = src.match(/description:\s*['"`]([^'"`]+)['"`]/)

  return {
    title: titleMatch?.[1] || null,
    description: descriptionMatch?.[1] || null,
  }
}


function parseProgrammaticMetadataFromLpShared() {
  const sourcePath = path.resolve(process.cwd(), 'app/_lpShared.js')
  const source = fs.readFileSync(sourcePath, 'utf8')
  const map = new Map()
  const blockRegex = /'([^']+)':\s*\{[^}]*?title:\s*'([^']+)'[^}]*?description:\s*'([^']+)'/gs
  for (const match of source.matchAll(blockRegex)) {
    const [, slug, title, description] = match
    map.set(`/${slug}`, { title, description })
  }
  return map
}

const programmaticMeta = parseProgrammaticMetadataFromLpShared()

const records = []

for (const route of getIndexableSeoRoutes()) {
  if (ignoredPaths.has(route.path)) continue

  let title = route.title || null
  let description = route.description || null

  if (!title || !description) {
    if (PROGRAMMATIC_SEO_ROUTES.some((r) => r.path === route.path)) {
      title = programmaticMeta.get(route.path)?.title || title
      description = programmaticMeta.get(route.path)?.description || description
    }

    if ((!title || !description) && HUB_SEO_ROUTES.some((r) => r.path === route.path)) {
      const hub = HUB_SEO_ROUTES.find((r) => r.path === route.path)
      title = hub?.title || title
      description = hub?.description || description
    }

    if (!title || !description) {
      const fromPage = parseMetadataFromPage(route.path)
      title = fromPage?.title || title
      description = fromPage?.description || description
    }
  }

  records.push({ path: route.path, title, description })
}

const completeRecords = records.filter((r) => r.title && r.description)

function duplicatesByComplete(field) {
  const map = new Map()
  for (const record of completeRecords) {
    const norm = normalize(record[field])
    if (!norm) continue
    const arr = map.get(norm) || []
    arr.push(record.path)
    map.set(norm, arr)
  }
  return [...map.entries()].filter(([, paths]) => paths.length > 1)
}

const dupTitles = duplicatesByComplete('title')
const dupDescriptions = duplicatesByComplete('description')

if (dupTitles.length > 0) {
  console.error('ERRO: títulos duplicados em rotas indexáveis:')
  dupTitles.forEach(([value, paths]) => console.error(` - "${value}" => ${paths.join(', ')}`))
  process.exitCode = 1
}

if (dupDescriptions.length > 0) {
  console.error('ERRO: descriptions duplicadas em rotas indexáveis:')
  dupDescriptions.forEach(([value, paths]) => console.error(` - "${value}" => ${paths.join(', ')}`))
  process.exitCode = 1
}

const incompleteRecords = records.filter((r) => !r.title || !r.description)
if (incompleteRecords.length > 0) {
  console.warn(`AVISO: ${incompleteRecords.length} rotas indexáveis sem metadata completa; não entram na validação de duplicidade.`)
}

if (!process.exitCode) {
  console.log(`OK: ${completeRecords.length}/${records.length} rotas indexáveis avaliadas com metadata única (title/description).`)
}
