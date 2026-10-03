/**
 * Guarda de boot do supervisor com roteamento por nó (revisão C3/C4).
 * PURO: recebe o que foi lido e decide se este processo pode virar o nó.
 *
 * Bloqueia (o supervisor fica em ESPERA: não liga robô nem consome fila) quando:
 *  - C4: nó ≠ n1 com banco SQLite local (`file:`) — o 2º servidor não enxerga
 *    as contas do 1º; ligaria robôs com outra "verdade".
 *  - C3: outra MÁQUINA já é este nó (identidade viva no Redis com outro host) —
 *    dois servidores com o mesmo SUPERVISOR_NODE_ID religam as MESMAS contas.
 *
 * Mesma máquina (reinício do pm2, pid novo) não é colisão: a identidade é o
 * host, não o processo. Espera em vez de sair: sair faria o pm2 reiniciar em
 * loop; e não há "autodesbloqueio": se a outra máquina só perdeu o Redis, os
 * robôs dela continuam vivos — ligar aqui duplicaria. Só um reinício manual
 * (depois de resolver) tira da espera.
 */

import { DEFAULT_NODE_ID } from './protocol.js'

export function buildNodeIdentity({ hostname, machineId = '' } = {}) {
  return `${String(hostname || 'desconhecido')}|${String(machineId || '').trim().slice(0, 32)}`
}

export function decideNodeBoot({ nodeId, databaseUrl, ownIdentity, existingIdentity } = {}) {
  if (nodeId !== DEFAULT_NODE_ID && String(databaseUrl ?? '').trim().startsWith('file:')) {
    return {
      ok: false,
      reason: 'sqlite_local',
      message: `Servidor "${nodeId}" com banco SQLite local: ele não enxergaria as mesmas contas do n1. Migre para um banco compartilhado antes de ligar este servidor.`,
    }
  }
  if (existingIdentity && ownIdentity && existingIdentity !== ownIdentity) {
    return {
      ok: false,
      reason: 'node_id_in_use',
      message: `Outro servidor (${existingIdentity}) já está rodando como "${nodeId}". Dois servidores com o mesmo nome religariam as mesmas contas. Dê um SUPERVISOR_NODE_ID único a este servidor e reinicie.`,
    }
  }
  return { ok: true, reason: 'ok', message: null }
}
