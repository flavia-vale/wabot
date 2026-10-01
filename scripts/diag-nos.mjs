#!/usr/bin/env node
// Visão por servidor (nó) do supervisor — read-only, roda no diretório do ambiente.
//
//   node scripts/diag-nos.mjs
//
// Para cada servidor listado em SUPERVISOR_NODE_IDS (padrão n1): se está
// respondendo, desde quando, quantas vagas diz ter, quantos pedidos esperam na
// fila dele e quantas contas do banco apontam para ele. Existe para que, com
// mais de um servidor, um incidente se diagnostique SEM entrar em cada máquina
// para adivinhar. Nada é escrito.

import 'dotenv/config'
import { resolveKnownNodeIds } from '../src/supervisor/nodeRouting.js'
import { bootedAtKey, capacityKey, commandQueueName, heartbeatKey, resolveRedisUrl, COMMAND_QUEUE } from '../src/supervisor/protocol.js'

const nodeIds = resolveKnownNodeIds(process.env)
const url = resolveRedisUrl(process.env)
if (!url) { console.error('REDIS_URL ausente'); process.exit(2) }

const { default: Redis } = await import('ioredis')
const db = (await import('../src/db.js')).default
const redis = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false })

const quando = ms => { const n = Number(ms); return Number.isFinite(n) && n > 0 ? `${new Date(n).toISOString()} (${Math.round((Date.now() - n) / 60_000)} min atrás)` : 'desconhecido' }
const ou = v => (v === null || v === undefined ? 'não medido' : v)

try {
  for (const id of nodeIds) {
    const vivo = Boolean(await redis.get(heartbeatKey(id)))
    const teto = Number(await redis.get(capacityKey(id)))
    const fila = await redis.llen(`bull:${commandQueueName(id)}:wait`).catch(() => null)
    let contas = null
    try {
      contas = id === 'n1'
        ? await db.waSession.count({ where: { OR: [{ nodeId: null }, { nodeId: id }] } })
        : await db.waSession.count({ where: { nodeId: id } })
    } catch { contas = null }
    console.log(`\n== servidor ${id} ==`)
    console.log(`respondendo: ${vivo ? 'SIM' : 'NÃO'}`)
    console.log(`ligou em: ${quando(await redis.get(bootedAtKey(id)))}`)
    console.log(`vagas que informa: ${Number.isFinite(teto) && teto >= 1 ? teto : 'não informou'}`)
    console.log(`pedidos esperando na fila dele: ${ou(fila)}`)
    console.log(`contas apontando para ele (banco): ${ou(contas)}`)
  }
  const legado = await redis.llen(`bull:${COMMAND_QUEUE}:wait`).catch(() => null)
  console.log(`\nfila antiga: ${ou(legado)} pedido(s) esperando`)
  const nulas = await db.waSession.count({ where: { nodeId: null } }).catch(() => null)
  console.log(`contas sem servidor definido (contam como n1): ${ou(nulas)}`)
} finally {
  try { await redis.quit() } catch {}
  try { await db.$disconnect() } catch {}
}
