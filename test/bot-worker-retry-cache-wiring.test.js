import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA 2026-07 (AGENTS.md, "Loop de retry-receipt travado derrubando sessão a
// cada ~50min"): se msgRetryCounterCache/placeholderResendCache forem criadas
// dentro de startBotInner() (ou de qualquer função que rode a cada
// reconexão) em vez de escopo de módulo, o contador de tentativas do Baileys
// nunca sobrevive à próxima reconexão e uma mensagem travada nunca é
// esquecida — reintroduzindo o loop infinito que derrubava a sessão da
// cliente a cada ~50min por dias. Este teste é estrutural (grep de source)
// porque bot-worker.js roda como processo próprio e não expõe essa lógica
// para import direto — mesmo padrão de bot-worker-relay-branding.test.js.
test('msgRetryCounterCache é declarada em escopo de módulo (fora de startBotInner)', () => {
  const declIndex = botWorkerSource.indexOf('const msgRetryCounterCache = new NodeCache(')
  const startBotInnerIndex = botWorkerSource.indexOf('async function startBotInner()')
  assert.notEqual(declIndex, -1, 'declaração de msgRetryCounterCache não encontrada')
  assert.notEqual(startBotInnerIndex, -1, 'startBotInner não encontrada')
  assert.ok(
    declIndex < startBotInnerIndex,
    'msgRetryCounterCache precisa ser declarada ANTES/FORA de startBotInner (escopo de módulo), senão é recriada a cada reconexão',
  )
})

test('placeholderResendCache é declarada em escopo de módulo (fora de startBotInner)', () => {
  const declIndex = botWorkerSource.indexOf('const placeholderResendCache = new NodeCache(')
  const startBotInnerIndex = botWorkerSource.indexOf('async function startBotInner()')
  assert.notEqual(declIndex, -1, 'declaração de placeholderResendCache não encontrada')
  assert.notEqual(startBotInnerIndex, -1, 'startBotInner não encontrada')
  assert.ok(
    declIndex < startBotInnerIndex,
    'placeholderResendCache precisa ser declarada ANTES/FORA de startBotInner (escopo de módulo), senão é recriada a cada reconexão',
  )
})

test('makeWASocket recebe msgRetryCounterCache e placeholderResendCache explicitamente', () => {
  const makeWASocketCallStart = botWorkerSource.indexOf('const sock = makeWASocket({')
  assert.notEqual(makeWASocketCallStart, -1, 'chamada a makeWASocket não encontrada')
  const makeWASocketCallEnd = botWorkerSource.indexOf('\n  })', makeWASocketCallStart)
  const configBlock = botWorkerSource.slice(makeWASocketCallStart, makeWASocketCallEnd)

  assert.match(configBlock, /\bmsgRetryCounterCache\b/, 'makeWASocket precisa receber msgRetryCounterCache na config')
  assert.match(configBlock, /\bplaceholderResendCache\b/, 'makeWASocket precisa receber placeholderResendCache na config')
})
