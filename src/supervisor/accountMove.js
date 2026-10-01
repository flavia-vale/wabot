/**
 * Mover uma conta de WhatsApp de um nó (servidor) para outro — decisões PURAS.
 * Quem executa (parar, copiar o login, trocar o nó, religar) é
 * `scripts/mover-conta-no.mjs`; aqui só se decide SE pode e COMO.
 *
 * Por que é delicado: o login do WhatsApp (`auth_info`) mora no disco do nó. Dois
 * sockets na mesma credencial derrubam a conta em loop (risco de bloqueio), então
 * a regra é: parar → conferir que parou → copiar → trocar `nodeId` → religar.
 */

import { isValidNodeId } from './protocol.js'
import { resolveSessionNodeId } from './placement.js'

/**
 * @param {Object} m
 * @param {string} m.userId
 * @param {string} m.targetNode
 * @param {{nodeId?:string|null, status?:string, lifecycle?:string}|null} m.sessionRow
 * @param {Array<{nodeId:string, alive:boolean, running:number|null, max:number|null}>} m.nodes
 * @returns {{ok:boolean, sourceNode:string, errors:string[], warnings:string[]}}
 */
export function planAccountMove({ userId, targetNode, sessionRow, nodes = [] } = {}) {
  const errors = []
  const warnings = []
  const sourceNode = resolveSessionNodeId(sessionRow)

  if (!userId) errors.push('Conta não informada.')
  if (!sessionRow) errors.push('Esta conta não tem sessão de WhatsApp registrada: não há nada para mover (conta nova é colocada sozinha).')
  if (!isValidNodeId(targetNode)) errors.push('O servidor de destino é inválido (use letras minúsculas, números e hífen).')
  if (isValidNodeId(targetNode) && targetNode === sourceNode) errors.push(`A conta já está no servidor "${sourceNode}".`)

  const source = nodes.find(n => n.nodeId === sourceNode)
  const target = nodes.find(n => n.nodeId === targetNode)
  if (isValidNodeId(targetNode) && !target) errors.push(`O servidor de destino "${targetNode}" não está na lista de servidores conhecidos.`)
  if (target && !target.alive) errors.push(`O servidor de destino "${targetNode}" não está respondendo agora.`)
  if (target?.alive) {
    const cap = Number(target.max)
    const running = target.running
    if (!(cap >= 1)) errors.push(`O servidor de destino "${targetNode}" não informou quantas vagas tem; não dá para garantir que cabe.`)
    else if (running === null || running === undefined) errors.push(`Não consegui medir quantos robôs o servidor "${targetNode}" já tem.`)
    else if (running >= cap) errors.push(`O servidor de destino "${targetNode}" está lotado (${running}/${cap}).`)
  }
  if (!source?.alive) warnings.push(`O servidor de origem "${sourceNode}" não está respondendo: não dá para parar o robô por ele. Só continue se tiver certeza de que o robô NÃO está ligado em lugar nenhum.`)

  const connecting = ['connecting', 'qr', 'pairing'].includes(String(sessionRow?.lifecycle)) || sessionRow?.status === 'connecting'
  if (connecting) errors.push('A cliente está no meio do pareamento (QR/código). Espere terminar antes de mover.')

  return { ok: errors.length === 0, sourceNode, errors, warnings }
}

/** Comando de cópia do login, para rodar NO SERVIDOR DE DESTINO (puxa da origem). */
export function buildRsyncCommand({ authDir, sourceHost }) {
  if (!authDir) throw new Error('buildRsyncCommand: authDir obrigatório')
  const dir = String(authDir).replace(/\/+$/, '')
  const origem = sourceHost ? `${sourceHost}:${dir}/` : `<usuario@servidor-de-origem>:${dir}/`
  return `rsync -a --checksum ${origem} ${dir}/`
}
