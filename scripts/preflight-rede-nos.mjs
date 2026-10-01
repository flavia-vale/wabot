#!/usr/bin/env node
// Pré-checagem de REDE de um servidor secundário. Read-only. Rodar NO servidor
// secundário, no diretório do ambiente (carrega o .env dele):
//
//   node scripts/preflight-rede-nos.mjs --secundario        # servidor extra (n2...)
//   node scripts/preflight-rede-nos.mjs                     # servidor principal
//
// Mede a velocidade até o Redis (30 PINGs), compara o relógio com o do Redis e
// confere se REDIS_URL/DATABASE_URL são seguros. Decisões em
// src/supervisor/networkPreflight.js (pura, testada). Sai com erro se algo bloquear.

import 'dotenv/config'
import { evaluateNetwork } from '../src/supervisor/networkPreflight.js'
import { resolveRedisUrl } from '../src/supervisor/protocol.js'
import { parseRedisTime } from '../src/supervisor/redisClock.js'

const secondNode = process.argv.includes('--secundario')
const redisUrl = resolveRedisUrl(process.env)
const measured = { secondNode, redisUrl, databaseUrl: process.env.DATABASE_URL, latenciesMs: [], clockSkewMs: null }

let redis = null
try {
  const { default: Redis } = await import('ioredis')
  redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableReadyCheck: false, connectTimeout: 3000 })
  await redis.ping()
  for (let i = 0; i < 30; i++) {
    const t0 = process.hrtime.bigint()
    await redis.ping()
    measured.latenciesMs.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  const before = Date.now()
  const redisNow = parseRedisTime(await redis.time())
  const after = Date.now()
  if (redisNow !== null) measured.clockSkewMs = Math.round((before + after) / 2) - redisNow
} catch (err) {
  console.error(`Falha ao medir o Redis: ${err.message}`)
} finally {
  try { await redis?.quit() } catch {}
}

const result = evaluateNetwork(measured)
const icon = { ok: '✅', warn: '⚠️ ', fail: '❌' }
for (const item of result.items) console.log(`${icon[item.level]} ${item.message}`)
console.log(result.ok ? '\nRede OK para este servidor.' : `\nNÃO siga: ${result.fails} item(ns) com problema.`)
process.exit(result.ok ? 0 : 1)
