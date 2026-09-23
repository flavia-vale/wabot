import test from 'node:test'
import assert from 'node:assert/strict'
import { PROTOCOL_VERSION, COMMAND } from '../src/supervisor/protocol.js'

// Feature 017 (arquitetura multicanal de entrega), R2/FR-036 do plano:
// src/supervisor/protocol.js é [PROTECTED_CORE] e NÃO é tocado por esta
// feature. O Telegram nunca precisa do worker (destino sai pela caixa de
// saída; origem→WhatsApp usa sendBroadcast, comando que já existe) — por
// isso R2 é atendido por não existirem duas pontas para divergirem.
//
// Este teste trava o snapshot do commit-base da feature: nenhum comando novo
// entrou em COMMAND e PROTOCOL_VERSION continua 1. Se algum dia um comando
// novo for de fato necessário, isso precisa ser uma decisão explícita — não
// um efeito colateral silencioso de alguma fatia desta feature.

// Snapshot do commit-base (specs/017-multicanal-telegram-instagram).
// Não adicionar entrada aqui sem antes confirmar, em AGENTS.md e no plano,
// que o bump de PROTOCOL_VERSION foi deliberado e as duas pontas (API e
// bot-supervisor) sobem juntas.
const BASELINE_COMMANDS = Object.freeze([
  'startBot',
  'stopBot',
  'isRunning',
  'listRunningBots',
  'listGroups',
  'sendBroadcast',
  'requestPairingCode',
  'getBotMetrics',
  'reloadConfig',
  'refreshWaGroups',
  'channel:metadata',
  'channel:follow',
  'channel:listFollowed',
  'getLastQR',
  'shard:moveSession',
  'shard:rollbackSession',
  'shard:metrics',
])

test('PROTOCOL_VERSION continua 1 (nenhuma mudança quebra o contrato API<->supervisor)', () => {
  assert.equal(PROTOCOL_VERSION, 1)
})

test('nenhum comando novo entrou em COMMAND desde o commit-base desta feature', () => {
  const current = Object.values(COMMAND).sort()
  const baseline = [...BASELINE_COMMANDS].sort()
  assert.deepEqual(current, baseline, 'src/supervisor/protocol.js ganhou (ou perdeu) um comando — protocol.js é [PROTECTED_CORE] e não deveria mudar nesta feature')
})
