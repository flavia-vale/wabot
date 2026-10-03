import { multiNumberEnabled } from '../domain/session/multiNumberFlag.js'
import { parseSessionKey } from '../domain/session/sessionKey.js'
import { resolveWorkerIdentity } from '../domain/session/workerIdentity.js'

// Lê `activeWaSlot` do banco e decide o login do processo. Flag desligada:
// nem consulta o banco (comportamento idêntico ao de antes). Flag ligada e
// banco fora: LANÇA — chutar o número poderia pôr dois processos no mesmo
// login (440 em loop); melhor o worker sair e o supervisor tentar de novo.
export async function loadWorkerIdentity(processKey, { db, env = process.env } = {}) {
  const enabled = multiNumberEnabled(env)
  const parsed = parseSessionKey(processKey)
  if (!parsed) throw new Error(`Chave de sessão inválida: ${JSON.stringify(processKey)}`)
  let activeWaSlot = null
  if (enabled) {
    const user = await db.user.findUnique({ where: { id: parsed.userId }, select: { activeWaSlot: true } })
    if (!user) throw new Error('Conta não encontrada para a chave de sessão')
    activeWaSlot = user.activeWaSlot
  }
  const identity = resolveWorkerIdentity({ processKey, activeWaSlot, enabled })
  if (!identity) throw new Error(`Processo não permitido para a chave ${processKey} (vários números desligado?)`)
  return identity
}
