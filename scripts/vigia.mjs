#!/usr/bin/env node
// Vigia do ambiente — SOMENTE LEITURA. Roda no diretório do ambiente na VPS.
//
//   node scripts/vigia.mjs                 # relatório completo
//   node scripts/vigia.mjs --so-problemas  # só o que não está 🟢
//   node scripts/vigia.mjs --json          # saída para máquina
//   node scripts/vigia.mjs --api=http://127.0.0.1:3001 --estado=/tmp/vigia.json
//
// Olha: processos (pm2), memória/swap, disco, API (/ready), gerenciador de
// robôs (heartbeat no Redis), sessões do WhatsApp, envios da última hora,
// fila de comandos, quedas de conexão e idade do último backup.
// Código de saída: 0 = sem 🔴; 1 = tem 🔴. Nada é escrito, exceto o pequeno
// arquivo de estado (--estado) que guarda a contagem de reinícios do pm2 para
// comparar com a leitura seguinte. Cada medição que falha vira ⚪ (nunca 🟢).

import 'dotenv/config'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { evaluateVigia, formatVigia } from '../src/ops/vigia/evaluate.js'
import { parseNeedrestartMode } from '../src/ops/vigia/needrestart.js'
import { parseBackupStatus } from '../src/ops/vigia/backupStatus.js'
import { missingApps, resolveExpectedApps } from '../src/ops/pm2Guard.js'

const sh = promisify(execFile)
const args = new Map(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
const apiBase = String(args.get('api') || `http://127.0.0.1:${process.env.API_PORT || process.env.PORT || 3001}`)
const stateFile = args.get('estado') || null
const backupDir = process.env.BACKUP_DIR || '/home/deploy/wabot-backups'
const HORA = 3_600_000

const safe = async fn => { try { return await fn() } catch { return null } }

async function readPm2() {
  const { stdout } = await sh('pm2', ['jlist'], { timeout: 15_000, maxBuffer: 20 * 1024 * 1024 })
  return JSON.parse(stdout).map(p => ({ name: p.name, status: p.pm2_env?.status, restarts: p.pm2_env?.restart_time ?? 0 }))
}

function readNeedrestartMode() {
  const dir = '/etc/needrestart'
  if (!fs.existsSync(dir)) return null
  const files = []
  if (fs.existsSync(`${dir}/needrestart.conf`)) files.push(`${dir}/needrestart.conf`)
  if (fs.existsSync(`${dir}/conf.d`)) {
    for (const f of fs.readdirSync(`${dir}/conf.d`).filter(f => f.endsWith('.conf')).sort()) files.push(`${dir}/conf.d/${f}`)
  }
  return parseNeedrestartMode(files.map(f => fs.readFileSync(f, 'utf8')))
}

function readMemory() {
  const m = fs.readFileSync('/proc/meminfo', 'utf8')
  const kb = k => Number(m.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm'))?.[1])
  const gb = v => v / 1024 / 1024
  return { totalGb: gb(kb('MemTotal')), availableGb: gb(kb('MemAvailable')), swapUsedGb: gb(kb('SwapTotal') - kb('SwapFree')) }
}

async function readDisk() {
  const s = await fs.promises.statfs(process.cwd())
  return (Number(s.bavail) / Number(s.blocks)) * 100
}

async function readApi() {
  // Conexão recusada/timeout = API fora do ar (🔴), não "não medi".
  try {
    const r = await fetch(`${apiBase}/ready`, { signal: AbortSignal.timeout(5_000) })
    return r.ok
  } catch { return false }
}

function readBackupAgeH() {
  const txt = fs.readFileSync(`${backupDir}/last_success.txt`, 'utf8')
  const t = Date.parse(txt.trim().split(/\s+/)[0])
  return Number.isFinite(t) ? (Date.now() - t) / HORA : null
}

const prev = stateFile ? await safe(() => JSON.parse(fs.readFileSync(stateFile, 'utf8'))) : null
// Processos parados DE PROPÓSITO (rodam só em horário agendado) não são problema.
const pm2Ignore = new Set(String(process.env.VIGIA_PM2_IGNORE ?? 'snapshot-cron').split(',').map(x => x.trim()).filter(Boolean))
const allPm2 = await safe(readPm2)
const pm2 = allPm2?.filter(p => !pm2Ignore.has(p.name)) ?? null

const snapshot = {
  pm2,
  // Ausência é medida na lista COMPLETA (sem o filtro de ignorados).
  missingApps: allPm2 ? missingApps(allPm2, resolveExpectedApps(process.env)) : [],
  needrestartMode: (() => { try { return readNeedrestartMode() } catch { return undefined } })(),
  prevRestarts: prev?.restarts ?? null,
  mem: await safe(readMemory),
  diskFreePct: await safe(readDisk),
  apiReady: await safe(readApi),
  backupAgeH: await safe(readBackupAgeH),
  backupInfo: await safe(() => parseBackupStatus({
    marker: fs.readFileSync(`${backupDir}/last_success.txt`, 'utf8'),
    logTail: (() => { try { const t = fs.readFileSync(`${backupDir}/backup.log`, 'utf8'); return t.slice(-20_000) } catch { return null } })(),
  })),
  supervisorAlive: null,
  queueBacklog: null,
  sessions: null,
  sends: null,
  wa: null,
}

// Redis: heartbeat do gerenciador + fila de comandos (só em modo remote o
// gerenciador é um processo à parte; em inline não há heartbeat para olhar).
const mode = String(process.env.BOT_SUPERVISOR_MODE || 'inline').toLowerCase()
const redisUrl = await safe(async () => (await import('../src/supervisor/protocol.js')).resolveRedisUrl(process.env))
if (redisUrl && mode === 'remote') {
  const redis = await safe(async () => {
    const { default: Redis } = await import('ioredis')
    return new Redis(redisUrl, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: false })
  })
  if (redis) {
    const { resolveKnownNodeIds, isNodeRoutingEnabled } = await import('../src/supervisor/nodeRouting.js')
    const p = await import('../src/supervisor/protocol.js')
    const routing = isNodeRoutingEnabled(process.env)
    const nodes = routing ? resolveKnownNodeIds(process.env) : [null]
    const alive = await safe(async () => {
      const flags = await Promise.all(nodes.map(id => redis.get(routing ? p.heartbeatKey(id) : p.SUPERVISOR_HEARTBEAT_KEY)))
      return flags.every(Boolean)
    })
    snapshot.supervisorAlive = alive
    snapshot.queueBacklog = await safe(async () => {
      const names = routing ? nodes.map(id => p.commandQueueName(id)) : [p.COMMAND_QUEUE]
      const sizes = await Promise.all(names.map(n => redis.llen(`bull:${n}:wait`)))
      return sizes.reduce((a, b) => a + b, 0)
    })
    try { await redis.quit() } catch {}
  }
}

// Banco: sessões, envios e quedas (só leitura).
const db = await safe(async () => (await import('../src/db.js')).default)
if (db) {
  const now = Date.now()
  snapshot.sessions = await safe(async () => {
    // "Deveriam estar ligadas" = status connected/connecting. Conta com status
    // `disconnected` (cliente que desligou/perdeu o pareamento há dias ou meses)
    // NÃO é queda nova: entra só como informação (`disconnected`).
    const live = { status: { in: ['connected', 'connecting'] } }
    const total = await db.waSession.count({ where: live })
    const connected = await db.waSession.count({ where: { status: 'connected' } })
    const stale = await db.waSession.count({
      where: { ...live, OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: new Date(now - 5 * 60_000) } }] },
    })
    const disconnected = await db.waSession.count({ where: { status: 'disconnected', lifecycle: { in: ['ready', 'reconnecting', 'connecting', 'authenticating'] } } })
    return { total, connected, stale, disconnected }
  })
  snapshot.sends = await safe(async () => {
    const since = new Date(now - HORA)
    const stuckBefore = new Date(now - 15 * 60_000)
    // `error:worker_restart*` NÃO é falha de envio: é o marcador que o robô grava
    // ao reiniciar (a oferta é reenfileirada). Conta à parte, fora da taxa de erro.
    const restartMark = { errorMsg: { startsWith: 'error:worker_restart' } }
    const [success, error, restarted, stuck, total] = await Promise.all([
      db.messageLog.count({ where: { sentAt: { gte: since }, status: 'success' } }),
      db.messageLog.count({ where: { sentAt: { gte: since }, status: { in: ['error', 'failed'] }, NOT: restartMark } }),
      db.messageLog.count({ where: { sentAt: { gte: since }, status: { in: ['error', 'failed'] }, ...restartMark } }),
      db.messageLog.count({ where: { sentAt: { lt: stuckBefore, gte: new Date(now - 6 * HORA) }, status: { in: ['queued', 'sending', 'pending'] } } }),
      db.messageLog.count({ where: { sentAt: { gte: since } } }),
    ])
    return { total, success, error, restarted, stuck, stuckMin: 15 }
  })
  snapshot.wa = await safe(async () => {
    const since = new Date(now - HORA)
    const rows = await db.waConnectionEvent.groupBy({ by: ['type'], where: { occurredAt: { gte: since } }, _count: { _all: true } })
    const n = t => rows.find(r => r.type === t)?._count._all ?? 0
    return { reconnects: n('reconnect_attempt'), forbidden: n('forbidden'), replaced: n('replaced') }
  })
  try { await db.$disconnect() } catch {}
}

const result = evaluateVigia(snapshot)

if (stateFile && pm2) {
  await safe(() => fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString(), restarts: Object.fromEntries(pm2.map(p => [p.name, p.restarts])) })))
}

if (args.get('json')) console.log(JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2))
else console.log(formatVigia(result, { onlyProblems: Boolean(args.get('so-problemas')) }))
process.exit(result.level === 'red' ? 1 : 0)
