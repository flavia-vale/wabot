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

test('bot-worker preserva link de cupom original quando conversor pede strip', () => {
  const conversionCallIndex = botWorkerSource.indexOf('finalText = applyConversionsAndBranding(sanitizedText, conversions)')
  const passthroughIndex = botWorkerSource.indexOf('return { platform, url, converted: url, passthrough: true }')

  assert.notEqual(conversionCallIndex, -1)
  assert.notEqual(passthroughIndex, -1)
  assert.doesNotMatch(botWorkerSource, /const userCouponLink = String\(cfg\.botConfig\.couponLink/)
  assert.doesNotMatch(botWorkerSource, /urlsToStrip|stripUrlsFromText\s*\(/)
})

test('bot-worker usa link convertido como chave de dedup de envio', () => {
  assert.match(
    botWorkerSource,
    /const dedupSubject = primary\.converted \|\| primary\.url \|\|/,
    'dedup precisa usar o link convertido que sai no grupo antes do link upstream',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const dedupSubject = primary\.url \|\| `\$\{msg\.key\.id/,
    'não pode deduplicar primeiro pelo link original do grupo monitorado',
  )
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
