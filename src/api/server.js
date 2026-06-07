import 'dotenv/config'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'
import { createCorsOriginChecker, getAllowedOrigins } from './cors.js'

import { authRoutes } from './routes/auth.js'
import { mlOAuthRoutes } from './routes/mlOAuth.js'
import { sessionRoutes } from './routes/session.js'
import { groupsRoutes } from './routes/groups.js'
import { credentialsRoutes } from './routes/credentials.js'
import { paymentsRoutes } from './routes/payments.js'
import { configRoutes } from './routes/config.js'
import { broadcastRoutes } from './routes/broadcast.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { logsRoutes } from './routes/logs.js'
import { linkConversionRoutes } from './routes/linkConversion.js'
import { adminRoutes } from './routes/admin.js'
import { publicRoutes } from './routes/public.js'
import { clickTrackerRoutes } from './routes/clickTracker.js'
import { preservationRoutes } from './routes/preservation.js'
import { offerAutomationRoutes } from './routes/offerAutomation.js'
import { startOfferAutomationCron } from '../offerAutomation/cron.js'
import { registerApiMetricsHooks, renderPrometheusMetrics } from './metrics.js'
import { getSupervisorOperationalCounters } from '../supervisor/operationalCounters.js'
import db from '../db.js'
import { revokeTokenJtiGlobal, isTokenRevokedGlobal } from '../core/tokenRevocationStore.js'
import { resumePersistedBots, startSessionHealthMonitor, stopAllBots } from '../manager.js'

const app = Fastify({ logger: true, trustProxy: true })
registerApiMetricsHooks(app)
const activityWriteThrottleMs = Math.max(0, Number(process.env.ACTIVITY_WRITE_THROTTLE_MS || 60_000))
const lastActivityWriteByUser = new Map()
const activityCacheMaxEntries = Math.max(1000, Number(process.env.ACTIVITY_CACHE_MAX_ENTRIES || 50_000))
const activityCacheCleanupIntervalMs = Math.max(30_000, Number(process.env.ACTIVITY_CACHE_CLEANUP_INTERVAL_MS || 300_000))
let activityCacheCleanupTimer = null

const allowedOrigins = new Set(getAllowedOrigins())
const isOriginAllowed = createCorsOriginChecker(allowedOrigins)
app.log.info({ allowedOrigins: [...allowedOrigins] }, 'CORS allowlist carregada')

function resolveJwtSecret() {
  return process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || process.env.JWT_TOKEN || null
}


function isPrismaShapeMismatch(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('no such column') || message.includes('does not exist in the current database')
}

async function verifyAuthenticatedUser(userId) {
  try {
    const now = Date.now()
    const lastWrite = lastActivityWriteByUser.get(userId) ?? 0
    const shouldWrite = activityWriteThrottleMs === 0 || (now - lastWrite) >= activityWriteThrottleMs
    if (shouldWrite) {
      const activity = await db.user.updateMany({
        where: { id: userId, status: { notIn: ['banned', 'suspended'] } },
        data: { lastActivityAt: new Date(now) },
      })
      if (activity.count === 1) lastActivityWriteByUser.set(userId, now)
      if (lastActivityWriteByUser.size > activityCacheMaxEntries) {
        const oldestKey = lastActivityWriteByUser.keys().next().value
        if (oldestKey) lastActivityWriteByUser.delete(oldestKey)
      }
      return activity.count === 1
    }
    const user = await db.user.findFirst({
      where: { id: userId, status: { notIn: ['banned', 'suspended'] } },
      select: { id: true },
    })
    return Boolean(user)
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    return Boolean(user)
  }
}

function startActivityCacheCleanup() {
  activityCacheCleanupTimer = setInterval(() => {
    const cutoff = Date.now() - Math.max(activityWriteThrottleMs * 4, 10 * 60_000)
    for (const [userId, lastWrite] of lastActivityWriteByUser.entries()) {
      if (lastWrite < cutoff) lastActivityWriteByUser.delete(userId)
    }
  }, activityCacheCleanupIntervalMs)
  activityCacheCleanupTimer.unref?.()
}


function getTokenFromAuthorizationHeader(value) {
  if (!value) return null
  const [scheme, token] = String(value).split(' ')
  if (!scheme || !token) return null
  if (scheme.toLowerCase() !== 'bearer') return null
  return token.trim() || null
}

function getTokenFromCookie(cookieHeader, cookieName = 'wb_auth') {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';').map((part) => part.trim())
  const target = parts.find((part) => part.startsWith(`${cookieName}=`))
  if (!target) return null
  return decodeURIComponent(target.slice(cookieName.length + 1))
}

async function verifyDatabase() {
  await db.$queryRaw`SELECT 1`
  // Verifica schema esperado (captura banco sem migrations)
  await db.user.count()
}


const MESSAGE_LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS === undefined ? 90 : Number(process.env.LOG_RETENTION_DAYS)
const WEBHOOK_RETENTION_DAYS = process.env.WEBHOOK_RETENTION_DAYS === undefined ? 30 : Number(process.env.WEBHOOK_RETENTION_DAYS)
const ADMIN_AUDIT_RETENTION_DAYS = process.env.ADMIN_AUDIT_RETENTION_DAYS === undefined ? 180 : Number(process.env.ADMIN_AUDIT_RETENTION_DAYS)
const LOG_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

async function cleanupByRetentionDays(model, dateField, retentionDays, logLabel) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await model.deleteMany({ where: { [dateField]: { lt: cutoff } } })
  if (result.count > 0) app.log.info({ deleted: result.count, cutoff, retentionDays }, `${logLabel} removidos por retenção automática`)
}

async function cleanupOldLogs() {
  await cleanupByRetentionDays(db.messageLog, 'sentAt', MESSAGE_LOG_RETENTION_DAYS, 'Message logs').catch(err => {
    app.log.error({ err: err.message }, 'Falha na limpeza automática de message logs')
  })
  await cleanupByRetentionDays(db.webhookEvent, 'createdAt', WEBHOOK_RETENTION_DAYS, 'Webhook events').catch(err => {
    app.log.error({ err: err.message }, 'Falha na limpeza automática de webhook events')
  })
  await cleanupByRetentionDays(db.adminAuditLog, 'createdAt', ADMIN_AUDIT_RETENTION_DAYS, 'Admin audit logs').catch(err => {
    app.log.error({ err: err.message }, 'Falha na limpeza automática de admin audit logs')
  })
}

function startLogRetentionJob() {
  cleanupOldLogs().catch(err => app.log.error({ err: err.message }, 'Falha na limpeza automática de retenção'))
  const timer = setInterval(() => {
    cleanupOldLogs().catch(err => app.log.error({ err: err.message }, 'Falha na limpeza automática de retenção'))
  }, LOG_RETENTION_INTERVAL_MS)
  timer.unref?.()
}

// PR-5.C.3: watchdog do probe roda a cada 5min e marca yellow canais que
// publicaram mas não receberam ping da conta-probe. Conservador — nunca
// degrada para red/critical e nunca sobreescreve red/critical existente.
const PROBE_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000
async function runProbeWatchdogTick() {
  const { runProbeWatchdog } = await import('../core/channelProbe.js')
  try {
    const summary = await runProbeWatchdog()
    if (summary.flagged > 0) {
      app.log.info({ ...summary }, 'probe-watchdog: canais marcados yellow')
    }
  } catch (err) {
    app.log.warn({ err: err.message }, 'probe-watchdog tick falhou')
  }
}
function startProbeWatchdogJob() {
  const timer = setInterval(runProbeWatchdogTick, PROBE_WATCHDOG_INTERVAL_MS)
  timer.unref?.()
}

async function ensureDatabaseReady() {
  try {
    await verifyDatabase()
    app.log.info('Banco de dados pronto para receber tráfego')
    return true
  } catch (err) {
    app.log.error({ err: err.message }, 'Banco de dados indisponível ou sem migrations aplicadas')
    return false
  }
}


function shouldSetHsts(req) {
  const force = String(process.env.FORCE_HSTS ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(force)) return true
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase()
  return req.protocol === 'https' || forwardedProto === 'https'
}

await app.register(fastifyCors, {
  origin(origin, cb) {
    if (isOriginAllowed(origin)) return cb(null, true)
    cb(new Error('Origem não permitida por CORS'), false)
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
})

app.addHook('onSend', async (req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'no-referrer')
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  reply.header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")

  if (shouldSetHsts(req)) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})

const jwtSecret = resolveJwtSecret()
if (!jwtSecret) {
  app.log.fatal('JWT secret ausente. Configure JWT_SECRET (ou AUTH_JWT_SECRET/JWT_TOKEN) e reinicie a API.')
  process.exit(1)
}
await app.register(fastifyJwt, { secret: jwtSecret })
await app.register(fastifyWebsocket)
app.decorate('revokeTokenJti', revokeTokenJtiGlobal)

app.decorate('authenticate', async function (req, reply) {
  const cookieToken = getTokenFromCookie(req.headers.cookie)
  const headerToken = getTokenFromAuthorizationHeader(req.headers.authorization)
  const candidates = [cookieToken, headerToken].filter(Boolean)

  for (const token of candidates) {
    try {
      const user = app.jwt.verify(token)
      if (await isTokenRevokedGlobal(user.jti)) continue
      const active = await verifyAuthenticatedUser(user.sub)
      if (!active) continue
      req.user = user
      return
    } catch {
      continue
    }
  }

  reply.code(401).send({ error: 'Não autorizado' })
})

app.register(authRoutes, { prefix: '/api/auth' })
app.register(mlOAuthRoutes, { prefix: '/api/auth' })
app.register(sessionRoutes, { prefix: '/api/session' })
app.register(groupsRoutes, { prefix: '/api/groups' })
app.register(credentialsRoutes, { prefix: '/api/credentials' })
app.register(paymentsRoutes, { prefix: '/api/payments' })
app.register(configRoutes, { prefix: '/api/config' })
app.register(broadcastRoutes, { prefix: '/api/broadcast' })
app.register(dashboardRoutes, { prefix: '/api/dashboard' })
app.register(logsRoutes, { prefix: '/api/logs' })
app.register(linkConversionRoutes, { prefix: '/api/link-conversion' })
app.register(adminRoutes, { prefix: '/api/admin' })
app.register(publicRoutes, { prefix: '/api/public' })
app.register(preservationRoutes, { prefix: '/api/preservation' })
app.register(offerAutomationRoutes, { prefix: '/api/offer-automations' })
app.register(clickTrackerRoutes) // sem prefix — /r/:hash precisa estar na raiz

// Liveness: processo está de pé
app.get('/health', () => ({ ok: true }))

// Prometheus scrape endpoint
app.get('/metrics', async (_req, reply) => {
  reply
    .code(200)
    .header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
    .send(renderPrometheusMetrics(await getSupervisorOperationalCounters()))
})

// Readiness: dependências estão prontas para receber tráfego
app.get('/ready', async (req, reply) => {
  try {
    await verifyDatabase()
    return { ok: true }
  } catch {
    return reply.code(503).send({ ok: false, error: 'Banco indisponível' })
  }
})

const port = Number(process.env.API_PORT) || 3001
const databaseReadyAtBoot = await ensureDatabaseReady()
if (!databaseReadyAtBoot) {
  app.log.warn('API iniciada em modo degradado: execute "npx prisma migrate deploy" e reinicie quando o banco estiver pronto')
}
startLogRetentionJob()
startActivityCacheCleanup()
startProbeWatchdogJob()
startOfferAutomationCron()
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
const stopSessionHealthMonitor = startSessionHealthMonitor(db, app.log)
await resumePersistedBots(db, app.log).catch(err => {
  app.log.error({ err: err.message }, 'Falha ao retomar sessões WhatsApp persistidas')
})

async function shutdown(signal) {
  app.log.info({ signal }, 'Encerrando API com parada graciosa')
  stopSessionHealthMonitor()
  stopAllBots()
  if (activityCacheCleanupTimer) clearInterval(activityCacheCleanupTimer)
  await app.close()
  await db.$disconnect()
}

process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })
