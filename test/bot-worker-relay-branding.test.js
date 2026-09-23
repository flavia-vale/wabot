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

test('bot-worker não publica link de cupom original quando conversor pede strip', () => {
  const conversionCallIndex = botWorkerSource.indexOf('finalText = applyConversionsAndBranding(sanitizedText, conversions)')
  assert.notEqual(conversionCallIndex, -1)
  assert.equal(botWorkerSource.indexOf('passthrough: true'), -1)
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
  // A construção das chaves foi extraída para buildMirrorDedupKeys
  // (src/core/mirrorDedupKey.js, comportamento coberto por
  // test/mirror-dedup-key.test.js). Aqui garantimos só a FIAÇÃO no worker:
  // que ele delega passando os dois links e registra/consulta as chaves.
  assert.match(
    botWorkerSource,
    /buildMirrorDedupKeys\(\{[\s\S]*?primaryUrl: primary\.url,[\s\S]*?primaryConverted: primary\.converted,/,
    'dedup precisa derivar as chaves do link upstream estável e do link convertido final',
  )
  assert.match(
    botWorkerSource,
    /\.map\(key => \(dedup\.links\[key\] \? \{ key, ageMs:/,
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
  // RCA 2026-07 (mensagem espelhada 5x): a checagem deixou de ser um único
  // `status: { in: [...] } + sentAt na janela` e passou a ter dois ramos —
  // já-entregue DENTRO da janela do link, e ainda-PENDENTE independente da
  // janela (job pode estar adiado há horas pela preservação do destino).
  assert.match(
    botWorkerSource,
    /db\.messageLog\.findFirst\(\{[\s\S]*userId,[\s\S]*destGroup: destJid,[\s\S]*status: 'success'[\s\S]*status: \{ in: \['queued', 'sending'\] \}/,
    'dedup DB deve bloquear envios recentes já enviados E os ainda pendentes para mesmo usuário e destino',
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

test('bot-worker reserva chave de dedup de forma atômica antes de enfileirar envio', () => {
  assert.match(
    botWorkerSource,
    /db\.sendDedupKey\.create\(\{[\s\S]*data: \{ userId, destGroup: destJid, dedupKey: key, expiresAt: reservationExpiresAt \}/,
    'reserva precisa ser um create protegido por índice único antes do MessageLog queued',
  )
  assert.match(
    botWorkerSource,
    /err\?\.code === 'P2002'[\s\S]*reservedDuplicate = true/,
    'colisão de índice único deve virar bloqueio de duplicata',
  )
  assert.match(
    botWorkerSource,
    /Duplicata reservada DB ignorada/,
    'bloqueio por reserva precisa deixar evidência no log',
  )
  assert.match(
    botWorkerSource,
    /db\.sendDedupKey\.updateMany\(\{[\s\S]*messageLogId: log\.id/,
    'reservas devem ser vinculadas ao MessageLog criado',
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
