import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dashboardRoot = path.resolve(__dirname, '..')
const mobileAppRoot = path.join(dashboardRoot, 'app', 'm')
const validShellTabs = new Set(['inicio', 'espelhar', 'criar', 'envios', 'conta'])

function collectPageFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectPageFiles(fullPath)
    return entry.isFile() && entry.name === 'page.js' ? [fullPath] : []
  })
}

function toRepoPath(filePath) {
  return path.relative(dashboardRoot, filePath).split(path.sep).join('/')
}

if (!existsSync(mobileAppRoot)) {
  console.error(`Mobile app root not found: ${mobileAppRoot}`)
  process.exit(1)
}

const pageFiles = collectPageFiles(mobileAppRoot).sort()
const failures = []

for (const file of pageFiles) {
  const source = readFileSync(file, 'utf8')
  const activeMatches = source.matchAll(/<MobileShell\b[^>]*\bactive=(?:"([^"]+)"|'([^']+)')/g)
  for (const match of activeMatches) {
    const activeKey = match[1] ?? match[2]
    if (!validShellTabs.has(activeKey)) {
      failures.push(`${toRepoPath(file)} uses unsupported MobileShell active="${activeKey}"`)
    }
  }
}

if (failures.length > 0) {
  console.error('Mobile route smoke check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Mobile route smoke check passed for ${pageFiles.length} /m page routes.`)
