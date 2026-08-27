import fs from 'node:fs/promises'
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileDefault = promisify(execFileCallback)
const DEFAULT_PROCESS_ROOTS = Object.freeze({ production: '/home/deploy/wabot', staging: '/home/deploy/wabot-staging' })

export function resolveProcessRoots(env = process.env) {
  const absoluteOrDefault = (value, fallback) => typeof value === 'string' && path.isAbsolute(value.trim()) ? path.normalize(value.trim()) : fallback
  return {
    production: absoluteOrDefault(env.CAPACITY_PRODUCTION_ROOT, DEFAULT_PROCESS_ROOTS.production),
    staging: absoluteOrDefault(env.CAPACITY_STAGING_ROOT, DEFAULT_PROCESS_ROOTS.staging),
  }
}

function classifyScript(script, roots) {
  const normalized = path.resolve(script)
  for (const [environment, root] of Object.entries(roots)) {
    if (normalized === path.resolve(root, 'src/bot-worker.js')) return environment
  }
  return null
}

export function classifyWorkerCmdline(buffer, roots) {
  const args = Buffer.isBuffer(buffer) ? buffer.toString('utf8').split('\0').filter(Boolean) : String(buffer || '').split('\0').filter(Boolean)
  if (!args.length || !/(^|\/)node(?:js)?$/.test(args[0])) return null
  const script = args.find((arg, index) => index > 0 && !arg.startsWith('-'))
  const environment = script ? classifyScript(script, roots) : null
  return environment ? { environment } : null
}

function safePm2App(app) {
  const name = typeof app?.name === 'string' ? app.name : null
  const environment = name?.includes('staging') ? 'staging' : 'production'
  return {
    key: name,
    environment,
    status: typeof app?.pm2_env?.status === 'string' ? app.pm2_env.status : null,
    pid: Number.isInteger(app?.pid) ? app.pid : null,
    uptimeSeconds: Number.isFinite(app?.pm2_env?.pm_uptime) ? Math.max(0, (Date.now() - app.pm2_env.pm_uptime) / 1000) : null,
    restartCount: Number.isFinite(app?.pm2_env?.restart_time) ? app.pm2_env.restart_time : null,
    cpuPercent: Number.isFinite(app?.monit?.cpu) ? app.monit.cpu : null,
    rssMb: Number.isFinite(app?.monit?.memory) ? app.monit.memory / 1048576 : null,
  }
}

export async function collectProcessMetrics(options = {}) {
  const execFile = options.execFile || execFileDefault
  const readdir = options.readdir || fs.readdir
  const readFile = options.readFile || fs.readFile
  const roots = options.roots || DEFAULT_PROCESS_ROOTS
  const timeoutMs = options.timeoutMs ?? 3000
  let components = null
  let pm2ErrorCode = null
  try {
    const result = await execFile(options.pm2Bin || 'pm2', ['jlist'], { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 })
    const parsed = JSON.parse(result.stdout)
    components = Array.isArray(parsed) ? parsed.map(safePm2App) : null
  } catch (error) {
    pm2ErrorCode = error?.code === 'ETIMEDOUT' || error?.killed ? 'PM2_TIMEOUT' : 'PM2_UNAVAILABLE'
  }
  const workers = []
  let hostRssTotalMb = null
  let procErrorCode = null
  try {
    const entries = await readdir('/proc', { withFileTypes: true })
    const pids = entries.filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name)).map((entry) => Number(entry.name))
    const maxProcPids = options.maxProcPids ?? 4096
    if (pids.length > maxProcPids) {
      procErrorCode = 'PROC_LIMIT_EXCEEDED'
    } else {
      let hostRssKb = 0
      const concurrency = Math.max(1, Math.min(64, options.procConcurrency ?? 32))
      for (let offset = 0; offset < pids.length; offset += concurrency) {
        await Promise.all(pids.slice(offset, offset + concurrency).map(async (pid) => {
          try {
            // Status is read for every process, independently of worker classification.
            // The cmdline is used only in-memory for an exact allowlist and is never returned.
            const [statusValue, cmdline] = await Promise.all([
              readFile(`/proc/${pid}/status`, 'utf8'),
              readFile(`/proc/${pid}/cmdline`).catch(() => Buffer.alloc(0)),
            ])
            const rssMatch = String(statusValue).match(/^VmRSS:\s+(\d+)\s+kB$/m)
            const rssKb = rssMatch ? Number(rssMatch[1]) : 0
            hostRssKb += rssKb
            const classification = classifyWorkerCmdline(cmdline, roots)
            if (classification) workers.push({ pid, environment: classification.environment, rssMb: rssMatch ? rssKb / 1024 : null })
          } catch { /* process exited or is unreadable; the host scan remains a point-in-time best effort */ }
        }))
      }
      hostRssTotalMb = hostRssKb / 1024
    }
  } catch { procErrorCode = 'PROC_UNAVAILABLE' }
  const classifiedRssTotalMb = workers.reduce((total, worker) => total + (Number.isFinite(worker.rssMb) ? worker.rssMb : 0), 0)
  return { components, workers, hostRssTotalMb, classifiedRssTotalMb, sources: { pm2: pm2ErrorCode ? { status: 'unavailable', errorCode: pm2ErrorCode } : { status: 'ok', errorCode: null }, proc: procErrorCode ? { status: 'unavailable', errorCode: procErrorCode } : { status: 'ok', errorCode: null } } }
}
