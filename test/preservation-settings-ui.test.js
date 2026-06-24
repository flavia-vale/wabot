import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const PAGE = 'dashboard/app/painel/preservacao/configuracoes/page.js'
// Plano B / Fase 3 (passo 2): só os forms que controlam uma defesa de CONTA com
// FeatureToggle. Throttle/QuietHours saíram (viraram config por destino).
const FORMS = [
  ['FollowGuardForm.js', 'followGuardEnabled'],
]

test('página renderiza só as defesas de conta (cadência/horário foram para por destino)', () => {
  const source = read(PAGE)
  for (const component of ['ChannelStaggerForm', 'FollowGuardForm', 'ImageMutationToggle']) {
    assert.match(source, new RegExp(`<${component}\\b`), `${component} deve continuar visível`)
  }
  // Cadência/janela global saíram da página (agora são por destino) — e os
  // editores consolidados em outras telas também não podem reaparecer.
  for (const hidden of ['ThrottleForm', 'QuietHoursForm', 'PreservationMasterToggle', 'ProbeToggle', 'ClickTrackerStatus', 'CopyVariationPoolEditor']) {
    assert.doesNotMatch(source, new RegExp(`<${hidden}\\b`), `${hidden} não pode aparecer na página`)
  }
  // Aponta o usuário para onde a cadência/horário vive agora.
  assert.match(source, /preservacao\/destinos/, 'deve linkar para a preservação por destino')
})

test('componentes globais legados foram removidos do código', () => {
  assert.equal(existsSync(new URL('../dashboard/components/preservacao/PreservationMasterToggle.js', import.meta.url)), false)
  assert.equal(existsSync(new URL('../dashboard/components/preservacao/ThrottleForm.js', import.meta.url)), false)
  assert.equal(existsSync(new URL('../dashboard/components/preservacao/QuietHoursForm.js', import.meta.url)), false)
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

test('toggle de mutação sinaliza que mensagens espelhadas ainda não são cobertas (issue #1033)', () => {
  const source = read('dashboard/components/preservacao/ImageMutationToggle.js')
  assert.match(source, /não se aplica às mensagens espelhadas/i)
})
