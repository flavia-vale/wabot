/**
 * Pré-checagens da ativação do roteamento por nó (MN-14). PURO: recebe o que
 * foi medido e devolve os veredictos — quem mede (Redis/banco) é o script
 * `scripts/preflight-multi-supervisor.mjs` e o guarda da API.
 *
 * Cada item: { level: 'ok'|'warn'|'fail', code, message }. `message` em
 * linguagem leiga (é o que a operadora lê antes de apertar o botão).
 */

import { DEFAULT_NODE_ID, isValidNodeId } from './protocol.js'

/** Tokens de SUPERVISOR_NODE_IDS que `resolveKnownNodeIds` descartaria em silêncio. */
export function findInvalidNodeIdTokens(raw) {
  return String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean).filter(id => !isValidNodeId(id))
}

/**
 * @param {Object} m
 * @param {'supervisor'|'api'|'segundo-no'} m.step  qual passo do runbook vai ser executado
 * @param {string} [m.nodeId]              SUPERVISOR_NODE_ID deste processo
 * @param {string|undefined} m.nodeIdsRaw   SUPERVISOR_NODE_IDS cru
 * @param {string[]} m.knownNodeIds         nós conhecidos (já normalizados)
 * @param {Record<string, boolean>} m.heartbeats     nodeId -> tem heartbeat?
 * @param {Record<string, number|null>} m.capacities nodeId -> teto publicado
 * @param {number|null} m.legacyBacklog     jobs esperando na fila legada (null = não medido)
 * @param {number|null} m.nullNodeIdCount   sessões com nodeId nulo (null = não medido)
 * @param {string[]} [m.unknownNodeIdsInDb] nodeId no banco que não está nos nós conhecidos
 * @param {boolean} [m.nodeIdValid]
 */
export function evaluatePreflight(m) {
  const out = []
  const add = (level, code, message) => out.push({ level, code, message })

  const invalid = findInvalidNodeIdTokens(m.nodeIdsRaw)
  if (invalid.length) {
    add('fail', 'node_ids_invalid', `A lista de servidores tem nome(s) inválido(s): ${invalid.join(', ')}. Use só letras minúsculas, números e hífen (ex.: n1,n2). Com nome errado, o sistema acharia que o servidor está fora do ar e recusaria ligar robôs.`)
  }

  if (m.step === 'supervisor') {
    if (m.nodeIdValid === false) {
      add('fail', 'node_id_invalid', 'O nome deste servidor (SUPERVISOR_NODE_ID) é inválido. Se reiniciar assim, o servidor de robôs não sobe e TODOS os robôs ficam fora do ar.')
    } else {
      add('ok', 'node_id_valid', `Nome deste servidor: ${m.nodeId ?? DEFAULT_NODE_ID}.`)
    }
  }

  if (m.step === 'api' || m.step === 'segundo-no') {
    for (const id of m.knownNodeIds ?? []) {
      if (!m.heartbeats?.[id]) {
        add('fail', 'heartbeat_missing', `O servidor "${id}" não está respondendo agora. Ligar a novidade na API antes disso faria os comandos ficarem sem ninguém para atendê-los (painel travado, QR sem aparecer).`)
      } else {
        add('ok', 'heartbeat_ok', `Servidor "${id}" respondendo.`)
      }
      const cap = m.capacities?.[id]
      if (m.heartbeats?.[id] && !(Number(cap) >= 1)) {
        add('fail', 'capacity_missing', `O servidor "${id}" não informou quantas vagas tem (versão antiga do código?). Sem isso o sistema não escolhe esse servidor para contas novas.`)
      }
    }
  }

  if (m.step === 'api') {
    if (m.legacyBacklog === null || m.legacyBacklog === undefined) {
      add('warn', 'legacy_backlog_unknown', 'Não consegui medir a fila antiga.')
    } else if (m.legacyBacklog > 0) {
      add('warn', 'legacy_backlog_pending', `Há ${m.legacyBacklog} pedido(s) esperando na fila antiga. Espere zerar antes de seguir (a fila antiga só zera quando a API para de usá-la).`)
    } else {
      add('ok', 'legacy_backlog_empty', 'Fila antiga vazia.')
    }
  }

  if (m.step === 'segundo-no') {
    const multi = (m.knownNodeIds ?? []).some(id => id !== DEFAULT_NODE_ID)
    if (m.nullNodeIdCount === null || m.nullNodeIdCount === undefined) {
      add('fail', 'null_node_id_unknown', 'Não consegui contar as contas sem servidor definido. Sem essa certeza, não liste um segundo servidor.')
    } else if (multi && m.nullNodeIdCount > 0) {
      add('fail', 'backfill_pending', `${m.nullNodeIdCount} conta(s) ainda sem servidor definido. Rode o backfill (scripts/backfill-node-id.mjs --aplicar) ANTES de listar um segundo servidor — senão uma conta antiga pode ser tratada como nova.`)
    } else {
      add('ok', 'backfill_done', 'Todas as contas têm servidor definido.')
    }
    if ((m.unknownNodeIdsInDb ?? []).length) {
      add('fail', 'db_node_unknown', `Há contas apontando para servidor(es) que não estão na lista: ${m.unknownNodeIdsInDb.join(', ')}.`)
    }
  }

  const fails = out.filter(i => i.level === 'fail').length
  return { ok: fails === 0, fails, items: out }
}

/**
 * Guarda da API (flag ligada): quais nós conhecidos estão sem heartbeat.
 * Usado por um intervalo que só LOGA — nunca derruba a API (um deploy que
 * derrubasse a API por causa disso pioraria o incidente).
 */
export function nodesWithoutHeartbeat(knownNodeIds, heartbeats) {
  return (knownNodeIds ?? []).filter(id => !heartbeats?.[id])
}
