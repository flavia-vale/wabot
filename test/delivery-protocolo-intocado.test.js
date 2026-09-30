import test from 'node:test'
import assert from 'node:assert/strict'
import { PROTOCOL_VERSION, COMMAND } from '../src/supervisor/protocol.js'

// Feature 017 (arquitetura multicanal de entrega), R2/FR-036 do plano:
// src/supervisor/protocol.js é [PROTECTED_CORE] e NÃO é tocado por esta
// feature. O Telegram nunca precisa do worker (destino sai pela caixa de
// saída; origem→WhatsApp usa sendBroadcast, comando que já existe) — por
// isso R2 é atendido por não existirem duas pontas para divergirem.
//
// O que esta feature precisa garantir é que ELA não criou comando nenhum —
// não que o protocolo nunca mais ganhe comando. A primeira versão deste teste
// congelava a lista INTEIRA de COMMAND e quebrou no primeiro comando aditivo
// legítimo de outra feature (`sendSelfMessage`, admin > Contato com cliente,
// 2026-09-24), sem nenhuma relação com o multicanal. Um guarda que acusa
// trabalho alheio treina a pessoa a ignorá-lo; por isso ele mede a regra
// desta feature, e não a lista inteira.
//
// Se algum dia esta feature precisar de fato de um comando novo, isso tem que
// ser decisão explícita (plano + AGENTS.md), nunca efeito colateral de fatia.

// Termos que denunciariam um comando nascido do multicanal. Cobre o nome da
// chave e o valor, porque um pode ser renomeado sem o outro.
const MULTI_NETWORK_COMMAND_RE = /telegram|instagram|delivery|outbox|inbox|network|multicanal|multi_network/i

test('PROTOCOL_VERSION continua 1 (nenhuma mudança quebra o contrato API<->supervisor)', () => {
  assert.equal(PROTOCOL_VERSION, 1)
})

test('o multicanal não criou comando no protocolo do supervisor', () => {
  const offenders = Object.entries(COMMAND)
    .filter(([key, value]) => MULTI_NETWORK_COMMAND_RE.test(key) || MULTI_NETWORK_COMMAND_RE.test(String(value)))
    .map(([key]) => key)
  assert.deepEqual(offenders, [], 'src/supervisor/protocol.js ganhou comando do multicanal — protocol.js é [PROTECTED_CORE] e esta feature não deveria precisar dele')
})

test('o comando que a origem do Telegram usa para chegar ao WhatsApp continua existindo', () => {
  // Origem Telegram -> destino WhatsApp sai pelo sendBroadcast que já existe
  // (plano, D-A3). Se ele sumir, essa rota passaria a exigir comando novo.
  assert.equal(COMMAND.SEND_BROADCAST, 'sendBroadcast')
})
