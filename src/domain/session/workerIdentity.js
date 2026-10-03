// Qual login (número) cada processo de robô usa — vários números por conta,
// Fase 1 (docs/rca/multi-numero.md).
//
// Dois processos por conta, no máximo:
//   - processo ATIVO, chave = userId (a mesma de sempre): envia, escuta as
//     origens, recebe os comandos da API. Usa o login do número ativo
//     (`User.activeWaSlot`). Como a chave não muda, filas, comandos, Redis e
//     telas continuam funcionando sem saber que existe reserva.
//   - processo de PRONTIDÃO, chave = <userId>~n2: só mantém o OUTRO número
//     conectado. Não escuta grupos, não envia.
// Trocar o número ativo = parar os dois, mudar `activeWaSlot`, ligar os dois.
// Nunca dois processos no mesmo login: cada um usa um slot diferente.
import { buildSessionKey, parseSessionKey, PRIMARY_SLOT, MAX_SLOT } from './sessionKey.js'

export const STANDBY_PROCESS_SLOT = 2

export function otherSlot(slot) {
  return slot === PRIMARY_SLOT ? 2 : PRIMARY_SLOT
}

export function standbyProcessKey(userId) {
  return buildSessionKey(userId, STANDBY_PROCESS_SLOT)
}

function validActiveSlot(activeWaSlot) {
  return Number.isInteger(activeWaSlot) && activeWaSlot >= PRIMARY_SLOT && activeWaSlot <= MAX_SLOT ? activeWaSlot : null
}

// Puro. Devolve null quando o processo não deve existir (chave malformada, ou
// prontidão com a flag desligada).
export function resolveWorkerIdentity({ processKey, activeWaSlot, enabled = false } = {}) {
  const parsed = parseSessionKey(processKey)
  if (!parsed) return null
  const active = enabled ? (validActiveSlot(activeWaSlot) ?? PRIMARY_SLOT) : PRIMARY_SLOT
  if (parsed.slot === PRIMARY_SLOT) {
    return { userId: parsed.userId, processKey, role: 'active', authSlot: active, authKey: buildSessionKey(parsed.userId, active) }
  }
  if (!enabled || parsed.slot !== STANDBY_PROCESS_SLOT) return null
  const authSlot = otherSlot(active)
  return { userId: parsed.userId, processKey, role: 'standby', authSlot, authKey: buildSessionKey(parsed.userId, authSlot) }
}
