import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyStartRefusal,
  START_REFUSAL_CAPACITY,
  START_REFUSAL_MISPLACED,
  START_REFUSAL_UNKNOWN,
} from '../src/domain/session/startRefusal.js'
import { classifyBotStartOutcome } from '../src/domain/session/service.js'
import { computeShardIndex } from '../src/supervisor/sharding.js'

// RCA 2026-09-07: as três causas de recusa mostravam a MESMA frase ("estamos no
// limite de robôs"), e uma cliente leu isso com o servidor fora do teto.

test('só afirma teto cheio quando o teto está de fato cheio', () => {
  const cheio = classifyStartRefusal({ userId: 'u1', runningCount: 20, maxSessions: 20 })
  assert.equal(cheio.reason, START_REFUSAL_CAPACITY)
  assert.equal(cheio.code, 'WA_CAPACITY_LIMIT')

  const comVaga = classifyStartRefusal({ userId: 'u1', runningCount: 12, maxSessions: 20 })
  assert.equal(comVaga.reason, START_REFUSAL_UNKNOWN)
  assert.equal(comVaga.code, 'WA_START_REFUSED')
  assert.ok(!comVaga.error.includes('limite'), 'não pode dizer "limite" com vaga sobrando')
})

test('sem medição confiável NÃO afirma teto (fail-safe)', () => {
  // listRunningBots falhou / supervisor mudo: melhor um texto genérico e
  // honesto do que mandar a cliente esperar por uma vaga que já existe.
  const semMedida = classifyStartRefusal({ userId: 'u1', runningCount: null, maxSessions: 20 })
  assert.equal(semMedida.reason, START_REFUSAL_UNKNOWN)
  assert.equal(semMedida.running, null)
})

test('conta apontada para servidor que não a atende tem causa própria', () => {
  // Escolhe um índice que NÃO é o do usuário, com 2 servidores configurados.
  const meu = computeShardIndex('u1', 2)
  const outro = meu === 0 ? 1 : 0
  const fora = classifyStartRefusal({ userId: 'u1', shardCount: 2, shardIndex: outro, runningCount: 0, maxSessions: 20 })
  assert.equal(fora.reason, START_REFUSAL_MISPLACED)
  assert.equal(fora.code, 'WA_SESSION_MISPLACED')

  // Servidor errado ganha do teto: com o servidor lotado E a conta fora dele,
  // o motivo que resolve é o segundo.
  const foraELotado = classifyStartRefusal({ userId: 'u1', shardCount: 2, shardIndex: outro, runningCount: 99, maxSessions: 20 })
  assert.equal(foraELotado.reason, START_REFUSAL_MISPLACED)

  // Configuração canônica (1 servidor) nunca acusa conta fora do lugar.
  const dentro = classifyStartRefusal({ userId: 'u1', shardCount: 1, shardIndex: 0, runningCount: 3, maxSessions: 20 })
  assert.equal(dentro.reason, START_REFUSAL_UNKNOWN)
})

test('nenhum dos textos usa jargão técnico', () => {
  const textos = [
    classifyStartRefusal({ userId: 'u1', runningCount: 20, maxSessions: 20 }).error,
    classifyStartRefusal({ userId: 'u1', shardCount: 2, shardIndex: (computeShardIndex('u1', 2) + 1) % 2 }).error,
    classifyStartRefusal({ userId: 'u1' }).error,
  ]
  for (const texto of textos) {
    for (const jargao of ['worker', 'supervisor', 'circuit', 'shard', 'fork', 'socket', 'redis', 'processo', 'Bot não está conectado']) {
      assert.ok(!texto.toLowerCase().includes(jargao.toLowerCase()), `jargão "${jargao}" chegou à tela: ${texto}`)
    }
  }
})

test('conta no servidor errado não manda tentar de novo', () => {
  // Repetir a tentativa não resolve — foi o que a cliente fez sete vezes.
  const fora = classifyStartRefusal({ userId: 'u1', shardCount: 2, shardIndex: (computeShardIndex('u1', 2) + 1) % 2 })
  assert.ok(!/tente de novo/i.test(fora.error))
  const outcome = classifyBotStartOutcome({ startAccepted: false, running: false, refusal: fora })
  assert.equal(outcome.retryable, false)
  assert.equal(outcome.code, 'WA_SESSION_MISPLACED')
  assert.equal(outcome.statusCode, 503)
})

test('a resposta da rota carrega o motivo classificado', () => {
  const cheio = classifyStartRefusal({ userId: 'u1', runningCount: 20, maxSessions: 20 })
  const outcome = classifyBotStartOutcome({ startAccepted: false, running: false, refusal: cheio })
  assert.equal(outcome.code, 'WA_CAPACITY_LIMIT')
  assert.equal(outcome.reason, START_REFUSAL_CAPACITY)
  assert.equal(outcome.retryable, true)

  // Sem contexto, o texto histórico é preservado (compatibilidade).
  const semContexto = classifyBotStartOutcome({ startAccepted: false, running: false })
  assert.equal(semContexto.code, 'WA_CAPACITY_LIMIT')
})
