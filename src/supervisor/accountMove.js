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
import { buildSessionKey } from '../domain/session/sessionKey.js'
import { standbyProcessKey, STANDBY_PROCESS_SLOT } from '../domain/session/workerIdentity.js'
import { shouldResurrectSession } from '../core/sessionResurrectionPolicy.js'

/**
 * @param {Object} m
 * @param {string} m.userId
 * @param {string} m.targetNode
 * @param {{nodeId?:string|null, status?:string, lifecycle?:string}|null} m.sessionRow
 * @param {Array<{nodeId:string, alive:boolean, running:number|null, max:number|null}>} m.nodes
 * @returns {{ok:boolean, sourceNode:string, errors:string[], warnings:string[]}}
 */
export const MOVING_NODE_LIFECYCLE = 'moving_node'

export function planAccountMove({ userId, targetNode, sessionRow, nodes = [], resuming = false, slots = 1 } = {}) {
  const errors = []
  const warnings = []
  const sourceNode = resolveSessionNodeId(sessionRow)

  if (!userId) errors.push('Conta não informada.')
  if (!sessionRow) errors.push('Esta conta não tem sessão de WhatsApp registrada: não há nada para mover (conta nova é colocada sozinha).')
  if (!isValidNodeId(targetNode)) errors.push('O servidor de destino é inválido (use letras minúsculas, números e hífen).')
  // Retomada (C6): o "trocar" pode ter gravado o destino e caído antes de
  // religar. Com a conta ainda marcada `moving_node`, rodar de novo continua.
  const retomando = resuming && sessionRow?.lifecycle === MOVING_NODE_LIFECYCLE
  if (isValidNodeId(targetNode) && targetNode === sourceNode && !retomando) errors.push(`A conta já está no servidor "${sourceNode}".`)

  const source = nodes.find(n => n.nodeId === sourceNode)
  const target = nodes.find(n => n.nodeId === targetNode)
  if (isValidNodeId(targetNode) && !target) errors.push(`O servidor de destino "${targetNode}" não está na lista de servidores conhecidos.`)
  if (target && !target.alive) errors.push(`O servidor de destino "${targetNode}" não está respondendo agora.`)
  if (target?.alive) {
    const cap = Number(target.max)
    const running = target.running
    if (!(cap >= 1)) errors.push(`O servidor de destino "${targetNode}" não informou quantas vagas tem; não dá para garantir que cabe.`)
    else if (running === null || running === undefined) errors.push(`Não consegui medir quantos robôs o servidor "${targetNode}" já tem.`)
    // Revisão V3: cada número é um robô — conta com reserva ligada ocupa 2 vagas.
    else if (running >= cap) errors.push(`O servidor de destino "${targetNode}" está lotado (${running}/${cap}).`)
    else if (running + Math.max(1, slots) > cap) errors.push(`O servidor de destino "${targetNode}" não tem ${Math.max(1, slots)} vaga(s) livre(s) (${running}/${cap}).`)
  }
  if (!source?.alive && !retomando) warnings.push(`O servidor de origem "${sourceNode}" não está respondendo: não dá para parar o robô por ele. Só continue se tiver certeza de que o robô NÃO está ligado em lugar nenhum.`)

  const connecting = ['connecting', 'qr', 'pairing'].includes(String(sessionRow?.lifecycle)) || sessionRow?.status === 'connecting'
  if (connecting) errors.push('A cliente está no meio do pareamento (QR/código). Espere terminar antes de mover.')
  if (sessionRow?.lifecycle === 'switching') errors.push('A conta está trocando de número (reserva) agora. Espere terminar antes de mover.')

  return { ok: errors.length === 0, sourceNode, errors, warnings }
}

/** Comando de cópia do login, para rodar NO SERVIDOR DE DESTINO (puxa da origem). */
export function buildRsyncCommand({ authDir, sourceHost }) {
  if (!authDir) throw new Error('buildRsyncCommand: authDir obrigatório')
  const dir = String(authDir).replace(/\/+$/, '')
  const origem = sourceHost ? `${sourceHost}:${dir}/` : `<usuario@servidor-de-origem>:${dir}/`
  // --delete (revisão C6): sem ele, arquivos de um login ANTIGO desta conta no
  // destino (de uma mudança anterior) sobravam misturados ao novo — chaves velhas
  // = mensagens que não abrem ("Bad MAC"/"Aguardando mensagem").
  return `rsync -a --checksum --delete ${origem} ${dir}/`
}

// ---- Revisão V1: conta com número reserva (docs/rca/multi-numero.md) ----
// Os dois processos da conta (ativo = <conta>, prontidão = <conta>~n2) moram no
// MESMO servidor e mudam JUNTOS. Os dois logins ficam no disco: o processo ativo
// usa o do número ativo (`activeWaSlot`), a prontidão o outro — por isso as duas
// pastas (<conta> e <conta>~n2) são copiadas, seja qual for o número ativo.

/** A prontidão vai junto? Ligada agora, ou parada esperando religar (ou já marcada numa retomada). */
export function shouldCarryStandby({ extraRow = null, running = false } = {}) {
  if (!extraRow) return Boolean(running)
  if (running || extraRow.lifecycle === MOVING_NODE_LIFECYCLE) return true
  return shouldResurrectSession({ status: extraRow.status, lifecycle: extraRow.lifecycle })
}

/** Processos a parar/conferir/religar, na ordem de religar (ativo primeiro). */
export function accountProcessKeys({ userId, carryStandby = false } = {}) {
  return carryStandby ? [userId, standbyProcessKey(userId)] : [userId]
}

/** Pastas de login a copiar: a do número 1 sempre; a do número 2 se a conta tem linha de reserva. */
export function accountAuthKeys({ userId, hasStandbyLogin = false } = {}) {
  return hasStandbyLogin ? [buildSessionKey(userId), buildSessionKey(userId, STANDBY_PROCESS_SLOT)] : [buildSessionKey(userId)]
}
