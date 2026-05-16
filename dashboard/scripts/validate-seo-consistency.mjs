import fs from 'node:fs'
import path from 'node:path'

import { getIndexableSeoRoutes, CONTENT_SEO_ROUTES } from '../lib/seo-registry.mjs'
import { EDITORIAL_DATES } from '../lib/editorial-content.js'

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

  if (conflicts.length > 0 || missingEditorialDates.length > 0) {
    process.exitCode = 1
  }
}

main()
