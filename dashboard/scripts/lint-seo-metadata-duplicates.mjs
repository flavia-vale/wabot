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
    // A página é DONA da própria metadata? Só nesse caso um title no registry
    // é conflito de fonte — sem isso, um `title:` solto no meio do JSX (um
    // card, um gráfico) viraria falso positivo. O regex acima é
    // deliberadamente frouxo porque serve também para preencher lacuna no
    // laço de registros; a checagem de conflito exige este sinal explícito.
    ownsMetadata: /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(src),
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

// T050 (specs/013-inbound-leads-strategy, FR-001): sétimo módulo de conteúdo,
// e o último que faltava. As 4 rotas daqui tinham title E description também
// no registry — mesma classe de dado morto que já derivou em outras rotas.
// Blocos chaveados pelo path completo, como `_comparisonContent.js`.
function parsePreservationDecisionMeta() {
  const sourcePath = path.resolve(process.cwd(), 'app/_preservationDecisionPages.js')
  if (!fs.existsSync(sourcePath)) return new Map()
  const source = fs.readFileSync(sourcePath, 'utf8')
  const map = new Map()
  const blockRegex = /'(\/[^']+)':\s*\{[^}]*?title:\s*'([^']+)'[^}]*?description:\s*'([^']+)'/gs
  for (const match of source.matchAll(blockRegex)) {
    const [, routePath, title, description] = match
    map.set(routePath, { title, description })
  }
  return map
}

// T053 (specs/013-inbound-leads-strategy, FR-001): as páginas orgânicas de
// nicho também são donas da própria metadata. Os blocos são chaveados por uma
// chave sem barra, mas o path canônico vem do campo `slug:`.
function parseOrganicNicheMeta() {
  const sourcePath = path.resolve(process.cwd(), 'app/_organicNicheLanding.js')
  if (!fs.existsSync(sourcePath)) return new Map()
  const source = fs.readFileSync(sourcePath, 'utf8')
  const map = new Map()
  const blockRegex = /'[^']+':\s*\{\s*slug:\s*'([^']+)'[^}]*?title:\s*'([^']+)'[^}]*?description:\s*'([^']+)'/gs
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

// T046 (specs/013-inbound-leads-strategy, FR-001): módulo de conteúdo dos
// posts de blog — mesmo buraco do PR #1420 (bot-achadinhos-whatsapp), só que
// em 11 rotas de /blog/*. Blocos são chaveados por postKey, não por path; o
// path real vem do campo `slug:` dentro do próprio bloco (diferente de
// `_preservationCommercialPages.js`, que usa `path:`).
function parsePreservationBlogMeta() {
  const sourcePath = path.resolve(process.cwd(), 'app/blog/_preservationBlogPosts.js')
  if (!fs.existsSync(sourcePath)) return new Map()
  const source = fs.readFileSync(sourcePath, 'utf8')
  const map = new Map()
  const blockRegex = /'[^']+':\s*\{\s*slug:\s*'([^']+)'[^}]*?title:\s*'([^']+)'[^}]*?description:\s*'([^']+)'/gs
  for (const match of source.matchAll(blockRegex)) {
    const [, routePath, title, description] = match
    map.set(routePath, { title, description })
  }
  return map
}

const programmaticMeta = parseProgrammaticMetadataFromLpShared()
const preservationMeta = parsePreservationCommercialMeta()
const comparisonMeta = parseComparisonContentMeta()
const hubMeta = parseSeoHubMeta()
const preservationBlogMeta = parsePreservationBlogMeta()
const preservationDecisionMeta = parsePreservationDecisionMeta()
const organicNicheMeta = parseOrganicNicheMeta()

// União de todos os módulos de conteúdo, indexada por path. É a "outra
// ponta" da checagem de fonte única (FR-001): se um path tiver algo aqui E
// title/description literal no registry, é divergência silenciosa em
// potencial (ou pelo menos dado morto duplicado).
const contentMetaByPath = new Map([...programmaticMeta, ...preservationMeta, ...comparisonMeta, ...hubMeta, ...preservationBlogMeta, ...preservationDecisionMeta, ...organicNicheMeta])

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
  if (moduleMeta) {
    if (route.title && moduleMeta.title) sourceConflicts.push({ path: route.path, field: 'title', onde: 'o módulo de conteúdo que renderiza a página' })
    if (route.description && moduleMeta.description) sourceConflicts.push({ path: route.path, field: 'description', onde: 'o módulo de conteúdo que renderiza a página' })
    continue
  }

  // Rota servida pelo próprio `page.js` (sem módulo de conteúdo compartilhado).
  // Esta classe escapava do guard: `parseMetadataFromPage` existia, mas só era
  // usada para PREENCHER lacuna no laço de registros, nunca para acusar
  // conflito. Resultado medido em 2026-08-19: 5 rotas com title/description nos
  // dois lugares, 3 já divergidas, e as cópias paradas no registry ainda
  // traziam o sufixo de marca que já tinha sido removido do que vai ao ar.
  const pageMeta = parseMetadataFromPage(route.path)
  if (!pageMeta?.ownsMetadata) continue
  if (route.title && pageMeta.title) sourceConflicts.push({ path: route.path, field: 'title', onde: 'o próprio page.js da rota' })
  if (route.description && pageMeta.description) sourceConflicts.push({ path: route.path, field: 'description', onde: 'o próprio page.js da rota' })
}

if (sourceConflicts.length > 0) {
  console.error('ERRO: title/description em DOIS lugares para a(s) rota(s) abaixo (fonte única quebrada, FR-001):')
  sourceConflicts.forEach(({ path: p, field, onde }) =>
    console.error(` - ${p} (${field}) — está em dashboard/lib/seo-registry.mjs E em ${onde}`)
  )
  process.exitCode = 1
}

const incompleteRecords = records.filter((r) => !r.title || !r.description)
const reportJson = process.argv.includes('--report-json')

if (reportJson) {
  // Saída estruturada para as guardas automatizadas observarem o resultado
  // deste lint, em vez de reimplementarem seus parsers ou inferirem cobertura
  // apenas pela cardinalidade agregada (T055). A execução CLI sem a flag
  // mantém exatamente as mensagens humanas históricas abaixo.
  console.log(JSON.stringify({
    completePaths: completeRecords.map((record) => record.path),
    incompletePaths: incompleteRecords.map((record) => record.path),
    total: records.length,
  }))
} else if (incompleteRecords.length > 0) {
  console.warn(`AVISO: ${incompleteRecords.length} rotas indexáveis sem metadata completa; não entram na validação de duplicidade.`)
}

if (!reportJson && !process.exitCode) {
  console.log(`OK: ${completeRecords.length}/${records.length} rotas indexáveis avaliadas com metadata única (title/description).`)
}
