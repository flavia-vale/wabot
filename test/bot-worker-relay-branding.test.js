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
  const passthroughIndex = botWorkerSource.indexOf("return { platform, url, converted: url, passthrough: true, linkKind: 'coupon' }")

  assert.notEqual(conversionCallIndex, -1)
  assert.notEqual(passthroughIndex, -1)
  assert.doesNotMatch(botWorkerSource, /const userCouponLink = String\(cfg\.botConfig\.couponLink/)
  assert.doesNotMatch(botWorkerSource, /urlsToStrip|stripUrlsFromText\s*\(/)
})


test('bot-worker não usa cupom como primary quando há produto na mesma mensagem', () => {
  assert.match(
    botWorkerSource,
    /const primaryCandidates = orderedConversions\.filter\(c => c\.linkKind !== 'coupon'\)/,
    'primary deve ignorar cupom quando houver conversão de produto',
  )
  assert.match(
    botWorkerSource,
    /const selectableConversions = primaryCandidates\.length \? primaryCandidates : orderedConversions/,
    'se só houver cupom, mantém fallback para não descartar a mensagem',
  )
})

test('bot-worker usa link original e convertido como chaves de dedup de envio', () => {
  assert.match(
    botWorkerSource,
    /const dedupSubjects = \[\.\.\.new Set\(\[primary\.url, primary\.converted, fallbackDedupSubject\]/,
    'dedup precisa guardar o link upstream estável e o link convertido final',
  )
  assert.match(
    botWorkerSource,
    /const dedupKeys = dedupSubjects\.map\(subject => `\$\{destJid\}:\$\{subject\}`\)/,
    'dedup deve aplicar as chaves por destino',
  )
  assert.match(
    botWorkerSource,
    /dedupKeys\.some\(key => dedup\.links\[key\]/,
    'dedup local precisa bloquear se qualquer chave já foi vista',
  )
  assert.match(
    botWorkerSource,
    /for \(const key of dedupKeys\) dedup\.links\[key\] = Date\.now\(\)/,
    'ao enviar, todas as chaves devem ser registradas para o próximo repost',
  )
})

test('bot-worker consulta MessageLog para dedup compartilhada entre processos', () => {
  assert.match(
    botWorkerSource,
    /const dedupLookupUrls = \[\.\.\.new Set\(\[primary\.url, primary\.converted\]\.filter\(Boolean\)\)\]/,
    'dedup DB deve consultar link original e convertido',
  )
  assert.match(
    botWorkerSource,
    /db\.messageLog\.findFirst\(\{[\s\S]*userId,[\s\S]*destGroup: destJid,[\s\S]*status: \{ in: \['queued', 'sending', 'success'\] \}/,
    'dedup DB deve bloquear envios recentes já enfileirados/enviados para mesmo usuário e destino',
  )
  assert.match(
    botWorkerSource,
    /originalUrl: \{ in: dedupLookupUrls \}[\s\S]*convertedUrl: \{ in: dedupLookupUrls \}/,
    'dedup DB deve comparar tanto originalUrl quanto convertedUrl',
  )
  assert.match(
    botWorkerSource,
    /Duplicata DB ignorada/,
    'dedup DB precisa deixar evidência nos logs quando bloquear',
  )
})

test('bot-worker usa primaryLinkTarget também para escolher a imagem do link principal', () => {
  const targetSelectionIndex = botWorkerSource.indexOf('const target = effectiveLinkTarget === \'last\' ? enabled[enabled.length - 1] : enabled[0]')
  const primarySelectionIndex = botWorkerSource.indexOf('const primary = (selectableConversions.length')

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
