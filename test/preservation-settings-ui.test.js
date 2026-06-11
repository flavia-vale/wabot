import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const PAGE = 'dashboard/app/painel/preservacao/configuracoes/page.js'
const FORMS = [
  ['ThrottleForm.js', 'channelThrottleEnabled'],
  ['QuietHoursForm.js', 'quietHoursEnabled'],
  ['FollowGuardForm.js', 'followGuardEnabled'],
  ['CopyVariationPoolEditor.js', 'copyVariationEnabled'],
]

test('página renderiza somente as cinco funcionalidades solicitadas', () => {
  const source = read(PAGE)
  for (const component of ['ThrottleForm', 'QuietHoursForm', 'FollowGuardForm', 'CopyVariationPoolEditor', 'ImageMutationToggle']) {
    assert.match(source, new RegExp(`<${component}\\b`), `${component} deve continuar visível`)
  }
  for (const hidden of ['PreservationMasterToggle', 'ProbeToggle', 'ClickTrackerStatus']) {
    assert.doesNotMatch(source, new RegExp(hidden), `${hidden} não pode aparecer na página`)
  }
})

test('componente legado do toggle mestre foi removido do código', () => {
  assert.equal(existsSync(new URL('../dashboard/components/preservacao/PreservationMasterToggle.js', import.meta.url)), false)
})

test('cada card configurável desabilita controles nativos quando seu toggle está off', () => {
  for (const [file, flag] of FORMS) {
    const source = read(`dashboard/components/preservacao/${file}`)
    assert.match(source, new RegExp(`controlsDisabled = disabled \\|\\| !value\\.${flag}`))
    assert.match(source, /disabled=\{controlsDisabled\}/)
    assert.match(source, new RegExp(`FeatureToggle[^>]+${flag}`), `${file} deve controlar ${flag}`)
  }
})

test('toggle de mutação usa diretamente o opt-in público imageMutationEnabled', () => {
  const source = read('dashboard/components/preservacao/ImageMutationToggle.js')
  assert.match(source, /checked=\{!!value\.imageMutationEnabled\}/)
  assert.match(source, /onChange=\{checked => onChange\(\{ imageMutationEnabled: checked \}\)\}/)
})
