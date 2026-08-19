import fs from 'node:fs'
import path from 'node:path'
import { getIndexableSeoRoutes, PROGRAMMATIC_SEO_ROUTES, HUB_SEO_ROUTES, SEO_ROUTES } from '../lib/seo-registry.mjs'

const appDir = path.resolve(process.cwd(), 'app')
const ignoredPaths = new Set(['/llms.txt', '/pricing.md'])

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
}

function parseMetadataFromPage(routePath) {
  const filePath = routePath === '/' ? path.join(appDir, 'page.js') : path.join(appDir, routePath.slice(1), 'page.js')
  if (!fs.existsSync(filePath)) return null
  const src = fs.readFileSync(filePath, 'utf8')

  // Cobre tanto metadata literal em objeto (`title: '...'`) quanto const no
  // topo do arquivo (`const title = '...'`), padrão usado por
  // programa-de-afiliados/page.js e blog/conferir-converter-link-afiliado-whatsapp/page.js.
  const titleMatch = src.match(/title\s*[:=]\s*['"`]([^'"`]+)['"`]/)
  const descriptionMatch = src.match(/description\s*[:=]\s*['"`]([^'"`]+)['"`]/)

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

// P1/P2 (specs/013-inbound-leads-strategy): dois módulos de conteúdo novos
// entram no parser — hoje o script só entendia _lpShared.js. Sem isso, uma
// divergência como a de /bot-achadinhos-whatsapp (registry com texto antigo,
// módulo com o novo) fica invisível para este guard.
function parsePreservationCommercialMeta() {
  const sourcePath = path.resolve(process.cwd(), 'app/_preservationCommercialPages.js')
  if (!fs.existsSync(sourcePath)) return new Map()
  const source = fs.readFileSync(sourcePath, 'utf8')
  const map = new Map()
  // Blocos são chaveados por pageKey, não por path — o path real vem do
  // campo `path:` dentro do próprio bloco.
  const blockRegex = /'[^']+':\s*\{\s*path:\s*'([^']+)'[^}]*?title:\s*'([^']+)'[^}]*?description:\s*'([^']+)'/gs
  for (const match of source.matchAll(blockRegex)) {
    const [, routePath, title, description] = match
    map.set(routePath, { title, description })
  }
  return map
}

function parseComparisonContentMeta() {
  const sourcePath = path.resolve(process.cwd(), 'app/_comparisonContent.js')
  if (!fs.existsSync(sourcePath)) return new Map()
  const source = fs.readFileSync(sourcePath, 'utf8')
  const map = new Map()
  // Aqui os blocos já são chaveados pelo path completo (com barra).
  const blockRegex = /'(\/[^']+)':\s*\{[^}]*?title:\s*'([^']+)'[^}]*?description:\s*'([^']+)'/gs
  for (const match of source.matchAll(blockRegex)) {
    const [, routePath, title, description] = match
    map.set(routePath, { title, description })
  }
  return map
}

function parseSeoHubMeta() {
  const sourcePath = path.resolve(process.cwd(), 'app/_seoHubShared.js')
  if (!fs.existsSync(sourcePath)) return new Map()
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
const preservationMeta = parsePreservationCommercialMeta()
const comparisonMeta = parseComparisonContentMeta()
const hubMeta = parseSeoHubMeta()

// União de todos os módulos de conteúdo, indexada por path. É a "outra
// ponta" da checagem de fonte única (FR-001): se um path tiver algo aqui E
// title/description literal no registry, é divergência silenciosa em
// potencial (ou pelo menos dado morto duplicado).
const contentMetaByPath = new Map([...programmaticMeta, ...preservationMeta, ...comparisonMeta, ...hubMeta])

const records = []

for (const route of getIndexableSeoRoutes()) {
  if (ignoredPaths.has(route.path)) continue

  let title = route.title || null
  let description = route.description || null

  if (!title || !description) {
    const fromModule = contentMetaByPath.get(route.path)
    title = fromModule?.title || title
    description = fromModule?.description || description
  }

  if (!title || !description) {
    const fromPage = parseMetadataFromPage(route.path)
    title = fromPage?.title || title
    description = fromPage?.description || description
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

// FR-001 — fonte única: título/descrição de um mesmo path têm que morar em
// UM lugar só (o seo-registry.mjs OU o módulo de conteúdo que renderiza a
// página, nunca os dois). Foi exatamente essa divergência silenciosa que
// deixou o registry com o título antigo de /bot-achadinhos-whatsapp (66
// chars, de antes do PR #1420) enquanto o ar já servia o novo (56 chars) —
// nenhum validador comparava os dois lugares até este guard existir.
const sourceConflicts = []
for (const route of SEO_ROUTES) {
  const moduleMeta = contentMetaByPath.get(route.path)
  if (!moduleMeta) continue
  if (route.title && moduleMeta.title) sourceConflicts.push({ path: route.path, field: 'title' })
  if (route.description && moduleMeta.description) sourceConflicts.push({ path: route.path, field: 'description' })
}

if (sourceConflicts.length > 0) {
  console.error('ERRO: title/description em DOIS lugares para a(s) rota(s) abaixo (fonte única quebrada, FR-001):')
  sourceConflicts.forEach(({ path: p, field }) =>
    console.error(` - ${p} (${field}) — está em dashboard/lib/seo-registry.mjs E no módulo de conteúdo que renderiza a página`)
  )
  process.exitCode = 1
}

const incompleteRecords = records.filter((r) => !r.title || !r.description)
if (incompleteRecords.length > 0) {
  console.warn(`AVISO: ${incompleteRecords.length} rotas indexáveis sem metadata completa; não entram na validação de duplicidade.`)
}

if (!process.exitCode) {
  console.log(`OK: ${completeRecords.length}/${records.length} rotas indexáveis avaliadas com metadata única (title/description).`)
}
