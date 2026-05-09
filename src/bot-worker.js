import 'dotenv/config'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  extractMessageContent,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { readFileSync, mkdirSync } from 'fs'
import { rm, writeFile } from 'fs/promises'
import { dirname } from 'path'

import logger from './logger.js'
import { detectLinks } from './detector.js'
import { convertLink } from './converters/index.js'
import { fetchProductImage, fetchImageBuffer, normalizeImageForWhatsApp } from './converters/imageScrapers.js'
import db from './db.js'
import { getAuthInfoDir, getDedupFile } from './paths.js'
import { trackAnalyticsEventSafe } from './analytics.js'
import { createMessageQueue } from './messageQueue.js'

const userId = process.env.BOT_USER_ID
if (!userId) { logger.error('BOT_USER_ID não definido'); process.exit(1) }

let activeSock = null
let pendingSock = null  // socket criado mas ainda não conectado (disponível para pairing code)
let shuttingDown = false

const OWNER_INSTANCE = process.env.pm_id != null
  ? `pm2:${process.env.pm_id}`
  : (process.env.NODE_APP_INSTANCE != null ? `app:${process.env.NODE_APP_INSTANCE}` : `pid:${process.pid}`)

let heartbeatTimer = null

async function persistSessionPatch(data) {
  await db.waSession.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
}

function startHeartbeat() {
  if (heartbeatTimer) return
  const intervalMs = Math.max(Number(process.env.WA_HEARTBEAT_INTERVAL_MS || 15000), 5000)
  heartbeatTimer = setInterval(() => {
    persistSessionPatch({
      lastHeartbeatAt: new Date(),
      ownerInstance: OWNER_INSTANCE,
      lifecycle: activeSock ? 'ready' : (pendingSock ? 'authenticating' : 'disconnected'),
    }).catch(() => {})
  }, intervalMs)
  heartbeatTimer.unref?.()
}

function stopHeartbeat() {
  if (!heartbeatTimer) return
  clearInterval(heartbeatTimer)
  heartbeatTimer = null
}


const AUTH_DIR = getAuthInfoDir(userId)
const DEDUP_FILE = getDedupFile(userId)
const DEDUP_FLUSH_DEBOUNCE_MS = 1_000

let pendingDedupStore = null
let dedupFlushTimer = null
let dedupFlushPromise = Promise.resolve()

function normalizeDedup(store) {
  return {
    msgIds: Array.isArray(store?.msgIds) ? store.msgIds : [],
    links: store?.links && typeof store.links === 'object' ? store.links : {},
  }
}

function loadDedup() {
  try { return normalizeDedup(JSON.parse(readFileSync(DEDUP_FILE, 'utf8'))) }
  catch { return { msgIds: [], links: {} } }
}

function scheduleDedupSave(store) {
  pendingDedupStore = store
  if (dedupFlushTimer) return

  dedupFlushTimer = setTimeout(() => {
    dedupFlushTimer = null
    flushDedupNow().catch(err => {
      logger.error({ err: err.message }, 'Erro ao persistir deduplicação')
    })
  }, DEDUP_FLUSH_DEBOUNCE_MS)
  dedupFlushTimer.unref?.()
}

async function flushDedupNow() {
  if (dedupFlushTimer) {
    clearTimeout(dedupFlushTimer)
    dedupFlushTimer = null
  }
  if (!pendingDedupStore) return dedupFlushPromise

  const snapshot = JSON.stringify(pendingDedupStore)
  pendingDedupStore = null
  const writePromise = dedupFlushPromise.catch(() => {}).then(async () => {
    mkdirSync(dirname(DEDUP_FILE), { recursive: true })
    await writeFile(DEDUP_FILE, snapshot, 'utf8')
  })
  dedupFlushPromise = writePromise.catch(() => {})
  return writePromise
}

const sleep = ms => new Promise(res => setTimeout(res, ms))

// Config cache com TTL de 60s
let configCache = null
let configCacheTime = 0

async function loadConfig() {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { groups: true, credentials: true, botConfig: true, groupTargets: { include: { post: true } } },
  })
  if (!user) throw new Error(`Usuário ${userId} não encontrado`)

  if (user.accessExpiresAt && user.accessExpiresAt < new Date()) {
    if (process.send) process.send({ type: 'status', data: 'blocked' })
    logger.error('Acesso expirado — bot bloqueado')
    process.exit(0)
  }

  const credentials = {}
  for (const c of user.credentials) {
    try {
      credentials[c.platform] = JSON.parse(c.data)
    } catch (err) {
      logger.warn({ platform: c.platform, err: err.message }, 'Credencial inválida ignorada')
    }
  }

  const targetsByMonitor = new Map()
  for (const target of user.groupTargets) {
    if (!targetsByMonitor.has(target.monitorId)) targetsByMonitor.set(target.monitorId, [])
    if (target.post?.waJid) targetsByMonitor.get(target.monitorId).push(target.post.waJid)
  }

  const groups = {
    monitor: user.groups.filter(g => g.role === 'monitor').map(g => ({
      id: g.id,
      waJid: g.waJid,
      imageMode: g.imageMode,
      imageLinkTarget: g.imageLinkTarget,
      fallbackToOriginal: g.fallbackToOriginal,
      blockedKeywords: g.blockedKeywords,
      allowedPlatforms: g.allowedPlatforms,
      targetPostJids: targetsByMonitor.get(g.id) ?? [],
    })),
    monitorJids: user.groups.filter(g => g.role === 'monitor').map(g => g.waJid),
    post: user.groups.filter(g => g.role === 'post').map(g => g.waJid),
    postDetails: user.groups.filter(g => g.role === 'post').map(g => ({ waJid: g.waJid, welcomeMsg: g.welcomeMsg })),
  }

  const botConfig = user.botConfig ?? {
    delayMin: 5,
    delayMax: 15,
    platforms: 'shopee,amazon,mercadolivre,magazineluiza',
    blockedKeywords: '',
    welcomeMsg: '',
    feedGlobal: false,
    postToStatus: false,
  }

  return { credentials, groups, plan: user.plan, botConfig }
}

async function getConfig() {
  if (!configCache || Date.now() - configCacheTime > 60_000) {
    configCache = await loadConfig()
    configCacheTime = Date.now()
  }
  return configCache
}

// Checa e enfileira mensagens agendadas pendentes
let scheduledCheckRunning = false
async function checkScheduledMessages() {
  if (!activeSock || scheduledCheckRunning) return
  scheduledCheckRunning = true
  try {
    const pending = await db.scheduledMessage.findMany({
      where: { userId, status: 'pending', scheduledAt: { lte: new Date() } },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    })

    for (const msg of pending) {
      const claimed = await db.scheduledMessage.updateMany({
        where: { id: msg.id, userId, status: 'pending' },
        data: { status: 'queued' },
      })
      if (claimed.count !== 1) continue

      const jids = JSON.parse(msg.targetJids)
      const state = { remaining: jids.length, hasError: false }

      for (const jid of jids) {
        const log = await db.messageLog.create({
          data: {
            userId,
            platform: 'scheduled',
            sourceGroup: 'scheduled',
            destGroup: jid,
            originalUrl: '',
            convertedUrl: '',
            messageText: msg.text,
            status: 'queued',
          },
        })

        const accepted = enqueueSendJob({
          type: 'scheduled',
          logId: log.id,
          destJid: jid,
          platforms: 'scheduled',
          imageMode: 'none',
          plan: 'scheduled',
          delayMs: 0,
          buildPayload: async () => ({ text: msg.text }),
          onDone: async (result) => {
            state.remaining--
            if (!result.ok) state.hasError = true
            if (state.remaining === 0) {
              await db.scheduledMessage.update({
                where: { id: msg.id },
                data: { status: state.hasError ? 'failed' : 'sent', sentAt: new Date() },
              })
            }
          },
        })

        if (!accepted) {
          state.remaining--
          state.hasError = true
          await db.messageLog.update({
            where: { id: log.id },
            data: { status: 'error', errorMsg: 'Fila interna de envios cheia ou worker encerrando', sentAt: new Date() },
          }).catch(() => {})
        }
      }

      if (state.remaining === 0) {
        await db.scheduledMessage.update({
          where: { id: msg.id },
          data: { status: 'failed', sentAt: new Date() },
        })
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao processar agendamentos')
  } finally {
    scheduledCheckRunning = false
  }
}

setInterval(checkScheduledMessages, 30_000)

const INVITE_RE = /🚀?\s*Participe do Grupo[:\s]+https:\/\/chat\.whatsapp\.com\/\S+/gi

function buildMessage(originalText, convertedUrl, originalUrl, groupInvite) {
  let text = originalText.replace(originalUrl, convertedUrl).trimEnd()
  if (!groupInvite) return text
  if (INVITE_RE.test(text)) {
    INVITE_RE.lastIndex = 0
    text = text.replace(INVITE_RE, `🚀 Participe do Grupo: ${groupInvite}`)
  } else {
    text = `${text}\n🚀 Participe do Grupo: ${groupInvite}`
  }
  return text
}

const AD_TEXT = '💡 Bot gerenciado pelo Bot Conversor para Afiliados — automatize seus grupos de afiliados'
function envNumber(name, fallback) {
  if (process.env[name] === undefined) return fallback
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

const SEND_QUEUE_MAX_SIZE = envNumber('SEND_QUEUE_MAX_SIZE', 1_000)
const SEND_MAX_ATTEMPTS = Math.max(1, envNumber('SEND_MAX_ATTEMPTS', 3))
const SEND_RETRY_BASE_MS = Math.max(0, envNumber('SEND_RETRY_BASE_MS', 2_000))
const SEND_RETRY_MAX_MS = Math.max(SEND_RETRY_BASE_MS, envNumber('SEND_RETRY_MAX_MS', 30_000))
const DEST_RATE_LIMIT_MS = Math.max(0, envNumber('DEST_RATE_LIMIT_MS', 1_000))
const MSG_QUEUE_CONCURRENCY = Math.max(1, envNumber('MSG_QUEUE_CONCURRENCY', 2))
const MSG_QUEUE_TIMEOUT_MS = Math.max(1_000, envNumber('MSG_QUEUE_TIMEOUT_MS', 15_000))
const MSG_QUEUE_WATCHDOG_MS = Math.max(5_000, envNumber('MSG_QUEUE_WATCHDOG_MS', 30_000))
const MSG_QUEUE_MAX_SIZE = Math.max(10, envNumber('MSG_QUEUE_MAX_SIZE', 500))


const WA_LIFECYCLE = Object.freeze({
  INITIALIZING: 'initializing',
  AUTHENTICATING: 'authenticating',
  READY: 'ready',
  DISCONNECTED: 'disconnected',
})

let lifecycleState = WA_LIFECYCLE.DISCONNECTED

function setLifecycleState(next, meta = {}) {
  if (lifecycleState === next) return
  const prev = lifecycleState
  lifecycleState = next
  logger.info({ prev, next, ...meta }, 'WA lifecycle transition')
  if (process.send) process.send({ type: 'lifecycle', data: next, prev, meta })
}

const incomingQueue = createMessageQueue({
  name: 'incoming-messages',
  concurrency: MSG_QUEUE_CONCURRENCY,
  taskTimeoutMs: MSG_QUEUE_TIMEOUT_MS,
  watchdogStallMs: MSG_QUEUE_WATCHDOG_MS,
  maxSize: MSG_QUEUE_MAX_SIZE,
})

const sendQueue = []
const lastSendByDest = new Map()
let sendQueueProcessing = false
let interruptedSendLogsMarked = false
let adSendCount = 0

const sendMetrics = {
  queuedTotal: 0,
  sendingTotal: 0,
  successTotal: 0,
  errorTotal: 0,
  retryTotal: 0,
  rejectedTotal: 0,
  broadcastQueuedTotal: 0,
  scheduledQueuedTotal: 0,
  convertedQueuedTotal: 0,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  latencyTotalMs: 0,
  latencyCount: 0,
}

function getSendQueueMetrics() {
  return {
    backend: 'memory',
    queueSize: sendQueue.length,
    processing: sendQueueProcessing,
    maxSize: SEND_QUEUE_MAX_SIZE,
    maxAttempts: SEND_MAX_ATTEMPTS,
    retryBaseMs: SEND_RETRY_BASE_MS,
    retryMaxMs: SEND_RETRY_MAX_MS,
    destinationRateLimitMs: DEST_RATE_LIMIT_MS,
    ...sendMetrics,
    avgLatencyMs: sendMetrics.latencyCount ? Math.round(sendMetrics.latencyTotalMs / sendMetrics.latencyCount) : 0,
  }
}

function canAcceptSendJob() {
  return !shuttingDown && sendQueue.length < SEND_QUEUE_MAX_SIZE
}

function enqueueSendJob(job) {
  if (!canAcceptSendJob()) {
    sendMetrics.rejectedTotal++
    return false
  }
  sendQueue.push({ attempts: 0, enqueuedAt: Date.now(), ...job })
  sendMetrics.queuedTotal++
  if (job.type === 'broadcast') sendMetrics.broadcastQueuedTotal++
  else if (job.type === 'scheduled') sendMetrics.scheduledQueuedTotal++
  else sendMetrics.convertedQueuedTotal++
  processSendQueue().catch(err => {
    logger.error({ err: err.message }, 'Erro fatal na fila interna de envios')
  })
  return true
}

async function processSendQueue() {
  if (sendQueueProcessing) return
  sendQueueProcessing = true

  try {
    while (!shuttingDown && sendQueue.length) {
      const job = sendQueue.shift()
      await processSendJob(job)
    }
  } finally {
    sendQueueProcessing = false
    if (!shuttingDown && sendQueue.length) {
      processSendQueue().catch(err => {
        logger.error({ err: err.message }, 'Erro ao retomar fila interna de envios')
      })
    }
  }
}

function getRetryDelayMs(attempt) {
  const exponential = SEND_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1)
  const jitter = Math.floor(Math.random() * SEND_RETRY_BASE_MS)
  return Math.min(SEND_RETRY_MAX_MS, exponential + jitter)
}

async function waitDestinationRateLimit(destJid) {
  if (!DEST_RATE_LIMIT_MS) return
  const lastSentAt = lastSendByDest.get(destJid) ?? 0
  const waitMs = DEST_RATE_LIMIT_MS - (Date.now() - lastSentAt)
  if (waitMs > 0) await sleep(waitMs)
}

async function finishSendJob(job, result) {
  if (typeof job.onDone === 'function') {
    await job.onDone(result).catch(err => {
      logger.error({ err: err.message, destJid: job.destJid, type: job.type }, 'Erro ao finalizar job da fila')
    })
  }
}

async function processSendJob(job) {
  const startedAt = Date.now()
  let payload = null

  try {
    await db.messageLog.update({
      where: { id: job.logId },
      data: { status: 'sending', errorMsg: null },
    })
    sendMetrics.sendingTotal++

    if (job.delayMs > 0) await sleep(job.delayMs)

    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {
      try {
        if (!activeSock) throw new Error('Bot não conectado')
        if (!payload) payload = await job.buildPayload()
        await waitDestinationRateLimit(job.destJid)
        await activeSock.sendMessage(job.destJid, payload)
        lastSendByDest.set(job.destJid, Date.now())
        logger.info({ destJid: job.destJid, platforms: job.platforms, imageMode: job.imageMode, attempt, type: job.type }, 'Mensagem enviada')

        await db.messageLog.update({
          where: { id: job.logId },
          data: { status: 'success', errorMsg: null, sentAt: new Date() },
        })

        sendMetrics.successTotal++
        sendMetrics.lastSuccessAt = new Date().toISOString()
        sendMetrics.latencyTotalMs += Date.now() - startedAt
        sendMetrics.latencyCount++
        await finishSendJob(job, { ok: true })

        if (job.plan === 'basic') {
          adSendCount++
          if (adSendCount % 50 === 0) {
            await activeSock.sendMessage(job.destJid, { text: AD_TEXT }).catch(() => {})
          }
        }
        return
      } catch (err) {
        if (attempt < SEND_MAX_ATTEMPTS && !shuttingDown) {
          const retryDelayMs = getRetryDelayMs(attempt)
          sendMetrics.retryTotal++
          await db.messageLog.update({
            where: { id: job.logId },
            data: { errorMsg: `Tentativa ${attempt} falhou: ${err.message}. Nova tentativa em ${Math.round(retryDelayMs / 1000)}s.` },
          }).catch(() => {})
          logger.warn({ destJid: job.destJid, err: err.message, attempt, retryDelayMs, type: job.type }, 'Falha transitória no envio — tentando novamente')
          await sleep(retryDelayMs)
          continue
        }
        throw err
      }
    }
  } catch (err) {
    logger.error({ destJid: job.destJid, err: err.message, type: job.type }, 'Erro ao enviar mensagem da fila')
    await db.messageLog.update({
      where: { id: job.logId },
      data: { status: 'error', errorMsg: err.message, sentAt: new Date() },
    }).catch(() => {})
    sendMetrics.errorTotal++
    sendMetrics.lastErrorAt = new Date().toISOString()
    sendMetrics.lastError = err.message
    await finishSendJob(job, { ok: false, error: err.message })
  }
}

async function markInterruptedSendLogs() {
  const now = new Date()
  await Promise.all([
    db.messageLog.updateMany({
      where: { userId, status: { in: ['queued', 'sending'] } },
      data: {
        status: 'error',
        errorMsg: 'Envio interrompido por reinício do worker antes da conclusão',
        sentAt: now,
      },
    }),
    db.scheduledMessage.updateMany({
      where: { userId, status: { in: ['queued', 'sending'] } },
      data: { status: 'failed', sentAt: now },
    }),
  ])
}

async function startBot() {
  await getConfig()
  if (!interruptedSendLogsMarked) {
    interruptedSendLogsMarked = true
    await markInterruptedSendLogs()
  }

  const dedupeWindowMs = 300_000
  const dedup = loadDedup()
  const now = Date.now()
  dedup.msgIds = (dedup.msgIds || []).filter(e => now - e.ts < dedupeWindowMs)
  for (const key of Object.keys(dedup.links || {})) {
    if (now - dedup.links[key] >= dedupeWindowMs) delete dedup.links[key]
  }
  scheduleDedupSave(dedup)

  setLifecycleState(WA_LIFECYCLE.INITIALIZING, { reason: 'start_bot' })
  mkdirSync(AUTH_DIR, { recursive: true })
  startHeartbeat()

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: logger.child({ name: 'baileys' }),
  })

  pendingSock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      setLifecycleState(WA_LIFECYCLE.AUTHENTICATING, { reason: 'qr_generated' })
      if (process.send) process.send({ type: 'qr', data: qr })
await persistSessionPatch({ status: 'connecting', lifecycle: 'authenticating', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date() })
    }

    if (connection === 'open') {
      setLifecycleState(WA_LIFECYCLE.READY, { reason: 'connection_open' })
      activeSock = sock
      pendingSock = null
      const phone = sock.user?.id?.split(':')[0] ?? null
      if (process.send) process.send({ type: 'status', data: 'connected', phone })
await persistSessionPatch({ status: 'connected', phone, lifecycle: 'ready', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date(), lastDisconnectCode: null })
      trackAnalyticsEventSafe({ userId, event: 'whatsapp_connected' })
    }

    if (connection === 'close') {
      setLifecycleState(WA_LIFECYCLE.DISCONNECTED, { reason: 'connection_close' })
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      const isLoggedOut = code === DisconnectReason.loggedOut
      activeSock = null
      pendingSock = null
      if (process.send) process.send({ type: 'status', data: 'disconnected' })
await persistSessionPatch({ status: 'disconnected', lifecycle: 'disconnected', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date(), lastDisconnectCode: code != null ? String(code) : null }).catch(() => {})
      if (isLoggedOut) {
        // Sessão revogada/expirada — limpar auth para que próximo start gere QR limpo
        await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {})
        logger.info('Sessão encerrada pelo servidor WA — auth_info limpo automaticamente')
      } else {
        logger.warn({ code }, 'WA conexão fechada, agendando restart automático em 5s')
        setTimeout(startBot, 5_000)
      }
    }
  })

  // Welcome msg quando alguém entra nos grupos de postagem
  sock.ev.on('group-participants.update', async ({ id: groupJid, participants, action }) => {
    if (action !== 'add') return
    const cfg = await getConfig()
    const postGroup = cfg.groups.postDetails.find(g => g.waJid === groupJid)
    const welcomeMsg = postGroup?.welcomeMsg?.trim() || cfg.botConfig.welcomeMsg
    if (!welcomeMsg || !cfg.groups.post.includes(groupJid)) return
    for (const participantJid of participants) {
      try {
        await sock.sendMessage(groupJid, {
          text: welcomeMsg,
          mentions: [participantJid],
        })
        logger.info({ groupJid, participantJid }, 'Welcome msg enviada')
      } catch (err) {
        logger.error({ err: err.message }, 'Erro ao enviar welcome msg')
      }
    }
  })

  async function processIncomingMessage(msg, sock) {
      const jid = msg.key.remoteJid
      const cfg = await getConfig()
      logger.info({ jid, monitorGroups: cfg.groups.monitor, feedGlobal: cfg.botConfig.feedGlobal }, 'mensagem recebida')
      const monitorGroup = cfg.groups.monitor.find(m => m.waJid === jid)
      if (!cfg.botConfig.feedGlobal && !monitorGroup) return
      if (cfg.botConfig.feedGlobal && !String(jid).endsWith('@g.us')) return

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption || ''

      if (!text) return

      // Filtro por palavras bloqueadas (override por grupo monitorado quando preenchido)
      const blockedKeywords = monitorGroup?.blockedKeywords?.trim() || cfg.botConfig.blockedKeywords
      if (blockedKeywords) {
        const blocked = blockedKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        const lower = text.toLowerCase()
        if (blocked.some(kw => lower.includes(kw))) {
          logger.info({ blocked }, 'Mensagem bloqueada por keyword'); return
        }
      }

      const links = detectLinks(text)
      if (!links.length) return

      // Filtro por plataforma (override por grupo monitorado quando preenchido)
      const platformCsv = monitorGroup?.allowedPlatforms?.trim() || cfg.botConfig.platforms
      const enabledPlatforms = new Set(platformCsv.split(',').filter(Boolean))

      // Retorna o proto imageMessage (ou videoMessage) original sem baixar.
      // Permite reaproveitar a mídia já hospedada nos servidores do WhatsApp,
      // trocando apenas o caption — caminho mais confiável que upload+sharp.
      function getOriginalMediaMessage() {
        const inner = extractMessageContent(msg.message)
        const ext = inner?.extendedTextMessage
        const quoted = ext?.contextInfo?.quotedMessage
        if (inner?.imageMessage) return { type: 'imageMessage', proto: inner.imageMessage }
        if (quoted?.imageMessage) return { type: 'imageMessage', proto: quoted.imageMessage }
        if (inner?.videoMessage) return { type: 'videoMessage', proto: inner.videoMessage }
        if (quoted?.videoMessage) return { type: 'videoMessage', proto: quoted.videoMessage }
        return null
      }

      // Baixa a imagem original do anúncio (mensagem do grupo monitorado) já
      // decifrada via Baileys, retornando { buffer, mimetype }. Lida com
      // wrappers (ephemeralMessage etc.), link preview (jpegThumbnail embutido)
      // e mensagens citadas (quotedMessage com imageMessage).
      async function downloadOriginalImage() {
        const inner = extractMessageContent(msg.message)
        const presentTypes = inner ? Object.keys(inner) : []
        const ext = inner?.extendedTextMessage
        const quoted = ext?.contextInfo?.quotedMessage

        // 1) imageMessage direto na própria mensagem — caso ideal, full-res e decifrável.
        if (inner?.imageMessage) {
          try {
            const buf = await downloadMediaMessage(msg, 'buffer', {}, {
              logger, reuploadRequest: sock.updateMediaMessage,
            })
            if (buf?.length) {
              logger.info({ msgId: msg.key.id, size: buf.length, source: 'imageMessage' }, 'Imagem original baixada')
              return { buffer: buf, mimetype: inner.imageMessage.mimetype || 'image/jpeg' }
            }
          } catch (err) {
            logger.warn({ err: err.message, msgId: msg.key.id }, 'Falha ao baixar imageMessage original')
          }
        }

        // 2) imageMessage dentro de uma mensagem citada (quoted) — comum quando
        // bots upstream republicam ofertas como reply de uma mensagem com foto.
        if (quoted?.imageMessage) {
          try {
            const stub = {
              key: { ...msg.key, id: ext.contextInfo.stanzaId || msg.key.id },
              message: quoted,
            }
            const buf = await downloadMediaMessage(stub, 'buffer', {}, {
              logger, reuploadRequest: sock.updateMediaMessage,
            })
            if (buf?.length) {
              logger.info({ msgId: msg.key.id, size: buf.length, source: 'quotedImage' }, 'Imagem original baixada')
              return { buffer: buf, mimetype: quoted.imageMessage.mimetype || 'image/jpeg' }
            }
          } catch (err) {
            logger.warn({ err: err.message, msgId: msg.key.id }, 'Falha ao baixar imagem citada')
          }
        }

        // 3) jpegThumbnail embutido em link preview (extendedTextMessage). Baixa qualidade
        // mas sempre presente quando há preview, e não exige rede — bytes já vêm decifrados.
        const thumb = ext?.jpegThumbnail
        if (thumb && thumb.length) {
          const buf = Buffer.isBuffer(thumb) ? thumb : Buffer.from(thumb)
          logger.info({ msgId: msg.key.id, size: buf.length, source: 'jpegThumbnail' }, 'Usando thumbnail do link preview')
          return { buffer: buf, mimetype: 'image/jpeg' }
        }

        logger.warn({ msgId: msg.key.id, presentTypes }, 'Mensagem sem imagem para reaproveitar')
        return null
      }

      // Pre-fetch da imagem (lazy, uma vez por mensagem). Retorna
      // { buffer, mimetype } pronto para enviar à Baileys.
      let cachedImage
      let imageFetched = false
      async function getImage() {
        if (imageFetched) return cachedImage
        imageFetched = true
        if (!monitorGroup || monitorGroup.imageMode === 'none') return null

        const enabled = links.filter(l => enabledPlatforms.has(l.platform))
        const target = monitorGroup.imageLinkTarget === 'first' ? enabled[0] : enabled[enabled.length - 1]
        const platform = target?.platform || 'unknown'
        logger.info({ msgId: msg.key.id, imageMode: monitorGroup.imageMode, platform }, 'getImage: iniciando resolução de imagem')

        if (monitorGroup.imageMode === 'original') {
          cachedImage = await downloadOriginalImage()
          return cachedImage
        }

        if (monitorGroup.imageMode === 'fetch') {
          // Para Shopee, preferimos a imagem original do anúncio: o CDN da
          // Shopee bloqueia o servidor de mídia do WhatsApp, o que produz
          // imagem quebrada quando passamos URL para Baileys.
          if (platform === 'shopee') {
            cachedImage = await downloadOriginalImage()
            if (cachedImage) return cachedImage
            logger.info({ msgId: msg.key.id }, 'Shopee sem imagem original — tentando resolver via API')
          }

          if (target) {
            const url = await fetchProductImage(target.platform, target.url, cfg.credentials)
            logger.info({ msgId: msg.key.id, platform, resolvedUrl: url }, 'fetchProductImage resultado')
            if (url) {
              cachedImage = await fetchImageBuffer(url, target.url)
              logger.info({ msgId: msg.key.id, downloaded: !!cachedImage, size: cachedImage?.buffer?.length }, 'fetchImageBuffer resultado')
            }
          }

          if (!cachedImage && monitorGroup.fallbackToOriginal) {
            cachedImage = await downloadOriginalImage()
          }
          return cachedImage
        }
        return null
      }

      // Converter todos os links habilitados de uma vez
      const conversions = []
      for (const { platform, url } of links) {
        if (!enabledPlatforms.has(platform)) {
          logger.info({ platform }, 'Plataforma desabilitada — pulando')
          continue
        }
        logger.info({ platform, url }, 'Link detectado')
        const converted = await convertLink(platform, url, cfg.credentials)
        if (!converted) { logger.warn({ platform, url }, 'Conversão falhou'); continue }
        logger.info({ platform, converted }, 'Link convertido')
        conversions.push({ platform, url, converted })
      }

      if (!conversions.length) return

      // Substituir todos os links convertidos no texto original de uma vez
      let finalText = text
      for (const { url, converted } of conversions) {
        finalText = finalText.replace(url, converted)
      }
      finalText = finalText.trimEnd()

      const primary = conversions[0]

      const baseDestinations = monitorGroup?.targetPostJids?.length ? monitorGroup.targetPostJids : cfg.groups.post
      const destinations = cfg.botConfig.postToStatus ? [...baseDestinations, 'status@broadcast'] : baseDestinations
      for (const destJid of destinations) {
        const key = `${destJid}:${primary.url}`
        if (dedup.links[key] && Date.now() - dedup.links[key] < dedupeWindowMs) {
          logger.info({ destJid }, 'Duplicata ignorada'); continue
        }
        dedup.links[key] = Date.now()
        scheduleDedupSave(dedup)

        const platforms = conversions.map(c => c.platform).join('+')
        const logData = {
          userId,
          platform: platforms,
          sourceGroup: jid,
          destGroup: destJid,
          originalUrl: primary.url,
          convertedUrl: primary.converted,
          messageText: finalText,
        }

        // Estratégia preferencial: reaproveitar o proto da mídia original
        // (imageMessage/videoMessage) trocando só o caption e usando relayMessage.
        // Evita sharp/upload (root cause da imagem quebrada) e mantém a mídia
        // já hospedada nos servidores do WhatsApp — recipients decifram com a
        // mediaKey original, exatamente como num forward.
        const wantImage = monitorGroup?.imageMode !== 'none'
        const original = wantImage ? getOriginalMediaMessage() : null

        let sentVia = 'text'
        try {
          if (original) {
            const replayProto = { ...original.proto, caption: finalText }
            await sock.relayMessage(destJid, { [original.type]: replayProto }, {})
            sentVia = `relay:${original.type}`
          } else if (wantImage) {
            // Sem mídia original (ex.: msg só de texto). Tenta resolver via CDN
            // do produto, baixar bytes e re-encodar como JPEG antes de enviar.
            const fetched = await getImage()
            const image = fetched ? await normalizeImageForWhatsApp(fetched.buffer) : null
            if (fetched && !image) {
              logger.warn({ msgId: msg.key.id, srcMime: fetched.mimetype, size: fetched.buffer?.length }, 'normalizeImageForWhatsApp falhou — enviando sem imagem')
            }
            const payload = image
              ? { image: image.buffer, mimetype: image.mimetype, jpegThumbnail: image.jpegThumbnail, caption: finalText }
              : { text: finalText }
            await sock.sendMessage(destJid, payload)
            sentVia = image ? 'upload:image' : 'text'
          } else {
            await sock.sendMessage(destJid, { text: finalText })
          }
          logger.info({ destJid, platforms, imageMode: monitorGroup?.imageMode, sentVia }, 'Mensagem enviada')
          const previousSuccessCount = await db.messageLog.count({ where: { userId, status: 'success' } }).catch(() => 1)
          db.messageLog.create({
            data: { userId, platform: platforms, sourceGroup: jid, destGroup: destJid, originalUrl: primary.url, convertedUrl: primary.converted, messageText: finalText, status: 'success' },
          }).then(() => {
            if (previousSuccessCount === 0) trackAnalyticsEventSafe({ userId, event: 'first_send_success', metadata: { platform: platforms } })
          }).catch(() => {})
          if (cfg.plan === 'basic') {
            adSendCount++
            if (adSendCount % 50 === 0) {
              await sock.sendMessage(destJid, { text: AD_TEXT }).catch(() => {})
            }
          }
        } catch (err) {
          logger.error({ destJid, err: err.message }, 'Erro ao enviar')
          db.messageLog.create({
            data: { userId, platform: platforms, sourceGroup: jid, destGroup: destJid, originalUrl: primary.url, convertedUrl: primary.converted, messageText: finalText, status: 'error', errorMsg: err.message },
          }).then(() => {
            trackAnalyticsEventSafe({ userId, event: 'send_error', metadata: { platform: platforms, errorType: err.name } })
          }).catch(() => {})
          logger.warn({ destJid, queueSize: sendQueue.length }, 'Envio recusado após criação do log queued')
        }
      }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.info({ type, count: messages.length }, 'messages.upsert recebido')
    if (type !== 'notify' && type !== 'append') return
    const cutoff = Date.now() - 30_000

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const msgTs = (msg.messageTimestamp ?? 0) * 1000
      if (msgTs < cutoff) continue
      const msgId = msg.key.id
      if (dedup.msgIds.some(e => e.id === msgId)) continue
      dedup.msgIds.push({ id: msgId, ts: Date.now() })
      scheduleDedupSave(dedup)

      const accepted = incomingQueue.enqueue(() => processIncomingMessage(msg, sock), {
        label: `msg:${msgId}`,
        orderKey: msg.key.remoteJid,
        onError: async (err) => {
          logger.error({ msgId, err: err.message }, 'Mensagem descartada após erro/timeout — fila continua')
        },
      })
      if (!accepted) {
        logger.warn({ msgId, jid: msg.key.remoteJid }, 'Mensagem rejeitada pela fila (cheia ou worker encerrando)')
      }
    }
  })
}


async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  await Promise.all([
    flushDedupNow().catch(err => {
      logger.error({ err: err.message }, 'Erro ao persistir deduplicação antes de encerrar')
    }),
    markInterruptedSendLogs().catch(err => {
      logger.error({ err: err.message }, 'Erro ao marcar envios pendentes como interrompidos')
    }),
  ])
  process.exit(code)
}

process.once('SIGTERM', () => { void shutdown(0) })
process.once('SIGINT', () => { void shutdown(0) })

process.on('message', async msg => {
  if (msg?.type === 'stop') {
    logger.info('Bot parando por solicitação do manager')
    await shutdown(0)
  }

  if (msg?.type === 'reloadConfig') {
    configCache = null
    logger.info('Config recarregada')
  }

  if (msg?.type === 'listGroups') {
    if (!activeSock) {
      process.send({ type: 'groups', requestId: msg.requestId, data: [], error: 'Bot não conectado' })
      return
    }
    activeSock.groupFetchAllParticipating()
      .then(groups => {
        const list = Object.entries(groups).map(([id, g]) => ({ waJid: id, name: g.subject }))
        process.send({ type: 'groups', requestId: msg.requestId, data: list })
      })
      .catch(err => {
        process.send({ type: 'groups', requestId: msg.requestId, data: [], error: err.message })
      })
  }

  if (msg?.type === 'requestPairingCode') {
    let attempts = 0
    const tryRequest = async () => {
      const sock = pendingSock || activeSock
      if (!sock && attempts < 20) {
        attempts++
        setTimeout(tryRequest, 500)
        return
      }
      if (!sock) {
        process.send({ type: 'pairingCode', requestId: msg.requestId, error: 'Bot não disponível' })
        return
      }
      try {
        const code = await sock.requestPairingCode(msg.phone)
        process.send({ type: 'pairingCode', requestId: msg.requestId, code })
      } catch (err) {
        process.send({ type: 'pairingCode', requestId: msg.requestId, error: err.message })
      }
    }
    tryRequest()
  }

  if (msg?.type === 'metrics') {
    process.send({ type: 'metricsResult', requestId: msg.requestId, data: { ...getSendQueueMetrics(), incomingQueue: incomingQueue.getStats() } })
  }

  if (msg?.type === 'broadcast') {
    if (!activeSock) {
      process.send({ type: 'broadcastResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    let queued = 0
    const errors = []
    for (const jid of msg.jids) {
      const log = await db.messageLog.create({
        data: {
          userId,
          platform: 'broadcast',
          sourceGroup: 'manual',
          destGroup: jid,
          originalUrl: '',
          convertedUrl: '',
          messageText: msg.text,
          status: 'queued',
        },
      })
      const accepted = enqueueSendJob({
        type: 'broadcast',
        logId: log.id,
        destJid: jid,
        platforms: 'broadcast',
        imageMode: 'none',
        plan: 'broadcast',
        delayMs: 0,
        buildPayload: async () => ({ text: msg.text }),
      })
      if (accepted) {
        queued++
      } else {
        const error = 'Fila interna de envios cheia ou worker encerrando'
        errors.push({ jid, error })
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: 'error', errorMsg: error, sentAt: new Date() },
        }).catch(() => {})
      }
    }
    process.send({ type: 'broadcastResult', requestId: msg.requestId, data: { queued, rejected: errors.length, errors } })
  }
})

startBot().catch(err => {
  logger.error(err, 'Erro fatal no worker')
  process.exit(1)
})
