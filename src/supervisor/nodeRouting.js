/**
 * Config e helpers puros do roteamento por nó (SUPERVISOR_NODE_ROUTING).
 * Flag off (default) = comportamento legado, nada aqui é consultado.
 */

import { COMMAND, DEFAULT_NODE_ID, isValidNodeId } from './protocol.js'
import { accountIdFromSessionKey } from '../domain/session/sessionKey.js'

/**
 * Revisão V2 (multi-número × multi-servidor): o nó é da CONTA. Toda posse/cache
 * de nó usa esta chave — `<conta>~n2` vira `<conta>`; chave comum fica igual.
 */
export function nodeOwnerKey(sessionKey) {
  return accountIdFromSessionKey(sessionKey) ?? sessionKey
}

export function isNodeRoutingEnabled(env = process.env) {
  return ['1', 'true', 'on'].includes(String(env.SUPERVISOR_NODE_ROUTING ?? '').trim().toLowerCase())
}

/** Nó deste supervisor. Inválido lança (fail-fast no boot). */
export function resolveSupervisorNodeId(env = process.env) {
  const raw = env.SUPERVISOR_NODE_ID
  if (raw === undefined || raw === '') return DEFAULT_NODE_ID
  if (!isValidNodeId(raw)) throw new Error(`SUPERVISOR_NODE_ID inválido: ${JSON.stringify(raw)} (use [a-z0-9-], até 16 caracteres)`)
  return raw
}

/** Nós conhecidos pela API (SUPERVISOR_NODE_IDS="n1,n2"). Default ['n1']. */
export function resolveKnownNodeIds(env = process.env) {
  const ids = String(env.SUPERVISOR_NODE_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const valid = [...new Set(ids.filter(isValidNodeId))]
  return valid.length ? valid.sort() : [DEFAULT_NODE_ID]
}

/** Só o nó 'n1' consome a fila legada (transição) e grava as chaves legadas. */
export function ownsLegacyQueue(nodeId) {
  return nodeId === DEFAULT_NODE_ID
}

/** Filtro de `nodeId` para o banco: o nó 'n1' também herda `nodeId` nulo. */
export function nodeIdWhere(nodeId) {
  return nodeId === DEFAULT_NODE_ID
    ? { OR: [{ nodeId: null }, { nodeId: DEFAULT_NODE_ID }] }
    : { nodeId }
}

/**
 * `where` do resume/ressurreição. Flag off devolve `base` intacto; on, soma o
 * filtro do nó (AND, porque `base` pode já ter OR).
 */
export function buildResumeWhere({ base, nodeId, routing }) {
  if (!routing) return base
  return { AND: [base, nodeIdWhere(nodeId)] }
}

/**
 * Cache curto de posse (userId -> nodeId). O banco só é lido em miss/expirado.
 * `loadNodeId` pode lançar: o chamador decide o fail-safe (ver `ownsSession`).
 */
export function createNodeOwnershipCache({ loadNodeId, ttlMs = 10_000, now = () => Date.now() } = {}) {
  const entries = new Map()
  return {
    async get(userId) {
      const hit = entries.get(userId)
      if (hit && hit.expiresAt > now()) return hit.nodeId
      const nodeId = await loadNodeId(userId)
      entries.set(userId, { nodeId, expiresAt: now() + ttlMs })
      return nodeId
    },
    /** Última posse conhecida, mesmo expirada (fail-safe quando o banco falha). */
    peek(userId) { return entries.get(userId)?.nodeId ?? null },
    set(userId, nodeId) { entries.set(userId, { nodeId, expiresAt: now() + ttlMs }) },
    invalidate(userId) { entries.delete(userId) },
  }
}

/**
 * Cadeado de posse no Redis: só existe com roteamento por nó ligado. Com o
 * roteamento ligado nasce LIGADO (revisão C2: é a 2ª barreira contra o mesmo
 * WhatsApp em dois nós); `SUPERVISOR_OWNER_LEASE=0` desliga. Flag de
 * roteamento desligada = sempre off (nada muda no legado).
 */
export function isOwnerLeaseEnabled(env = process.env) {
  if (!isNodeRoutingEnabled(env)) return false
  return !['0', 'false', 'off'].includes(String(env.SUPERVISOR_OWNER_LEASE ?? '').trim().toLowerCase())
}

/**
 * Revisão C1 — "parar" e "está rodando?" respondem pelo PROCESSO LOCAL quando o
 * roteamento está ligado. Parar um robô que roda aqui nunca é perigoso; recusar
 * (por "não sou o dono no banco") deixava o MESMO WhatsApp ligado em dois nós
 * sem nenhum jeito automático de derrubar o errado. Flag off: decide pela posse,
 * exatamente como antes (com SHARD_COUNT=1 a posse é sempre "minha").
 */
export function shouldActLocally({ routing, owns, runningHere }) {
  if (owns) return true
  return Boolean(routing && runningHere)
}

/**
 * Comandos que ligam/desligam o socket do WhatsApp: a posse é relida do banco
 * (sem cache) antes de rodar. Cache de 10 s não basta aqui — um START_BOT no nó
 * errado abre um segundo socket na mesma credencial.
 */
export function commandNeedsFreshOwnership(name) {
  return name === COMMAND.START_BOT || name === COMMAND.STOP_BOT
}
