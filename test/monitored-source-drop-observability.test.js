import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// RCA 2026-08-29 (staging): a cliente mandou oferta num grupo MONITORADO e não
// apareceu absolutamente nada — nem em Envios, nem no bot.log. Depois de a
// origem ser reconhecida (`if (!monitorGroup) return`), havia dois `return`
// MUDOS: texto que virou vazio ao remover convites, e mensagem sem link e sem
// texto aproveitável. Do lado de quem usa, isso é idêntico a "o robô morreu", e
// do lado de quem investiga não há por onde começar: foi o que travou o
// diagnóstico por horas.
//
// Mesma lição de "Oferta saindo SEM FOTO: o caminho do card de preview era
// MUDO" (AGENTS.md) — descarte de mensagem de origem monitorada precisa deixar
// rastro. bot-worker.js roda como processo próprio e não exporta essas funções,
// então a guarda é estrutural (mesmo padrão de
// bot-worker-retry-cache-wiring.test.js).

test('os dois descartes silenciosos de origem monitorada agora deixam rastro no log', () => {
  // Âncora no processIncomingMessage (há outro `if (!monitorGroup)` no
  // processSendJob, que é a revalidação de destino no dequeue — outro assunto).
  const start = worker.indexOf('const shouldTrackSkipped = Boolean(monitorGroup)')
  assert.notEqual(start, -1, 'processIncomingMessage não encontrado')
  const trecho = worker.slice(start, start + 9000)

  assert.match(
    trecho,
    /if \(text && !sanitizedText\) \{[\s\S]{0,200}?logMonitoredSourceDrop\(/,
    'texto que vira vazio ao remover convites não pode voltar a ser descarte mudo',
  )
  assert.match(
    trecho,
    /if \(messageKind === 'other' && links\.length === 0 && !hasGenericUrl\) \{[\s\S]{0,1200}?logMonitoredSourceDrop\(/,
    'mensagem sem link e sem texto não pode voltar a ser descarte mudo',
  )
})

test('o descarte registra contentKeys — é o campo que separa decrypt falho de ruído de protocolo', () => {
  // Sem `contentKeys` o log diria só "descartei", que é tão inútil quanto o
  // silêncio: array vazio = não decifrou; protocolMessage/senderKey = ruído
  // esperado; conversation/extendedTextMessage = bug nosso de extração.
  assert.match(worker, /contentKeys: Object\.keys\(innerMessage \|\| msg\.message \|\| \{\}\)/)
  assert.match(worker, /hasMessageContent: Boolean\(msg\.message\)/)
})

test('o log é agregado por origem (uma linha por janela), nunca por mensagem', () => {
  // Rajada de senderKeyDistribution a cada reconexão inundaria um bot.log que
  // já passa de 400MB. Mesma escolha de reviewChatScope: agrega e conta o que
  // foi suprimido, em vez de calar ou inundar.
  assert.match(worker, /const MONITORED_DROP_LOG_INTERVAL_MS = /)
  assert.match(worker, /suppressedSinceLast: entry\.suppressed/)

  const fnStart = worker.indexOf('function logMonitoredSourceDrop(')
  assert.notEqual(fnStart, -1, 'logMonitoredSourceDrop não encontrada')
  const fnEnd = worker.indexOf('\n}\n', fnStart)
  const fn = worker.slice(fnStart, fnEnd)
  assert.match(fn, /now - entry\.lastLoggedAt < MONITORED_DROP_LOG_INTERVAL_MS/)
})

test('o estado do agregador vive em escopo de módulo (sobrevive a reconexão do worker)', () => {
  // Dentro de startBotInner o contador zeraria a cada reconexão e a janela de
  // agregação nunca fecharia — mesma lição do msgRetryCounterCache (RCA
  // 2026-07) e de allowedChatJids.
  const decl = worker.indexOf('const monitoredDropLogState = new Map()')
  const inner = worker.indexOf('async function startBotInner(')
  assert.notEqual(decl, -1, 'monitoredDropLogState não encontrado')
  assert.notEqual(inner, -1, 'startBotInner nao encontrada')
  assert.ok(decl < inner, 'monitoredDropLogState precisa ficar FORA de startBotInner')
})
