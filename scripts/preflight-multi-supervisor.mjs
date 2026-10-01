#!/usr/bin/env node
// Pré-checagem ANTES de cada passo da ativação do roteamento por nó. Read-only.
//
//   node scripts/preflight-multi-supervisor.mjs --passo=supervisor   # antes de reiniciar o supervisor com a flag
//   node scripts/preflight-multi-supervisor.mjs --passo=api          # antes de ligar a flag na API
//   node scripts/preflight-multi-supervisor.mjs --passo=segundo-no   # antes de listar um n2 em SUPERVISOR_NODE_IDS
//
// Roda no diretório do ambiente (carrega o .env dele). Sai com código 1 se
// houver qualquer item "fail". NÃO escreve nada. A decisão de cada veredito
// mora em src/supervisor/preflight.js (pura, testada).
// Ver docs/ops/multi-supervisor-ativacao.md.

import 'dotenv/config'
import { evaluatePreflight } from '../src/supervisor/preflight.js'
import { resolveKnownNodeIds, resolveSupervisorNodeId } from '../src/supervisor/nodeRouting.js'
import { COMMAND_QUEUE, capacityKey, heartbeatKey, resolveRedisUrl } from '../src/supervisor/protocol.js'

const arg = process.argv.find(a => a.startsWith('--passo='))?.split('=')[1]
if (!['supervisor', 'api', 'segundo-no'].includes(arg)) {
  console.error('Uso: node scripts/preflight-multi-supervisor.mjs --passo=supervisor|api|segundo-no')
  process.exit(2)
}

const env = process.env
const knownNodeIds = resolveKnownNodeIds(env)
const measured = { step: arg, nodeIdsRaw: env.SUPERVISOR_NODE_IDS, knownNodeIds, heartbeats: {}, capacities: {}, legacyBacklog: null, nullNodeIdCount: null, unknownNodeIdsInDb: [] }

if (arg === 'supervisor') {
  try { measured.nodeId = resolveSupervisorNodeId(env); measured.nodeIdValid = true } catch { measured.nodeIdValid = false }
}

let redis = null
let db = null
try {
  if (arg !== 'supervisor') {
    const url = resolveRedisUrl(env)
    if (!url) throw new Error('REDIS_URL ausente')
    const { default: Redis } = await import('ioredis')
    redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableReadyCheck: false })
    for (const id of knownNodeIds) {
      measured.heartbeats[id] = Boolean(await redis.get(heartbeatKey(id)))
      const cap = Number(await redis.get(capacityKey(id)))
      measured.capacities[id] = Number.isFinite(cap) && cap >= 1 ? cap : null
    }
    if (arg === 'api') {
      try { measured.legacyBacklog = Number(await redis.llen(`bull:${COMMAND_QUEUE}:wait`)) } catch { measured.legacyBacklog = null }
    }
  }
  if (arg === 'segundo-no') {
    db = (await import('../src/db.js')).default
    try {
      measured.nullNodeIdCount = await db.waSession.count({ where: { nodeId: null } })
      const grouped = await db.waSession.groupBy({ by: ['nodeId'], where: { nodeId: { not: null } }, _count: { _all: true } })
      measured.unknownNodeIdsInDb = grouped.map(g => g.nodeId).filter(id => !knownNodeIds.includes(id))
    } catch {
      measured.nullNodeIdCount = null
    }
  }
} catch (err) {
  console.error(`Falha ao medir: ${err.message}`)
  process.exitCode = 1
} finally {
  try { await redis?.quit() } catch {}
  try { await db?.$disconnect() } catch {}
}

const result = evaluatePreflight(measured)
const icon = { ok: '✅', warn: '⚠️ ', fail: '❌' }
for (const item of result.items) console.log(`${icon[item.level]} ${item.message}`)
console.log(result.ok ? '\nPode seguir para este passo.' : `\nNÃO siga: ${result.fails} item(ns) com problema.`)
if (!result.ok) process.exitCode = 1
