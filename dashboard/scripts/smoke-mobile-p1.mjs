import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')
const checks = []

function expectIncludes(file, needle, reason) {
  const source = read(file)
  if (!source.includes(needle)) checks.push(`${file}: missing ${needle} (${reason})`)
}

function expectNotIncludes(file, needle, reason) {
  const source = read(file)
  if (source.includes(needle)) checks.push(`${file}: still contains ${needle} (${reason})`)
}

expectIncludes('app/m/config/whatsapp/page.js', 'api.sessionPairingCode', 'mobile WhatsApp pairing flow must be wired')
expectIncludes('app/m/config/whatsapp/page.js', 'api.sessionStart', 'mobile WhatsApp connect must call backend session start')
expectIncludes('app/m/config/whatsapp/page.js', 'api.sessionStop', 'mobile WhatsApp disconnect must call backend session stop')

expectIncludes('app/m/config/credentials/page.js', 'api.saveCredential', 'mobile credentials must save through backoffice API')
expectIncludes('app/m/config/credentials/page.js', 'credential.data', 'mobile credentials must read the same shape as desktop')
expectNotIncludes('app/m/config/credentials/page.js', 'cred.value', 'legacy value shape marks real credentials as disconnected')

expectIncludes('app/m/config/groups/page.js', 'api.sessionWAGroups', 'mobile groups add flow should use WhatsApp groups from backend')
expectIncludes('app/m/config/groups/page.js', 'api.addGroup', 'mobile groups must add through backoffice API')
expectIncludes('app/m/config/groups/page.js', 'api.updateGroup', 'mobile group toggles must persist through API')
expectIncludes('app/m/config/groups/page.js', 'api.deleteGroup', 'mobile groups must support delete through API')

expectIncludes('app/m/op/offer/page.js', 'api.groups', 'mobile offer destinations must come from configured groups')
expectIncludes('app/m/op/offer/page.js', 'api.broadcastSend', 'mobile offer send must use existing backend send contract')
expectNotIncludes('app/m/op/offer/page.js', 'Sandália Bege Verão', 'offer product card must not be hardcoded')
expectNotIncludes('app/m/op/offer/page.js', 'Achados da Sol', 'offer destinations must not be fake')
expectNotIncludes('app/m/op/offer/page.js', 's.shopee.com.br/cupons-sol', 'offer bonuses must not use fake coupon links')

expectIncludes('app/m/op/espelhar/page.js', 'router.push(mobileRoutes.configWhatsApp)', 'mirror switch must route to real WhatsApp config')
expectIncludes('app/m/op/espelhar/page.js', 'router.push(mobileRoutes.configGroups)', 'mirror edit/add actions must route to real groups config')
expectNotIncludes('app/m/op/espelhar/page.js', '3 ativos', 'mirror filters must not show hardcoded count')
expectNotIncludes('app/m/op/espelhar/page.js', '1 envio a cada 12 minutos', 'mirror cadence must not be hardcoded')

if (checks.length > 0) {
  console.error('Mobile P1 smoke check failed:')
  for (const check of checks) console.error(`- ${check}`)
  process.exit(1)
}

console.log('Mobile P1 smoke check passed.')
