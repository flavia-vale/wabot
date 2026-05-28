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

includes('components/mobile/MobileShell.jsx', "minHeight: '100dvh'", 'MobileShell must use dynamic viewport height')
includes('components/mobile/MobileShell.jsx', "paddingBottom: 'calc(92px + env(safe-area-inset-bottom))'", 'content must reserve bottom-nav safe area')
includes('components/mobile/MobileShell.jsx', "paddingBottom: 'calc(10px + env(safe-area-inset-bottom))'", 'bottom nav must respect safe-area inset')
includes('components/mobile/MobileShell.jsx', ':focus-visible', 'mobile shell must expose visible keyboard focus states')
includes('components/mobile/MobileShell.jsx', 'className="mobile-shell"', 'focus styles must be scoped to mobile shell')
includes('components/mobile/mobileStyles.js', 'minHeight: 44', 'shared mobile primitives must enforce tap target height')
includes('components/mobile/mobileStyles.js', 'rowButton:', 'route rows should reuse a shared button primitive')

excludes('app/m/page.js', '<div style={homeStyles.alert} onClick', 'clickable alert must be a button')
excludes('app/m/page.js', '<div style={homeStyles.sectionLink} onClick', 'section link must be a button')
excludes('app/m/op/logs/page.js', '<div key={it.id} style={envStyles.item(isExp)} onClick', 'expandable log item must be a button')
excludes('app/m/help/tutorial/page.js', 'onClick={() => router.push(p.route)}\n              style={{', 'tutorial step must be a button, not clickable div')
includes('app/m/op/logs/page.js', 'aria-label="Ajustar ritmo de envio"', 'icon-only cadence control needs an aria-label')
includes('components/mobile/MobileAsyncState.jsx', 'minHeight', 'loading cards should reserve space and avoid layout shift')

if (failures.length) {
  console.error('Mobile P3 smoke check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Mobile P3 smoke check passed.')
