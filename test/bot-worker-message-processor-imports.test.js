import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as messageProcessor from '../src/messageProcessor.js'

// Regressão: cupom/voucher que o conversor classifica como `stripFromMessage`
// não pode mais remover nada da caption espelhada. O bot deve preservar o link
// original como passthrough e continuar convertendo os demais links da mesma
// mensagem. O segundo teste abaixo continua garantindo que qualquer função de
// messageProcessor usada pelo bot-worker esteja importada corretamente.


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

test('bot-worker preserva links de cupom/voucher quando a conversão pede strip', () => {
  assert.match(
    botWorkerSource,
    /err\.stripFromMessage[\s\S]*converted:\s*url[\s\S]*passthrough:\s*true/,
    'cupom/voucher não convertido deve ser passthrough, não removido da mensagem',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /urlsToStrip|stripUrlsFromText\s*\(/,
    'bot-worker não deve remover URLs de cupom/voucher da mensagem espelhada',
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
