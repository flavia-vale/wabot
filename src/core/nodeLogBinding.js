import { hostname } from 'os'
import { isNodeRoutingEnabled, resolveSupervisorNodeId } from '../supervisor/nodeRouting.js'

/**
 * `base` do pino com o nome do servidor (nodeId), só com SUPERVISOR_NODE_ROUTING
 * ligado E SUPERVISOR_NODE_ID definido. Como os bot-workers herdam o env do
 * supervisor, TODA linha de log (supervisor e robôs) passa a dizer de qual
 * servidor veio — sem isso, com dois servidores, o log não diz onde olhar.
 * Desligado devolve `null`: o logger fica exatamente como hoje.
 */
export function resolveNodeLogBase(env = process.env, { pid = process.pid, host = hostname() } = {}) {
  if (!isNodeRoutingEnabled(env)) return null
  if (env.SUPERVISOR_NODE_ID === undefined || env.SUPERVISOR_NODE_ID === '') return null
  try {
    return { pid, hostname: host, nodeId: resolveSupervisorNodeId(env) }
  } catch {
    return null // id inválido: o supervisor aborta no boot; o logger não lança
  }
}
