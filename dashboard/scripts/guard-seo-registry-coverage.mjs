import fs from 'node:fs'
import path from 'node:path'
import { getAllSeoRoutes } from '../lib/seo-registry.mjs'

const appDir = path.resolve(process.cwd(), 'app')
// /esqueci-senha e /nova-senha: fluxo de recuperação de senha, mesma
// natureza de /login (utilitário de autenticação, sem valor de SEO) — gap
// pré-existente encontrado ao ajustar este guard em specs/013-inbound-leads-strategy
// (T013), não coberto por nenhuma task desta feature além do próprio ajuste do guard.
const privatePrefixes = ['/painel', '/admin', '/login', '/esqueci-senha', '/nova-senha', '/api', '/promo-vip-7dias']
const nonPageFiles = new Set(['layout.js', 'loading.js', 'error.js', 'not-found.js', 'template.js', 'route.js', 'default.js'])
const allowedUnregistered = new Set(['/sitemap.xml', '/robots.txt'])

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

function toRoute(filePath) {
  const rel = path.relative(appDir, filePath).replace(/\\/g, '/')
  if (!rel.endsWith('/page.js')) return null
  const routePath = `/${rel.replace(/\/page\.js$/, '')}`.replace(/\/index$/, '')
  if (routePath === '/page.js' || routePath === '/') return '/'
  return routePath
}

function isPublicRoute(route) {
  if (!route || route.includes('[')) return false
  return !privatePrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))
}

const pageFiles = walk(appDir).filter((file) => {
  const base = path.basename(file)
  if (nonPageFiles.has(base)) return false
  return file.endsWith('/page.js')
})

const publicRoutesFromFs = pageFiles
  .map(toRoute)
  .filter((route) => isPublicRoute(route) && !allowedUnregistered.has(route))

// P2 (specs/013-inbound-leads-strategy): a base de comparação é a COBERTURA
// do registro (getAllSeoRoutes), não mais a lista de indexáveis. Cobertura =
// estar no registro; indexação (campo `indexable`) é decisão separada, lida
// só por buildSeoRobots/sitemap/IndexNow. Antes deste ajuste, a 1ª rota
// marcada `indexable: false` reprovava este guard como se tivesse sumido do
// registro — ver contracts/seo-robots.md.
const registered = new Set(getAllSeoRoutes().map((route) => route.path))

const missingInRegistry = [...new Set(publicRoutesFromFs)].filter((route) => !registered.has(route)).sort()

if (missingInRegistry.length > 0) {
  console.error('ERRO: rotas públicas sem entrada no seo-registry:')
  missingInRegistry.forEach((route) => console.error(` - ${route}`))
  process.exitCode = 1
} else {
  console.log('OK: todas as rotas públicas detectadas estão cobertas no seo-registry.')
}
