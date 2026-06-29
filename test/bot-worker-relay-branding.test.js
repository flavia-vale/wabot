import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

test('bot-worker relay convertido não passa branding global para texto original', () => {
  assert.match(
    botWorkerSource,
    /finalText = applyConversionsAndBranding\(sanitizedText, conversions\)/,
  )
  assert.doesNotMatch(
    botWorkerSource,
    /applyConversionsAndBranding\(sanitizedText, conversions, cfg\.botConfig\.brandingGroupLink/,
  )
})

test('bot-worker mantém substituição de cupom do usuário após conversão do relay', () => {
  const conversionCallIndex = botWorkerSource.indexOf('finalText = applyConversionsAndBranding(sanitizedText, conversions)')
  const couponBlockIndex = botWorkerSource.indexOf('const userCouponLink = String(cfg.botConfig.couponLink || \'\').trim()', conversionCallIndex)

  assert.notEqual(conversionCallIndex, -1)
  assert.notEqual(couponBlockIndex, -1)
  assert.ok(couponBlockIndex > conversionCallIndex)
})

test('bot-worker usa primaryLinkTarget também para escolher a imagem do link principal', () => {
  const targetSelectionIndex = botWorkerSource.indexOf('const target = effectiveLinkTarget === \'last\' ? enabled[enabled.length - 1] : enabled[0]')
  const primarySelectionIndex = botWorkerSource.indexOf('const primary = (orderedConversions.length')

  assert.notEqual(targetSelectionIndex, -1)
  assert.notEqual(primarySelectionIndex, -1)
  assert.ok(targetSelectionIndex < primarySelectionIndex, 'getImage deve usar a mesma escolha antes do envio')
  assert.match(
    botWorkerSource,
    /const effectiveLinkTarget = monitorGroup\?\.primaryLinkTarget\s*\|\|\s*cfg\.botConfig\?\.primaryLinkTargetDefault\s*\|\|\s*'first'/,
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const target = monitorGroup\.imageLinkTarget === 'last'/,
  )
})
