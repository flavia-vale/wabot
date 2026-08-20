import fs from 'node:fs'
import path from 'node:path'

import { getIndexableSeoRoutes, getAllSeoRoutes, CONTENT_SEO_ROUTES } from '../lib/seo-registry.mjs'
import { EDITORIAL_DATES } from '../lib/editorial-content.js'

const appDirForRobotsCheck = path.resolve(process.cwd(), 'app')

const robotsPath = path.resolve(process.cwd(), 'public/robots.txt')
const robotsSource = fs.readFileSync(robotsPath, 'utf8')

function getDisallowedPaths(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^Disallow:/i.test(line))
    .map((line) => line.replace(/^Disallow:\s*/i, '').trim())
    .filter(Boolean)
}

function isDisallowed(routePath, disallowedPath) {
  if (disallowedPath.endsWith('*')) {
    return routePath.startsWith(disallowedPath.slice(0, -1))
  }
  if (disallowedPath.endsWith('/')) {
    return routePath === disallowedPath.slice(0, -1) || routePath.startsWith(disallowedPath)
  }
  return routePath === disallowedPath
}

function validateRobotsVsIndexableRoutes() {
  const disallowed = getDisallowedPaths(robotsSource)
  const indexableRoutes = getIndexableSeoRoutes()
  const conflicts = []

  for (const route of indexableRoutes) {
    const matchedRule = disallowed.find((rule) => isDisallowed(route.path, rule))
    if (matchedRule) {
      conflicts.push({ path: route.path, rule: matchedRule })
    }
  }

  return conflicts
}

// P2 (specs/013-inbound-leads-strategy) — checagem 4: toda rota marcada
// indexable:false precisa ter a metadata que a gera realmente emitindo
// `robots` (via buildSeoRobots() ou declaração direta, caso do precedente
// /promo-vip-7dias). Sem isso a página sai do sitemap/IndexNow mas continua
// indexável de verdade — o sinal ficaria pela metade. Ver contracts/seo-robots.md.
const CHOKEPOINT_BY_TEMPLATE = {
  'programmatic-lp': 'app/_lpShared.js',
  'seo-hub': 'app/_seoHubShared.js',
  'commercial-seo': 'app/_preservationCommercialPages.js',
  'alternatives': 'app/_comparisonContent.js',
}

function resolveMetadataFileForRoute(route) {
  const chokepoint = CHOKEPOINT_BY_TEMPLATE[route.template]
  if (chokepoint) return path.resolve(process.cwd(), chokepoint)

  const routeDir = route.path === '/' ? '' : route.path.slice(1)
  const layoutFile = path.join(appDirForRobotsCheck, routeDir, 'layout.js')
  const pageFile = path.join(appDirForRobotsCheck, routeDir, 'page.js')
  if (fs.existsSync(layoutFile)) return layoutFile
  if (fs.existsSync(pageFile)) return pageFile
  return null
}

function validateNoindexRobotsWiring() {
  const missing = []
  const nonIndexableRoutes = getAllSeoRoutes().filter((route) => route.indexable === false)

  for (const route of nonIndexableRoutes) {
    const file = resolveMetadataFileForRoute(route)
    if (!file || !fs.existsSync(file)) {
      missing.push({ path: route.path, detail: 'arquivo de metadata da rota não encontrado' })
      continue
    }
    const source = fs.readFileSync(file, 'utf8')
    const wired = /buildSeoRobots/.test(source) || /robots:\s*\{\s*index:\s*false/.test(source)
    if (!wired) missing.push({ path: route.path, detail: file })
  }

  return missing
}

function validateEditorialCoverage() {
  const missing = []

  for (const route of CONTENT_SEO_ROUTES) {
    const dates = EDITORIAL_DATES[route.path]
    if (!dates?.updatedAt) {
      missing.push(route.path)
    }
  }

  return missing
}

function main() {
  const conflicts = validateRobotsVsIndexableRoutes()
  const missingEditorialDates = validateEditorialCoverage()
  const missingRobotsWiring = validateNoindexRobotsWiring()

  if (conflicts.length === 0) {
    console.log('OK: Nenhum conflito entre robots.txt e rotas indexáveis.')
  } else {
    for (const conflict of conflicts) {
      console.error(`ERRO: Rota indexável em conflito com robots.txt: ${conflict.path} (Disallow: ${conflict.rule})`)
    }
  }

  if (missingEditorialDates.length === 0) {
    console.log('OK: Todas as rotas de conteúdo possuem EDITORIAL_DATES.updatedAt.')
  } else {
    for (const routePath of missingEditorialDates) {
      console.error(`ERRO: Rota de conteúdo sem EDITORIAL_DATES.updatedAt: ${routePath}`)
    }
  }

  if (missingRobotsWiring.length === 0) {
    console.log('OK: Toda rota indexable:false emite `robots` na metadata que a gera.')
  } else {
    for (const item of missingRobotsWiring) {
      console.error(`ERRO: ${item.path} está marcada como não indexável mas nenhuma metadata emite \`robots\`.`)
      console.error(`      O sinal só sairia do sitemap — a página continuaria sendo indexada. (${item.detail})`)
    }
  }

  if (conflicts.length > 0 || missingEditorialDates.length > 0 || missingRobotsWiring.length > 0) {
    process.exitCode = 1
  }
}

main()
