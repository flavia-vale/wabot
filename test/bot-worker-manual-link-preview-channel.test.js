import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA 2026-07 ("imagem preta em canal" no imageMode='preview'): buildManualLinkPreview
// subia o thumbnail HQ via prepareWAMessageMedia sem passar `jid`. O Baileys só troca
// para upload raw/plaintext (isJidNewsletter(options.jid)) quando `jid` é o destino —
// sem ele, o thumbnail HQ sempre subia criptografado, e canal (@newsletter) não decifra
// mídia: o card caía pro jpegThumbnail pequeno embutido (borrado/esticado na web) ou nem
// isso (branco no celular). Teste estrutural porque bot-worker.js roda como processo
// próprio e não expõe essas funções para import direto (mesmo padrão de
// bot-worker-retry-cache-wiring.test.js).
test('buildManualLinkPreview aceita destJid e repassa como jid pro upload da thumbnail HQ', () => {
  const fnStart = botWorkerSource.indexOf('async function buildManualLinkPreview(')
  assert.notEqual(fnStart, -1, 'buildManualLinkPreview não encontrada')

  const signatureEnd = botWorkerSource.indexOf(')', fnStart)
  const signature = botWorkerSource.slice(fnStart, signatureEnd)
  assert.match(signature, /\bdestJid\b/, 'assinatura de buildManualLinkPreview precisa aceitar destJid')

  const prepareCallStart = botWorkerSource.indexOf('await prepareWAMessageMedia(', fnStart)
  assert.notEqual(prepareCallStart, -1, 'chamada a prepareWAMessageMedia dentro de buildManualLinkPreview não encontrada')
  const prepareCallEnd = botWorkerSource.indexOf(')', prepareCallStart + 'await prepareWAMessageMedia('.length)
  const prepareCallBlock = botWorkerSource.slice(prepareCallStart, prepareCallEnd)

  assert.match(
    prepareCallBlock,
    /mediaTypeOverride:\s*'thumbnail-link'/,
    'chamada precisa continuar usando mediaTypeOverride thumbnail-link',
  )
  assert.match(
    prepareCallBlock,
    /jid:\s*destJid/,
    'sem jid:destJid, o Baileys nunca detecta canal e sempre sobe a thumbnail HQ criptografada',
  )
})

test('imageMode preview repassa destJid pro buildManualLinkPreview no call site', () => {
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview')")
  assert.notEqual(callSiteStart, -1, "bloco imageMode === 'preview' não encontrado")

  const callStart = botWorkerSource.indexOf('await buildManualLinkPreview({', callSiteStart)
  assert.notEqual(callStart, -1, 'chamada a buildManualLinkPreview não encontrada no bloco preview')
  const callEnd = botWorkerSource.indexOf('})', callStart)
  const callBlock = botWorkerSource.slice(callStart, callEnd)

  assert.match(
    callBlock,
    /destJid/,
    'call site precisa passar destJid pro buildManualLinkPreview saber o destino real do envio',
  )
})
