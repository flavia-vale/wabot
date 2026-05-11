import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dashboardDir = process.env.DASHBOARD_DIR || join(process.cwd(), 'dashboard')
const manifestPath = join(dashboardDir, '.next', 'server', 'app-paths-manifest.json')
const routeArtifactPath = join(dashboardDir, '.next', 'server', 'app', 'api', '[...path]', 'route.js')
const requiredManifestKey = '/api/[...path]/route'

function fail(message) {
  console.error(`ERRO: ${message}`)
  process.exit(1)
}

if (!existsSync(manifestPath)) {
  fail(`manifest ausente: ${manifestPath}`)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (err) {
  fail(`manifest inválido (${manifestPath}): ${err.message}`)
}

if (!manifest[requiredManifestKey]) {
  fail(`rota ${requiredManifestKey} ausente do build; /api/auth/login cairia no 404 do Next.js`)
}

if (!existsSync(routeArtifactPath)) {
  fail(`artefato da rota proxy ausente: ${routeArtifactPath}`)
}

console.log(`OK: rota ${requiredManifestKey} presente no build do dashboard.`)
