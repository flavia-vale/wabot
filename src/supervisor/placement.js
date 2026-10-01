/**
 * Escolha de nó para sessões novas (SUPERVISOR_NODE_ROUTING). Funções puras:
 * recebem números medidos, não medem nada.
 */

import { DEFAULT_NODE_ID, isValidNodeId } from './protocol.js'

/** Sessão sem `nodeId` (criada antes do roteamento) pertence ao nó 'n1'. */
export function resolveSessionNodeId(row) {
  const id = row?.nodeId
  return isValidNodeId(id) ? id : DEFAULT_NODE_ID
}

function freeSlots(node) {
  const running = Number(node?.running)
  const max = Number(node?.max)
  if (node?.running === null || node?.running === undefined) return null
  if (!Number.isFinite(running) || !Number.isFinite(max) || running < 0 || max < 1) return null
  return max - running
}

/**
 * Nó vivo com mais vagas livres. Empate: menor nodeId (determinístico).
 * Nó morto, sem medição (running null) ou lotado nunca é escolhido — sem
 * medição NÃO se presume vaga. Sem candidato devolve null (nada de chute).
 *
 * @param {{nodes: Array<{nodeId:string, alive:boolean, running:number|null, max:number}>}} args
 * @returns {string|null}
 */
export function pickNodeForNewSession({ nodes = [] } = {}) {
  let best = null
  for (const node of nodes) {
    if (!node?.alive || !isValidNodeId(node.nodeId)) continue
    const free = freeSlots(node)
    if (free === null || free <= 0) continue
    if (!best || free > best.free || (free === best.free && node.nodeId < best.nodeId)) {
      best = { nodeId: node.nodeId, free }
    }
  }
  return best?.nodeId ?? null
}

/**
 * Só vale escolher nó para sessão que NUNCA existiu ou que nunca pareou e está
 * parada. Linha com `nodeId` nulo e número já pareado é conta ANTIGA: o
 * `auth_info` dela mora no disco do 'n1' (nulo = 'n1', sempre). Mandá-la ao n2
 * pediria QR novo e deixaria um aparelho vinculado a mais no WhatsApp.
 */
export function shouldPlaceSession(row) {
  if (!row) return true
  if (isValidNodeId(row.nodeId)) return false
  const neverPaired = !row.phone
  const idle = row.status === 'disconnected' && row.lifecycle === 'idle'
  return neverPaired && idle
}

/**
 * Interseção entre as listas de robôs por nó: o mesmo userId rodando em dois
 * nós é split-brain (dois sockets na mesma credencial). Devolve
 * `[{ userId, nodes: ['n1','n2'] }]`. Entradas null (nó sem medição) são ignoradas.
 */
export function findDualOwners(listsByNode = {}) {
  const seen = new Map()
  for (const [nodeId, list] of Object.entries(listsByNode)) {
    if (!Array.isArray(list)) continue
    for (const userId of new Set(list)) {
      if (!seen.has(userId)) seen.set(userId, [])
      seen.get(userId).push(nodeId)
    }
  }
  return [...seen.entries()]
    .filter(([, nodes]) => nodes.length > 1)
    .map(([userId, nodes]) => ({ userId, nodes: nodes.sort() }))
}
