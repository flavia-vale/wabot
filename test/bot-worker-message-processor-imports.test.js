import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as messageProcessor from '../src/messageProcessor.js'

// RCA 2026-09-23: link que o conversor classifica como `stripFromMessage` NÃO
// pode sair como veio (é o link do concorrente). A mensagem inteira deixa de
// ser publicada — ver src/core/mirrorLinkGuard.js. O segundo teste abaixo
// continua garantindo que qualquer função de messageProcessor usada pelo
// bot-worker esteja importada corretamente.


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

test('bot-worker nunca publica o link original quando a conversão pede strip', () => {
  assert.doesNotMatch(
    botWorkerSource,
    /converted:\s*url[\s,]/,
    'link não convertido não pode voltar como "convertido" com o endereço de origem',
  )
  assert.doesNotMatch(botWorkerSource, /passthrough:\s*true/)
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
