import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as messageProcessor from '../src/messageProcessor.js'

// Regressão: `stripUrlsFromText` era usado em src/bot-worker.js (caminho de
// remoção de link de cupom) mas NÃO estava na lista de imports de
// './messageProcessor.js'. Em runtime isso lançava
// `ReferenceError: stripUrlsFromText is not defined`, que o pipeline capturava
// como `skip:incoming_error` e DESCARTAVA a mensagem inteira. Efeito visível:
// grupos cujas ofertas trazem um link de cupom separado (ex.: "RESGATE OS
// CUPONS ATIVOS" da Shopee) paravam de espelhar enquanto os demais seguiam
// normais. Este guard pega qualquer função do messageProcessor que seja
// chamada no bot-worker sem estar importada — não só esse caso.

const botWorkerSource = readFileSync(
  fileURLToPath(new URL('../src/bot-worker.js', import.meta.url)),
  'utf8',
)

function importedNamesFromMessageProcessor(source) {
  const match = source.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/messageProcessor\.js['"]/)
  if (!match) return new Set()
  return new Set(
    match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean),
  )
}

test('bot-worker importa stripUrlsFromText do messageProcessor (regressão incoming_error)', () => {
  const imported = importedNamesFromMessageProcessor(botWorkerSource)
  assert.ok(
    /\bstripUrlsFromText\s*\(/.test(botWorkerSource),
    'pré-condição do teste: bot-worker.js deve chamar stripUrlsFromText',
  )
  assert.ok(
    imported.has('stripUrlsFromText'),
    'bot-worker.js chama stripUrlsFromText mas não a importa de ./messageProcessor.js',
  )
})

test('toda função do messageProcessor chamada no bot-worker está importada', () => {
  const imported = importedNamesFromMessageProcessor(botWorkerSource)
  const exportedFns = Object.entries(messageProcessor)
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)

  const usedButNotImported = exportedFns.filter(
    (name) => new RegExp(`\\b${name}\\s*\\(`).test(botWorkerSource) && !imported.has(name),
  )

  assert.deepEqual(
    usedButNotImported,
    [],
    `Funções do messageProcessor usadas sem import no bot-worker: ${usedButNotImported.join(', ')}`,
  )
})
