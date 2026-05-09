import 'dotenv/config'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'

import { authRoutes } from './routes/auth.js'
import { sessionRoutes } from './routes/session.js'
import { groupsRoutes } from './routes/groups.js'
import { credentialsRoutes } from './routes/credentials.js'
import { paymentsRoutes } from './routes/payments.js'
import { configRoutes } from './routes/config.js'
import { broadcastRoutes } from './routes/broadcast.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { logsRoutes } from './routes/logs.js'
import { adminRoutes } from './routes/admin.js'
import { publicRoutes } from './routes/public.js'
import { registerApiMetricsHooks } from './metrics.js'
import db from '../db.js'
import { resumePersistedBots, stopAllBots } from '../manager.js'

const app = Fastify({ logger: true, trustProxy: true })
registerApiMetricsHooks(app)

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://espelhagrupos.com.br',
  'https://espelhagrupos.com.br',
  'http://www.espelhagrupos.com.br',
  'https://www.espelhagrupos.com.br',
]

function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (!configured?.length) return DEFAULT_ALLOWED_ORIGINS
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])]
}

const allowedOrigins = new Set(getAllowedOrigins())
app.log.info({ allowedOrigins: [...allowedOrigins] }, 'CORS allowlist carregada')

function resolveJwtSecret() {
  return process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || process.env.JWT_TOKEN || null
}

function isOriginAllowed(origin) {
  if (!origin) return true
  return allowedOrigins.has(origin)
}


function isPrismaShapeMismatch(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('no such column') || message.includes('does not exist in the current database')
}

async function verifyAuthenticatedUser(userId) {
  try {
    const activity = await db.user.updateMany({
      where: { id: userId, status: { notIn: ['banned', 'suspended'] } },
      data: { lastActivityAt: new Date() },
    })
    return activity.count === 1
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    return Boolean(user)
  }
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


const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS === undefined
  ? 90
  : Number(process.env.LOG_RETENTION_DAYS)
const LOG_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

async function cleanupOldLogs() {
  if (LOG_RETENTION_DAYS <= 0) return
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const result = await db.messageLog.deleteMany({ where: { sentAt: { lt: cutoff } } })
  if (result.count > 0) app.log.info({ deleted: result.count, cutoff }, 'Logs antigos removidos por retenção automática')
}

function startLogRetentionJob() {
  if (LOG_RETENTION_DAYS <= 0) {
    app.log.info('Retenção automática de logs desabilitada')
    return
  }
  cleanupOldLogs().catch(err => app.log.error({ err: err.message }, 'Falha na limpeza automática de logs'))
  const timer = setInterval(() => {
    cleanupOldLogs().catch(err => app.log.error({ err: err.message }, 'Falha na limpeza automática de logs'))
  }, LOG_RETENTION_INTERVAL_MS)
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

  if (req.protocol === 'https') {
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

app.decorate('authenticate', async function (req, reply) {
  try {
    const token = getTokenFromCookie(req.headers.cookie) || getTokenFromAuthorizationHeader(req.headers.authorization)
    if (!token) throw new Error('Token ausente')
    req.user = app.jwt.verify(token)
    const active = await verifyAuthenticatedUser(req.user.sub)
    if (!active) throw new Error('Usuário inativo ou bloqueado')
  } catch {
    reply.code(401).send({ error: 'Não autorizado' })
  }
})

app.register(authRoutes, { prefix: '/api/auth' })
app.register(sessionRoutes, { prefix: '/api/session' })
app.register(groupsRoutes, { prefix: '/api/groups' })
app.register(credentialsRoutes, { prefix: '/api/credentials' })
app.register(paymentsRoutes, { prefix: '/api/payments' })
app.register(configRoutes, { prefix: '/api/config' })
app.register(broadcastRoutes, { prefix: '/api/broadcast' })
app.register(dashboardRoutes, { prefix: '/api/dashboard' })
app.register(logsRoutes, { prefix: '/api/logs' })
app.register(adminRoutes, { prefix: '/api/admin' })
app.register(publicRoutes, { prefix: '/api/public' })

// Liveness: processo está de pé
app.get('/health', () => ({ ok: true }))

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
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
await resumePersistedBots(db, app.log).catch(err => {
  app.log.error({ err: err.message }, 'Falha ao retomar sessões WhatsApp persistidas')
})

async function shutdown(signal) {
  app.log.info({ signal }, 'Encerrando API com parada graciosa')
  stopAllBots()
  await app.close()
  await db.$disconnect()
}

process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })
