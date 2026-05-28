import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')
const failures = []

function includes(file, needle, reason) {
  if (!read(file).includes(needle)) failures.push(`${file}: missing ${needle} (${reason})`)
}
function excludes(file, needle, reason) {
  if (read(file).includes(needle)) failures.push(`${file}: still contains ${needle} (${reason})`)
}

includes('app/m/op/logs/page.js', 'loadMoreLogs', 'logs must support pagination/load more')
includes('app/m/op/logs/page.js', 'setPage((current) => current + 1)', 'logs must advance page state')
excludes('app/m/op/logs/page.js', 'Tentar de novo', 'unsupported log actions must be hidden/disabled')
excludes('app/m/op/logs/page.js', 'Postar mesmo assim', 'unsupported log actions must be hidden/disabled')
excludes('app/m/op/logs/page.js', 'Repostar', 'unsupported log actions must be hidden/disabled')

includes('app/m/account/page.js', 'api.logout', 'account logout must call API')
includes('app/m/account/page.js', 'router.push(mobileRoutes.accountSubscription)', 'subscription row must route to mobile subscription')
includes('app/m/account/page.js', 'router.push(mobileRoutes.accountTemplates)', 'templates row must route to mobile templates')
includes('app/m/account/page.js', 'router.push(mobileRoutes.configPreferences)', 'preferences row must route to mobile preferences')
includes('app/m/account/page.js', 'router.push(mobileRoutes.helpTutorial)', 'support/tutorial row must route to mobile help')

excludes('app/m/account/subscription/page.js', '2847', 'subscription must not fake monthly posts')
excludes('app/m/account/subscription/page.js', 'storesConnected || 4', 'subscription must not fake connected stores')
includes('app/m/account/subscription/page.js', 'api.paymentsCheckout', 'subscription must start checkout through payments API')
includes('app/m/account/subscription/page.js', 'api.paymentsRecover', 'subscription must support payment recovery')
includes('app/m/account/subscription/page.js', 'Indisponível', 'missing stats must show unavailable state')

includes('app/m/config/preferences/page.js', 'api.saveConfig', 'preferences toggles must persist')
includes('app/m/config/preferences/page.js', 'setDraft', 'preferences must be controlled')
excludes('app/m/config/preferences/page.js', 'alterada há 23 dias', 'preferences must not show fake account data')
excludes('app/m/config/preferences/page.js', 'Verificação em 2 etapas', 'unsupported settings must be removed')

includes('app/m/account/templates/page.js', 'api.saveConfig', 'templates must save to config')
includes('app/m/account/templates/page.js', 'messageTemplates', 'templates must align with config field')
excludes('app/m/account/templates/page.js', 'wa.me/achadosdasol', 'templates must not ship fake group links')
excludes('app/m/account/templates/page.js', 'usado em 84%', 'templates must not fake usage metrics')

includes('app/m/help/tutorial/page.js', 'mobileRoutes.offer', 'tutorial must link first offer flow')
includes('app/m/help/tutorial/page.js', 'mobileRoutes.configPreferences', 'tutorial must link preferences/templates')
includes('app/m/help/tutorial/page.js', 'mobileRoutes.logs', 'tutorial must link logs')

if (failures.length) {
  console.error('Mobile P2 smoke check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Mobile P2 smoke check passed.')
