import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DESTINATION_SPACING_REASON } from '../src/core/destinationSpacing.js'

// bot-worker.js roda como processo próprio e não expõe deferReasonMessage
// para import direto (mesmo padrão de bot-worker-relay-branding.test.js e
// bot-worker-retry-cache-wiring.test.js) — este teste extrai e AVALIA a
// função lendo o source, para testar o comportamento de verdade em vez de só
// grepar a presença da string.

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

function extractDeferReasonMessage() {
  const start = botWorkerSource.indexOf('function deferReasonMessage(reason) {')
  assert.notEqual(start, -1, 'deferReasonMessage não encontrada em bot-worker.js')
  // Fecha no primeiro `\n}` no nível de indentação da função (2 espaços).
  const end = botWorkerSource.indexOf('\n}', start)
  const src = botWorkerSource.slice(start, end + 2)
  // DESTINATION_SPACING_REASON é importado no topo do arquivo real; aqui a
  // função é extraída isolada, então a constante precisa ser injetada com o
  // MESMO valor do módulo de verdade (não um literal solto duplicado).
  // eslint-disable-next-line no-new-func
  const factory = new Function('DESTINATION_SPACING_REASON', `${src}\nreturn deferReasonMessage;`)
  return factory(DESTINATION_SPACING_REASON)
}

test('motivo "destination_spacing" devolve o texto leigo esperado, sem jargão', () => {
  const deferReasonMessage = extractDeferReasonMessage()
  const msg = deferReasonMessage('destination_spacing')
  assert.match(msg, /[Ii]ntervalo entre destinos/, 'precisa citar "intervalo entre destinos", o nome que a tela usa')
  assert.match(msg, /Anti-banimento/, 'precisa citar onde a cliente configura ("Anti-banimento")')
  for (const jargon of ['jitter', 'stagger', 'atraso entre canais']) {
    assert.doesNotMatch(msg.toLowerCase(), new RegExp(jargon), `motivo não pode conter o termo técnico "${jargon}"`)
  }
})

test('motivo "burst_cap" não existe mais (gate de rajada removido em 2026-09-25) — cai no genérico sem jargão', () => {
  const deferReasonMessage = extractDeferReasonMessage()
  const msg = deferReasonMessage('burst_cap')
  assert.doesNotMatch(msg.toLowerCase(), /throttle/)
  assert.doesNotMatch(msg, /Preserva[çc][ãa]o por destino/i)
  assert.doesNotMatch(msg, /M[áa]ximo de envios na janela/i)
})

for (const [reason, esperado] of [
  ['daily_cap', /limite di[áa]rio/i],
  ['min_interval', /intervalo m[íi]nimo/i],
  ['outside_operating_hours', /hor[áa]rio de envio/i],
  ['quiet_hours', /hor[áa]rio de envio/i],
  ['health_paused', /pausou/i],
]) {
  test(`motivo "${reason}" tem texto leigo próprio (não cai no genérico com jargão)`, () => {
    const deferReasonMessage = extractDeferReasonMessage()
    const msg = deferReasonMessage(reason)
    assert.match(msg, esperado)
    assert.doesNotMatch(msg.toLowerCase(), /throttle/)
  })
}

test('motivo desconhecido não expõe o código cru nem a palavra "throttle"', () => {
  const deferReasonMessage = extractDeferReasonMessage()
  const msg = deferReasonMessage('algum_motivo_novo_desconhecido')
  assert.doesNotMatch(msg.toLowerCase(), /throttle/)
  assert.doesNotMatch(msg, /algum_motivo_novo_desconhecido/)
})
