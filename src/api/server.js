import 'dotenv/config'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'
import fastifyRateLimit from '@fastify/rate-limit'
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
import { adminEmailsRoutes } from './routes/adminEmails.js'
import { publicRoutes } from './routes/public.js'
import { clickTrackerRoutes } from './routes/clickTracker.js'
import { preservationRoutes } from './routes/preservation.js'
import { offerAutomationRoutes } from './routes/offerAutomation.js'
import { offerQueueRoutes } from './routes/offerQueue.js'
import { affiliateRoutes } from './routes/affiliate.js'
import { startOfferAutomationCron } from '../offerAutomation/cron.js'
import { startOfferQueueCron } from '../offerQueue/cron.js'
import { registerApiMetricsHooks, renderPrometheusMetrics, isPrivateAddress } from './metrics.js'
import { getSupervisorOperationalCounters } from '../supervisor/operationalCounters.js'
import { startDlqMaintenanceJob, getDlqMaintenanceSnapshot } from '../jobs/dlqMaintenance.js'
import db from '../db.js'
import { revokeTokenJtiGlobal, isTokenRevokedGlobal } from '../core/tokenRevocationStore.js'
import { validateEncryptionKey } from '../credentialCrypto.js'
import { resumePersistedBots, startSessionHealthMonitor, stopAllBots, isSupervisorAlive, getSupervisorBootedAtMs, listRunningBots, SUPERVISOR_MODE } from '../manager.js'
import { shouldWarnModeRegression } from '../ops/modeRegressionGuard.js'
import { describeStaleWorkerCode, shouldWarnStaleWorkerCode } from '../ops/staleWorkerCodeGuard.js'
import { getCodeChangedAtMs } from '../ops/codeVersion.js'
import { trackAnalyticsEventSafe } from '../analytics.js'
import { runNurtureSweep } from '../leadNurture/sweep.js'
import { runCredentialExpirySweep } from '../credentialExpiry/sweep.js'
import { runSessionCapacityAlertSweep } from '../ops/sessionCapacityAlertSweep.js'
import { sendMail, isEmailConfigured } from '../email/mailer.js'
import { leadNurtureRoutes } from './routes/leadNurture.js'
import { emailPrefsRoutes } from './routes/emailPrefs.js'
import { shopeeSalesRoutes } from './routes/shopeeSales.js'
import { runEmailQueueTick } from '../email/queue.js'
import { runLifecycleEmailSweep } from '../emailTriggers/lifecycleSweep.js'
import { runPairingStalledSweep } from '../emailTriggers/pairingStalledSweep.js'
import { runWeeklySummarySweep } from '../emailTriggers/weeklySummary.js'
import { startCapacitySweep } from '../ops/capacity/sweep.js'
import { createCapacityRepository } from '../ops/capacity/repository.js'
import { createHetznerClient, manualCapacityContractFromEnv } from '../ops/capacity/hetznerClient.js'
import { evaluateCapacityAlerts } from '../ops/capacity/alerts.js'
import { resolveDeploymentRevision } from '../ops/capacity/deploymentMarker.js'
import { resolveProcessRoots } from '../ops/capacity/processMetrics.js'

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

// Trilha de nutrição de leads (011-lead-nurture-emails): passada diária
// in-process, mesmo padrão de startLogRetentionJob/startActivityCacheCleanup
// (setInterval + unref, sem processo/worker/Redis novo — AGENTS.md "Política
// de memória"). Envs opcionais aditivas, sem mudança de .env de ambiente:
//   LEAD_NURTURE_SWEEP_INTERVAL_MS — intervalo entre passadas (default 24h).
//   LEAD_NURTURE_GO_LIVE_AT        — ISO opcional; filtra leads cadastrados
//                                     antes dessa data (evita reenviar a
//                                     trilha para a base histórica no go-live).
const LEAD_NURTURE_SWEEP_INTERVAL_MS = Math.max(Number(process.env.LEAD_NURTURE_SWEEP_INTERVAL_MS) || 24 * 60 * 60 * 1000, 60 * 1000)
async function runLeadNurtureSweepTick() {
  try {
    const summary = await runNurtureSweep({
      db,
      sendMail,
      secret: process.env.JWT_SECRET,
      baseUrl: process.env.DASHBOARD_URL || process.env.API_URL,
      logger: app.log,
    })
    if (summary.sent > 0 || summary.failed > 0) {
      app.log.info({ ...summary }, 'lead-nurture: passada concluída')
    }
  } catch (err) {
    app.log.error({ err: err.message }, 'lead-nurture: passada falhou')
  }
}
function startLeadNurtureSweep() {
  runLeadNurtureSweepTick()
  const timer = setInterval(runLeadNurtureSweepTick, LEAD_NURTURE_SWEEP_INTERVAL_MS)
  timer.unref?.()
}

// Aviso de código de acesso vencido (Mercado Livre / Amazon): passada diária
// in-process, MESMO padrão de startLeadNurtureSweep (setInterval + unref, sem
// processo/worker/Redis novo — AGENTS.md "Política de memória"). Envs opcionais
// aditivas, sem mudança obrigatória de .env:
//   CREDENTIAL_EXPIRY_ALERT_ENABLED        — 'false' desliga (default ligado).
//   CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS    — intervalo entre passadas (default 24h).
//   CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS  — silêncio por loja/cliente (default 7).
// Sem SMTP configurado a passada nem começa: o envio seria no-op e a sondagem
// gastaria chamada (e rotação de código de acesso) à toa.
const CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS = Math.max(Number(process.env.CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS) || 24 * 60 * 60 * 1000, 60 * 1000)
function credentialExpiryAlertEnabled() {
  return String(process.env.CREDENTIAL_EXPIRY_ALERT_ENABLED ?? '').trim().toLowerCase() !== 'false'
}
async function runCredentialExpirySweepTick() {
  if (!credentialExpiryAlertEnabled() || !isEmailConfigured()) return
  try {
    const [{ checkMercadoLivreSession }, { checkAmazonSession }, { checkShopeeSession }, mlCache, amazonCache] = await Promise.all([
      import('../converters/mercadolivre.js'),
      import('../converters/amazon.js'),
      import('../converters/shopee.js'),
      import('../converters/mercadolivreSessionProbeCache.js'),
      import('../converters/amazonSessionProbeCache.js'),
    ])
    const summary = await runCredentialExpirySweep({
      db,
      sendMail,
      // Shopee não tem cache de sondagem: diferente do ML/Amazon, a consulta é
      // só leitura e não rotaciona credencial, então não há o que preservar.
      checkers: { mercadolivre: checkMercadoLivreSession, amazon: checkAmazonSession, shopee: checkShopeeSession },
      probeCaches: { mercadolivre: mlCache, amazon: amazonCache },
      logger: app.log,
    })
    if (summary.sent > 0 || summary.failed > 0) {
      app.log.info({ ...summary }, 'credential-expiry: passada concluída')
    }
  } catch (err) {
    app.log.error({ err: err.message }, 'credential-expiry: passada falhou')
  }
}
function startCredentialExpirySweep() {
  runCredentialExpirySweepTick()
  const timer = setInterval(runCredentialExpirySweepTick, CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS)
  timer.unref?.()
}

// Aviso "está acabando vaga de robô" (default: faltando 2 para o teto).
// In-process, setInterval + unref — sem processo PM2 novo (política de
// memória). Contagem indisponível ou sem SMTP: não avisa e não queima o
// cooldown. Ver src/ops/sessionCapacityAlertPolicy.js.
//   CAPACITY_ALERT_ENABLED           — 'false' desliga.
//   CAPACITY_ALERT_FREE_SLOTS        — vagas livres que disparam (default 2).
//   CAPACITY_ALERT_COOLDOWN_HOURS    — janela anti-spam (default 12h).
//   CAPACITY_ALERT_SWEEP_INTERVAL_MS — intervalo entre passadas (default 15min).
// O destinatário vem de ADMIN_ALERT_EMAIL (caminho de aviso interno).
const CAPACITY_ALERT_SWEEP_INTERVAL_MS = Math.max(Number(process.env.CAPACITY_ALERT_SWEEP_INTERVAL_MS) || 15 * 60 * 1000, 60 * 1000)
async function runSessionCapacityAlertTick() {
  try {
    const summary = await runSessionCapacityAlertSweep({ db, listRunningBots, logger: app.log })
    if (summary.sent > 0) app.log.warn({ ...summary }, 'aviso de vagas: passada concluída')
  } catch (err) {
    app.log.error({ err: err.message }, 'aviso de vagas: passada falhou')
  }
}
function startSessionCapacityAlertSweep() {
  const timer = setInterval(runSessionCapacityAlertTick, CAPACITY_ALERT_SWEEP_INTERVAL_MS)
  timer.unref?.()
}

// E-mails de ciclo de vida (vencimento de teste/plano, saúde do robô, saque
// disponível): uma passada por dia, in-process. Sem SMTP a passada nem começa.
//   LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS — intervalo entre passadas (default 24h).
//   LIFECYCLE_EMAIL_ENABLED           — 'false' desliga.
const LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS = Math.max(Number(process.env.LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS) || 24 * 60 * 60 * 1000, 60 * 1000)
async function runLifecycleEmailTick() {
  if (String(process.env.LIFECYCLE_EMAIL_ENABLED ?? '').trim().toLowerCase() === 'false') return
  if (!isEmailConfigured()) return
  try {
    const summary = await runLifecycleEmailSweep({ db, sendMail, logger: app.log })
    if (summary.sent > 0 || summary.failed > 0) {
      app.log.info({ ...summary }, 'e-mails de ciclo de vida: passada concluída')
    }
    // B2 do plano de ativação: quem PEDIU a conexão e não conseguiu é obstáculo
    // nosso, e esse número só aparecia para quem abrisse o /admin/funil. Pega
    // carona no mesmo tick — nenhum processo PM2 novo, nenhum timer novo.
    const travadas = await runPairingStalledSweep({ db, sendMail, logger: app.log })
    if (travadas.found > 0) {
      app.log.warn({ ...travadas }, 'contas que pediram a conexão e não conectaram')
    }
  } catch (err) {
    app.log.error({ err: err.message }, 'e-mails de ciclo de vida: passada falhou')
  }
}
function startLifecycleEmailSweep() {
  runLifecycleEmailTick()
  const timer = setInterval(runLifecycleEmailTick, LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS)
  timer.unref?.()
}

// Resumo semanal: a passada roda junto (mesmo intervalo), mas só AGE no dia da
// semana escolhido (WEEKLY_SUMMARY_WEEKDAY, default segunda).
//   WEEKLY_SUMMARY_ENABLED — 'false' desliga.
async function runWeeklySummaryTick() {
  if (String(process.env.WEEKLY_SUMMARY_ENABLED ?? '').trim().toLowerCase() === 'false') return
  if (!isEmailConfigured()) return
  try {
    const summary = await runWeeklySummarySweep({ db, sendMail, logger: app.log })
    if (summary.sent > 0 || summary.failed > 0) {
      app.log.info({ ...summary }, 'resumo semanal: passada concluída')
    }
  } catch (err) {
    app.log.error({ err: err.message }, 'resumo semanal: passada falhou')
  }
}
function startWeeklySummarySweep() {
  const timer = setInterval(runWeeklySummaryTick, LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS)
  timer.unref?.()
}

// Fila lenta dos disparos manuais de e-mail (aba E-mails do admin). Mesmo
// padrão dos demais jobs in-process: setInterval + unref, sem processo PM2 novo.
// O estado mora no banco, então reinício da API não perde a campanha.
//   EMAIL_QUEUE_TICK_MS      — intervalo entre rodadas (default 60s).
//   EMAIL_QUEUE_BATCH_SIZE   — e-mails por rodada (default 10 → ~600/h).
//   EMAIL_DAILY_CAP          — teto de envios em 24h (default 250).
const EMAIL_QUEUE_TICK_MS = Math.max(Number(process.env.EMAIL_QUEUE_TICK_MS) || 60_000, 10_000)
async function runEmailQueueTickSafe() {
  if (!isEmailConfigured()) return
  try {
    const summary = await runEmailQueueTick({ db, sendMail, logger: app.log })
    if (summary.sent > 0 || summary.failed > 0) {
      app.log.info({ ...summary }, 'fila de e-mail: rodada concluída')
    }
  } catch (err) {
    app.log.error({ err: err.message }, 'fila de e-mail: rodada falhou')
  }
}
function startEmailQueueJob() {
  const timer = setInterval(runEmailQueueTickSafe, EMAIL_QUEUE_TICK_MS)
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

// API-1: rate limiting global por IP. Baseline anti-abuso (spam de /register,
// brute-force de /payments/recover, scraping de endpoints caros). Limites
// específicos mais apertados já existem in-route em /login e /link-conversion;
// este é o teto geral. Probes de orquestração (health/ready/metrics) ficam fora.
// trustProxy=true já resolve req.ip a partir de X-Forwarded-For do proxy local.
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX || 300))
const RATE_LIMIT_WINDOW = String(process.env.RATE_LIMIT_WINDOW || '1 minute')
const RATE_LIMIT_ALLOWLIST = new Set(['/health', '/ready', '/metrics'])
await app.register(fastifyRateLimit, {
  global: true,
  max: RATE_LIMIT_MAX,
  timeWindow: RATE_LIMIT_WINDOW,
  allowList: (req) => RATE_LIMIT_ALLOWLIST.has(req.url),
  keyGenerator: (req) => req.ip,
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

// D-3: exige chave de criptografia de credenciais no boot (mesma postura do JWT).
// Sem ela, credenciais novas seriam gravadas em texto puro e as cifradas não
// poderiam ser lidas. Em dev/test sem a env, encrypt/decrypt são no-ops.
try {
  validateEncryptionKey()
} catch (err) {
  app.log.fatal({ err: err.message }, 'Chave de criptografia de credenciais ausente/inválida.')
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
app.register(adminEmailsRoutes, { prefix: '/api/admin/emails' })
app.register(publicRoutes, { prefix: '/api/public' })
app.register(preservationRoutes, { prefix: '/api/preservation' })
app.register(offerAutomationRoutes, { prefix: '/api/offer-automations' })
app.register(offerQueueRoutes, { prefix: '/api/offer-queues' })
app.register(clickTrackerRoutes) // sem prefix — /r/:hash precisa estar na raiz
app.register(affiliateRoutes, { prefix: '/api' })
app.register(leadNurtureRoutes, { prefix: '/api/lead-nurture' })
app.register(emailPrefsRoutes, { prefix: '/api/emails' })
app.register(shopeeSalesRoutes, { prefix: '/api/shopee-sales' })

// Liveness: processo está de pé
app.get('/health', () => ({ ok: true }))

// Prometheus scrape endpoint. Fora do rate limit global (allowlist), então
// precisa de proteção própria: METRICS_TOKEN exige Authorization: Bearer;
// sem token configurado, só loopback/rede privada pode ler (o scraper local
// continua funcionando, mas a internet não enxerga contadores operacionais).
const METRICS_TOKEN = String(process.env.METRICS_TOKEN ?? '').trim()
app.get('/metrics', async (req, reply) => {
  if (METRICS_TOKEN) {
    const provided = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
    if (provided !== METRICS_TOKEN) return reply.code(401).send('unauthorized\n')
  } else if (!isPrivateAddress(req.ip)) {
    return reply.code(403).send('forbidden\n')
  }
  reply
    .code(200)
    .header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
    .send(renderPrometheusMetrics({
      ...(await getSupervisorOperationalCounters()),
      dlqTotal: getDlqMaintenanceSnapshot().lastKnownDlqTotal,
      supervisorMode: SUPERVISOR_MODE,
      supervisorAlive: await isSupervisorAlive(),
    }))
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
  // Em produção, subir sem banco = processo "online" no PM2 mas quebrado para
  // todo request (instância única, sem LB respeitando /ready). Falhar o boot
  // torna a quebra visível no deploy/PM2. ALLOW_DEGRADED_BOOT=1 é o escape
  // explícito para cenários de recuperação manual.
  const isProductionEnv = (process.env.APP_ENV || process.env.NODE_ENV) === 'production'
  if (isProductionEnv && process.env.ALLOW_DEGRADED_BOOT !== '1') {
    app.log.error('Banco indisponível em produção — abortando boot. Rode "npx prisma migrate deploy" (ou ALLOW_DEGRADED_BOOT=1 para subir degradado de propósito).')
    process.exit(1)
  }
  app.log.warn('API iniciada em modo degradado: execute "npx prisma migrate deploy" e reinicie quando o banco estiver pronto')
}

// Guard anti-reversão de modo (RCA docs/rca-sessoes-whatsapp-caindo-2026-07.md
// — Trilho C): produção só está blindada contra queda por deploy quando
// BOT_SUPERVISOR_MODE=remote. Se o `.env` voltar para `inline` (ou vazio)
// com sessão já conectada, o próximo deploy vai derrubá-la sem aviso —
// registrar aqui em vez de descobrir pelo spam de "A sincronização foi
// concluída" no celular da cliente.
if (databaseReadyAtBoot) {
  const capacityRepository = createCapacityRepository(db)
  const deploymentRevision = await resolveDeploymentRevision()
  const capacityProcessRoots = resolveProcessRoots(process.env)
  startCapacitySweep({ db, repository: capacityRepository, logger: app.log,
    deploymentRevision,
    collectOptions: {
      processOptions: { roots: capacityProcessRoots },
      collectDatabase: async () => {
        const [connectedSessions, activeCustomers] = await Promise.all([
          db.waSession.count({ where: { status: 'connected' } }),
          db.user.count({ where: { status: 'active' } }),
        ])
        return { connectedSessions, activeCustomers }
      },
    },
    refreshInventory: async (host) => {
      const parseInventory = (profile) => { try { return JSON.parse(profile?.inventoryJson || '{}') } catch { return {} } }
      const loadCache = async () => {
        const current = await capacityRepository.getHostProfile(host.id) || host
        return { inventory: parseInventory(current), checkedAt: current.checkedAt, lastSuccessAt: current.lastSuccessAt, source: current.source, profile: current }
      }
      const client = createHetznerClient({ serverId: process.env.HCLOUD_SERVER_ID || host.providerServerId, baseline: parseInventory(host), manual: manualCapacityContractFromEnv(), loadCache, saveCache: (cache) => capacityRepository.updateHostInventory(host.id, cache) })
      const result = await client.inventory(); if (result.errorCode) await capacityRepository.updateHostInventory(host.id, result)
      return result
    },
    evaluateAlerts: (snapshot, host, previous) => evaluateCapacityAlerts({ repository: capacityRepository, host, snapshot, previous, notify: (alert) => {
      const metadata = { type: alert.type, severity: alert.severity, recovered: Boolean(alert.recovered) }
      app.log[alert.recovered ? 'info' : 'error'](metadata, alert.recovered ? 'capacity: alerta administrativo recuperado' : 'capacity: alerta administrativo ativo')
      trackAnalyticsEventSafe({ event: 'ops_capacity_alert', metadata })
    } }),
  })
  try {
    const appEnv = process.env.APP_ENV || process.env.NODE_ENV
    const hasConnectedSession = (await db.waSession.count({ where: { status: 'connected' } })) > 0
    if (shouldWarnModeRegression({ appEnv, supervisorMode: SUPERVISOR_MODE, hasConnectedSession })) {
      app.log.error({ supervisorMode: SUPERVISOR_MODE }, 'BOT_SUPERVISOR_MODE não é "remote" em produção com sessão conectada — deploy vai derrubar sessões (ver AGENTS.md, Processos PM2)')
      trackAnalyticsEventSafe({ event: 'ops_mode_regression', metadata: { supervisorMode: SUPERVISOR_MODE } })
    }
  } catch (err) {
    app.log.warn({ err: err.message }, 'Falha ao checar guard anti-reversão de modo')
  }
}

// Aviso "código novo não carregado pelos bots" (RCA 2026-08).
//
// Em modo `remote` o deploy reinicia a API mas NÃO o bot-supervisor — de
// propósito, para não derrubar as sessões. O preço é que correção no
// bot-worker/pipeline de mensagem fica no disco sem valer, e isso era
// totalmente silencioso: três fixes seguidos chegaram em `main`, o deploy
// ficou verde, e os workers seguiram dias com o código anterior.
//
// A API roda esta checagem logo depois do boot, que é exatamente o momento
// útil: ela acabou de subir com o código novo, então se o supervisor é mais
// velho que o código, os bots estão desatualizados. Só avisa — reiniciar o
// supervisor reconecta todas as sessões e é decisão humana (AGENTS.md).
async function warnIfWorkersRunStaleCode() {
  try {
    const [supervisorBootedAtMs, codeChangedAtMs] = await Promise.all([
      getSupervisorBootedAtMs(),
      getCodeChangedAtMs(),
    ])
    if (!shouldWarnStaleWorkerCode({ supervisorMode: SUPERVISOR_MODE, supervisorBootedAtMs, codeChangedAtMs })) return

    app.log.error(
      {
        supervisorMode: SUPERVISOR_MODE,
        supervisorBootedAt: new Date(supervisorBootedAtMs).toISOString(),
        codeChangedAt: new Date(codeChangedAtMs).toISOString(),
        acao: 'pm2 restart bot-supervisor --update-env',
      },
      describeStaleWorkerCode({ supervisorBootedAtMs, codeChangedAtMs }),
    )
    trackAnalyticsEventSafe({
      event: 'ops_stale_worker_code',
      metadata: {
        supervisorMode: SUPERVISOR_MODE,
        staleMinutes: Math.round((codeChangedAtMs - supervisorBootedAtMs) / 60_000),
      },
    })
  } catch (err) {
    app.log.warn({ err: err.message }, 'Falha ao checar se os bots estão com código desatualizado')
  }
}

// Adiado (e `unref()`) de propósito: a checagem depende do client Redis do
// supervisor estar conectado e NÃO pode atrasar nem derrubar o boot da API.
// Se o supervisor ainda não respondeu, o guard trata como "sem dado" e não
// avisa — melhor perder um aviso do que emitir alarme falso.
const STALE_CODE_CHECK_DELAY_MS = Math.max(5_000, Number(process.env.STALE_CODE_CHECK_DELAY_MS || 20_000))
setTimeout(() => { warnIfWorkersRunStaleCode() }, STALE_CODE_CHECK_DELAY_MS).unref?.()

startLogRetentionJob()
startActivityCacheCleanup()
startLeadNurtureSweep()
startCredentialExpirySweep()
startSessionCapacityAlertSweep()
startEmailQueueJob()
startLifecycleEmailSweep()
startWeeklySummarySweep()
startProbeWatchdogJob()
startOfferAutomationCron()
startOfferQueueCron()
const stopDlqMaintenance = startDlqMaintenanceJob({ db })
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
const stopSessionHealthMonitor = startSessionHealthMonitor(db, app.log)
await resumePersistedBots(db, app.log).catch(err => {
  app.log.error({ err: err.message }, 'Falha ao retomar sessões WhatsApp persistidas')
})

async function shutdown(signal) {
  app.log.info({ signal }, 'Encerrando API com parada graciosa')
  stopSessionHealthMonitor()
  stopDlqMaintenance()
  stopAllBots()
  if (activityCacheCleanupTimer) clearInterval(activityCacheCleanupTimer)
  await app.close()
  await db.$disconnect()
}

process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })
