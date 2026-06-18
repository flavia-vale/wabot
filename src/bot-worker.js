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
import { rm, writeFile, readdir } from 'fs/promises'
import { dirname } from 'path'

import logger from './logger.js'
import { detectLinks } from './detector.js'
import { convertLink } from './converters/index.js'
import { applyConversionsAndBranding, DEFAULT_BRANDING_CTA_TEXT, hasSignificantTokenOverlap, normalizeBrandingCtaText, normalizeBrandingLink, sanitizeInviteLinks } from './messageProcessor.js'
import { fetchProductImage, fetchImageBuffer, normalizeImageForWhatsApp } from './converters/imageScrapers.js'
import { scrapeProductTitle } from './converters/productTitleScraper.js'
import { resolveMonitoredImage } from './monitoredImageResolver.js'
import db from './db.js'
import { getAuthInfoDir, getDedupFile, getKnownChannelsFile } from './paths.js'
import { trackAnalyticsEventSafe } from './analytics.js'
import { recordOperationalSignal } from './observability/operationalSignals.js'
import { validateCredentialData } from './credentialHealth.js'
import { decryptCredential } from './credentialCrypto.js'
import { createMessageQueue } from './messageQueue.js'
import { createMemorySendBackend, createBullmqSendBackend, finalizeSendJob, resolveBackendMode } from './sendQueueBackend.js'
import { withSendTimeout as withSendTimeoutImpl } from './sendMessageTimeout.js'
import { isMirrorableJid, detectKind, JID_KIND } from './core/jid.js'
import { subscribeToMonitorChannels } from './core/channels.js'
import { getChannelMetadata, followChannel, listFollowedChannels } from './core/channelDirectory.js'
import { logFollow } from './core/followGuard.js'
import {
  recordSendResult as recordChannelSendResult,
  recordStreamError as recordChannelStreamError,
} from './core/channelHealth.js'
import { checkAndReserve as throttleCheckAndReserve } from './core/channelThrottle.js'
import { applyVariation, resolveCopyVariationPoolJson } from './core/copyVariation.js'
import { PRESERVATION_FEATURE, isPreservationFeatureEnabled, shouldRunChannelScheduler } from './core/preservationFeatures.js'
import { mutate as mutateChannelImage } from './core/imageMutation.js'
import { waitUntilDrained, makeInFlightTracker } from './core/drainQueue.js'
import { shouldUseRelayPath, stripChannelUnsafeFields, isChannelDestination, isChannelForbiddenError, buildRelayProto, injectChannelForwardIntoPayload, normalizeChannelForwardJid } from './core/channelSend.js'
import { createPairingState, PAIRING_WINDOW_MS_DEFAULT } from './core/pairingState.js'
import { buildEntitledGroupConfig } from './billing/groupEntitlements.js'
import { getAdvancedPreservationAccess, isPreservationActive } from './billing/plans.js'
import { calculateJitterDelayMs, calculateProgressiveDelayMs, calculateRestWindowDelayMs, calculateTypingDelayMs } from './smartDelay.js'
import { buildMonitoredMessagePayload } from './monitoredMessagePayload.js'
import { buildIncomingDedupKey, hasRecentDedupEntry, pruneDedupStore, rememberDedupEntry } from './messageDedup.js'
import { classifyError } from './errorTaxonomy.js'
import { detectMessageKind, extractIncomingText, normalizeForwardingPolicy, shouldForwardMessage } from './forwardingPolicy.js'
import { broadcastSourceGroup } from './offerQueue/sourceTag.js'
import Redis from 'ioredis'
import { parseEnumEnv, logModeSummary } from './core/envModes.js'

const userId = process.env.BOT_USER_ID


const GLOBAL_RATE_LIMIT_MODE = parseEnumEnv('GLOBAL_RATE_LIMIT_MODE', process.env.GLOBAL_RATE_LIMIT_MODE || 'auto', ['auto', 'on', 'off'], 'auto')
const GLOBAL_DEDUP_MODE = parseEnumEnv('GLOBAL_DEDUP_MODE', process.env.GLOBAL_DEDUP_MODE || 'auto', ['auto', 'on', 'off'], 'auto')
const REDIS_FAIL_MODE = parseEnumEnv('REDIS_FAIL_MODE', process.env.REDIS_FAIL_MODE || 'open', ['open', 'closed'], 'open')
// Fail-mode específico da dedup de envio, desacoplado do rate-limit. Quando o
// Redis pisca, a escolha aqui é deliberadamente diferente do rate-limit:
//  - 'open'   → na falha, deixa passar (pode DUPLICAR um envio → risco de ban).
//  - 'closed' → na falha, derruba o envio daquela mensagem (oferta perdida,
//    recuperável; NÃO trava a fila serial, pois o throw é por-mensagem no
//    pipeline de incoming). Recomendado em prod por ser anti-ban.
// Default herda REDIS_FAIL_MODE para não mudar comportamento sem opt-in.
const REDIS_DEDUP_FAIL_MODE = parseEnumEnv('REDIS_DEDUP_FAIL_MODE', process.env.REDIS_DEDUP_FAIL_MODE || REDIS_FAIL_MODE, ['open', 'closed'], REDIS_FAIL_MODE)
let runtimeRedis = null


logModeSummary('bot-worker', {
  userId,
  globalRateLimitMode: GLOBAL_RATE_LIMIT_MODE,
  globalDedupMode: GLOBAL_DEDUP_MODE,
  redisFailMode: REDIS_FAIL_MODE,
  redisDedupFailMode: REDIS_DEDUP_FAIL_MODE,
  hasRedisUrl: Boolean(process.env.REDIS_URL),
})

function useGlobalRedis() {
  if (!process.env.REDIS_URL) return false
  if (GLOBAL_RATE_LIMIT_MODE === 'off' && GLOBAL_DEDUP_MODE === 'off') return false
  return true
}

function ensureRuntimeRedis() {
  if (!useGlobalRedis()) return null
  if (runtimeRedis) return runtimeRedis
  runtimeRedis = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null })
  runtimeRedis.on('error', (err) => logger.warn({ err: err?.message }, 'runtimeRedis error'))
  return runtimeRedis
}

async function globalRateLimitWait(destJid, windowMs) {
  const r = ensureRuntimeRedis()
  if (!r) return { allowed: true }
  const key = `send:last:${userId}:${destJid}`
  try {
    const now = Date.now()
    const last = Number(await r.get(key) || 0)
    const waitMs = windowMs - (now - last)
    if (waitMs > 0) return { allowed: false, waitMs }
    await r.psetex(key, Math.max(windowMs * 2, 1000), String(now))
    return { allowed: true }
  } catch (err) {
    if (REDIS_FAIL_MODE === 'closed') throw new Error(`Global rate-limit unavailable: ${err.message}`)
    logger.warn({ err: err?.message }, 'Global rate-limit falhou (fail-open)')
    return { allowed: true }
  }
}

async function globalDedupCheckAndSet(key, ttlMs) {
  const r = ensureRuntimeRedis()
  if (!r) return { duplicate: false }
  try {
    const ok = await r.set(`dedup:${userId}:${key}`, '1', 'PX', ttlMs, 'NX')
    return { duplicate: ok !== 'OK' }
  } catch (err) {
    if (REDIS_DEDUP_FAIL_MODE === 'closed') throw new Error(`Global dedup unavailable: ${err.message}`)
    // Gatilho de escala observável (WABOT-010): em fail-open a dedup global
    // pode deixar passar um envio duplicado (risco de ban). Contar as
    // ocorrências torna mensurável a decisão de REDIS_DEDUP_FAIL_MODE=closed.
    recordOperationalSignal('dedup_fail_open', { userId })
    logger.warn({ err: err?.message }, 'Global dedup falhou (fail-open)')
    return { duplicate: false }
  }
}
if (!userId) { logger.error('BOT_USER_ID não definido'); process.exit(1) }
const OWNER_INSTANCE = process.env.NODE_APP_INSTANCE ?? '0'
const SESSION_ERROR_WINDOW_MS = Math.max(30_000, Number(process.env.WA_SESSION_ERROR_WINDOW_MS || 120_000))
const SESSION_ERROR_THRESHOLD = Math.max(5, Number(process.env.WA_SESSION_ERROR_THRESHOLD || 30))
const SESSION_RECOVERY_COOLDOWN_MS = Math.max(60_000, Number(process.env.WA_SESSION_RECOVERY_COOLDOWN_MS || 300_000))
const ALLOW_TEXT_WITHOUT_LINKS = String(process.env.WA_ALLOW_TEXT_WITHOUT_LINKS || '0') === '1'

// Plataformas com og:title/JSON-LD confiável o suficiente para o guard de
// "título do produto bate com o caption". Shopee fica de fora porque sem
// creds o SPA não embute og:title (mesmo motivo já documentado em #422
// para og:image), o que daria muito skip falso. `WA_DISABLE_TITLE_MISMATCH_GUARD=1`
// desliga o guard em caso de emergência.
const TITLE_MISMATCH_GUARD_PLATFORMS = new Set(['mercadolivre', 'amazon', 'magazineluiza'])
const TITLE_MISMATCH_GUARD_DISABLED = String(process.env.WA_DISABLE_TITLE_MISMATCH_GUARD || '0') === '1'

function normalizeJidForMatch(jid) {
  if (typeof jid !== 'string') return ''
  return jid.trim().replace(/:\d+(?=@)/, '')
}

let activeSock = null
let pendingSock = null  // socket criado mas ainda não conectado (disponível para pairing code)
let shuttingDown = false

// Pairing-by-phone-number mode. Ativado pela IPC 'requestPairingCode'.
// Enquanto active=true:
//   - connection.update NÃO emite IPC 'qr' (o usuário escolheu pairing, não QR)
//   - connection.update NÃO agenda auto-restart em close (não-loggedOut)
//   - startBot, logo após makeWASocket, chama sock.requestPairingCode(phone)
//     ANTES da emissão de QR fazer o server WA comitar no fluxo errado.
// Limpa em connection==='open' (sucesso) ou em erro/timeout.
const pairingState = createPairingState({ windowMs: PAIRING_WINDOW_MS_DEFAULT })
let sessionErrorTimestamps = []
let sessionRecoveryLastAt = 0
let sessionRecoveryInFlight = false

let heartbeatTimer = null
let lastHeartbeatPersistAt = 0

async function persistWorkerHeartbeat(state) {
  // Heartbeat IPC tells the manager process that the worker process is alive,
  // but the dashboard reads WaSession from the DB. Persist a lightweight,
  // throttled heartbeat so the panel cannot keep showing "connected" when
  // the worker is alive but Baileys has no active socket.
  const now = Date.now()
  const intervalMs = Math.max(Number(process.env.WA_HEARTBEAT_DB_INTERVAL_MS || 60000), 15000)
  if (now - lastHeartbeatPersistAt < intervalMs) return
  lastHeartbeatPersistAt = now

  const patch = { lastHeartbeatAt: new Date(), ownerInstance: OWNER_INSTANCE }
  if (state === 'idle') {
    patch.status = 'disconnected'
    patch.lifecycle = 'disconnected'
  } else if (state === 'connecting') {
    patch.status = 'connecting'
    patch.lifecycle = 'connecting'
  }

  await persistSessionPatch(patch).catch(err => {
    logger.warn({ err: String(err?.message ?? err), state }, 'Falha ao persistir heartbeat da sessão WA')
  })
}

async function persistSessionPatch(data = {}) {
  const fallbackData = {
    ...(data.status ? { status: data.status } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, 'phone') ? { phone: data.phone ?? null } : {}),
    updatedAt: new Date(),
  }

  try {
    await db.waSession.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    })
  } catch (err) {
    const message = String(err?.message ?? '')
    const shapeMismatch = message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('does not exist in the current database')

    if (shapeMismatch) {
      try {
        const updated = await db.waSession.updateMany({ where: { userId }, data: fallbackData })
        if (!updated.count) await db.waSession.create({ data: { userId, ...fallbackData } })
      } catch (fallbackErr) {
        logger.warn({ err: String(fallbackErr?.message ?? fallbackErr) }, 'Falha ao persistir sessão com fallback simplificado')
      }
      return
    }

    logger.warn({ err: message }, 'Falha ao persistir patch de sessão WA')
  }
}

function startHeartbeatIpc() {
  if (heartbeatTimer) return
  const intervalMs = Math.max(Number(process.env.WA_HEARTBEAT_INTERVAL_MS || 15000), 5000)
  heartbeatTimer = setInterval(() => {
    const state = activeSock ? 'connected' : (pendingSock ? 'connecting' : 'idle')
    if (process.send) process.send({ type: 'heartbeat', ts: Date.now(), state })
    void persistWorkerHeartbeat(state)
  }, intervalMs)
  heartbeatTimer.unref?.()
}
function stopHeartbeatIpc() {
  if (!heartbeatTimer) return
  clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

const AUTH_DIR = getAuthInfoDir(userId)
const DEDUP_FILE = getDedupFile(userId)
const KNOWN_CHANNELS_FILE = getKnownChannelsFile(userId)
const DEDUP_FLUSH_DEBOUNCE_MS = 1_000
const KNOWN_CHANNELS_FLUSH_DEBOUNCE_MS = 2_000

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


// JIDs de canais (@newsletter) já vistos pela conta. Persistido em disco
// pra sobreviver a restart — Baileys não tem API para listar newsletters
// seguidos e messaging-history.set não re-dispara em reconexão incremental.
let knownChannelsFlushTimer = null
function loadKnownChannels() {
  try {
    const raw = JSON.parse(readFileSync(KNOWN_CHANNELS_FILE, 'utf8'))
    return Array.isArray(raw?.jids) ? raw.jids : []
  } catch { return [] }
}
function scheduleKnownChannelsSave(set) {
  if (knownChannelsFlushTimer) return
  knownChannelsFlushTimer = setTimeout(async () => {
    knownChannelsFlushTimer = null
    try {
      mkdirSync(dirname(KNOWN_CHANNELS_FILE), { recursive: true })
      await writeFile(KNOWN_CHANNELS_FILE, JSON.stringify({ jids: [...set] }), 'utf8')
    } catch (err) {
      logger.error({ err: err.message }, 'Erro ao persistir known channels')
    }
  }, KNOWN_CHANNELS_FLUSH_DEBOUNCE_MS)
  knownChannelsFlushTimer.unref?.()
}

async function clearAppStateSyncKeys() {
  const shouldClear = String(process.env.WA_CLEAR_SYNC_KEYS_ON_START ?? '0') === '1'
  if (!shouldClear) return

  let entries = []
  try {
    entries = await readdir(AUTH_DIR, { withFileTypes: true })
  } catch {
    return
  }

  const targets = entries
    .filter(entry => entry.isFile() && entry.name.startsWith('app-state-sync-key-'))
    .map(entry => `${AUTH_DIR}/${entry.name}`)

  if (!targets.length) return

  await Promise.all(targets.map(path => rm(path, { force: true })))
  logger.warn({ count: targets.length }, 'App state sync keys limpas para evitar loop de resync corrompido')
}

const sleep = ms => new Promise(res => setTimeout(res, ms))

const CONFIG_CACHE_TTL_MS = Math.max(1_000, Number(process.env.CONFIG_CACHE_TTL_MS || 60_000))

// Config cache com TTL configurável e promessa compartilhada para evitar stampede no DB.
let configCache = null
let configCacheTime = 0
let configCachePromise = null
const followedChannelJids = new Set()
const inFlightChannelJids = new Set()
// Canais conhecidos pela conta (do messaging-history.set e chats.upsert) —
// usado para popular o "Canais que sigo" no dashboard. Inclui qualquer
// @newsletter visto via Baileys, independente de o bot ter seguido.
const knownChannelJids = new Set(loadKnownChannels())
function rememberChannelJid(id) {
  if (typeof id !== 'string' || !id.endsWith('@newsletter')) return
  if (knownChannelJids.has(id)) return
  knownChannelJids.add(id)
  scheduleKnownChannelsSave(knownChannelJids)
}
function trackChannelChats(chats) {
  if (!Array.isArray(chats)) return
  for (const chat of chats) rememberChannelJid(chat?.id)
}
const sendJobTracker = makeInFlightTracker()

async function ensureChannelSubscriptions() {
  if (!activeSock) return
  const cfg = await getConfig().catch(err => {
    logger.warn({ err: err?.message }, 'channels: getConfig falhou; pulando inscrição')
    return null
  })
  const channelMonitors = (cfg?.groups?.monitor ?? []).filter(m => detectKind(m.waJid) === JID_KIND.CHANNEL)
  if (channelMonitors.length === 0) return
  const result = await subscribeToMonitorChannels({
    sock: activeSock,
    channelMonitors,
    followedSet: followedChannelJids,
    inFlight: inFlightChannelJids,
    logger,
  })
  logger.info(result, 'channels: inscrição de canais-monitor concluída')
}

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
      // D-3: `data` pode estar cifrado (v1:...). decryptCredential é transparente
      // para texto puro/legado. dotenv/config no topo garante a chave no worker.
      credentials[c.platform] = JSON.parse(decryptCredential(c.data))
    } catch (err) {
      logger.warn({ platform: c.platform, err: err.message }, 'Credencial inválida ignorada')
    }
  }

  const { groups } = buildEntitledGroupConfig({
    groups: user.groups,
    groupTargets: user.groupTargets,
    planSubject: { plan: user.plan, accessExpiresAt: user.accessExpiresAt },
    logger,
  })

  const botConfig = {
    delayMin: 5,
    delayMax: 15,
    platforms: 'shopee,amazon,mercadolivre,magazineluiza',
    blockedKeywords: '',
    welcomeMsg: '',
    feedGlobal: false,
    postToStatus: false,
    brandingGroupLink: '',
    brandingCtaText: DEFAULT_BRANDING_CTA_TEXT,
    ...(user.botConfig ?? {}),
  }
  botConfig.brandingGroupLink = normalizeBrandingLink(botConfig.brandingGroupLink)
  botConfig.brandingCtaText = normalizeBrandingCtaText(botConfig.brandingCtaText)

  const preservation = await getAdvancedPreservationAccess(userId, { db })
  // Efetivo = plano permite (Pro/Trial) E o usuário ligou o flag mestre opt-in.
  const preservationActive = isPreservationActive(preservation, botConfig)
  return { credentials, groups, plan: user.plan, botConfig, preservationActive }
}

async function getConfig() {
  const now = Date.now()
  if (configCache && now - configCacheTime <= CONFIG_CACHE_TTL_MS) return configCache

  if (!configCachePromise) {
    configCachePromise = loadConfig()
      .then(cfg => {
        configCache = cfg
        configCacheTime = Date.now()
        return cfg
      })
      .finally(() => {
        configCachePromise = null
      })
  }
  return configCachePromise
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
            messageText: sanitizeMessageForLog(msg.text),
            status: 'queued',
          },
        })

        const scheduledImageRecipe = buildBroadcastImageRecipe(msg.text, { imageUrl: msg.imageUrl, imageRefererUrl: msg.imageRefererUrl })
        // Botão "Ver canal" herdado do grupo de destino (mensagem agendada).
        const scheduledChannelForward = resolveChannelForward((await getConfig()).groups.postDetails.find(g => g.waJid === jid))
        const accepted = await enqueueSendJob({
          type: 'scheduled',
          logId: log.id,
          destJid: jid,
          platforms: 'scheduled',
          plan: 'scheduled',
          delayMs: buildSmartDelayMs((await getConfig()).botConfig),
          typingDelayMs: calculateTypingDelayMs({ text: msg.text, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
          channelForward: scheduledChannelForward,
          ...(scheduledImageRecipe ? { payloadRecipe: scheduledImageRecipe } : { payload: { text: msg.text } }),
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
            data: { status: 'error', errorMsg: classifyError(null, { kind: 'queue_full' }), sentAt: new Date() },
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

// Força re-emissão de sender_keys do WhatsApp via groupFetchAllParticipating().
// Compartilhado entre o watchdog e o endpoint manual /refresh-wa-state.
async function triggerWaGroupsRefresh(reason = 'manual') {
  if (!activeSock) return { ok: false, reason: 'not_connected' }
  if (waGroupsRefreshInFlight) return { ok: false, reason: 'in_flight' }
  waGroupsRefreshInFlight = true
  try {
    const startedAt = Date.now()
    const groups = await activeSock.groupFetchAllParticipating()
    const count = groups ? Object.keys(groups).length : 0
    lastWaGroupsRefreshAt = Date.now()
    logger.info({ reason, count, durationMs: lastWaGroupsRefreshAt - startedAt }, 'WA groups refresh concluído')
    return { ok: true, count }
  } catch (err) {
    logger.error({ reason, err: err?.message }, 'WA groups refresh falhou')
    return { ok: false, reason: 'error', error: err?.message }
  } finally {
    waGroupsRefreshInFlight = false
  }
}

async function monitorSilenceWatchdog() {
  if (!activeSock) return
  const cfg = await getConfig().catch(() => null)
  const monitors = cfg?.groups?.monitor ?? []
  if (monitors.length < 2) return // precisa de pelo menos 2 pra comparar atividade

  const now = Date.now()
  if (now - lastWaGroupsRefreshAt < MONITOR_REFRESH_COOLDOWN_MS) return

  const baseline = Math.max(workerStartedAt, lastWaGroupsRefreshAt)
  const silent = []
  let hasActive = false
  for (const m of monitors) {
    const jid = normalizeJidForMatch(m.waJid)
    const lastTs = lastIncomingByMonitorJid.get(jid) ?? baseline
    const silentMs = now - lastTs
    if (silentMs > MONITOR_SILENCE_THRESHOLD_MS) silent.push({ jid, silentMs })
    else if (lastIncomingByMonitorJid.has(jid)) hasActive = true
  }

  if (!silent.length || !hasActive) return

  logger.warn(
    { silent, thresholdMs: MONITOR_SILENCE_THRESHOLD_MS },
    'Monitor(es) silenciado(s) detectado(s); forçando refresh de sender_keys'
  )
  await triggerWaGroupsRefresh('silence_watchdog')
}

const MESSAGE_LOG_MAX_CHARS = Math.max(40, Number(process.env.MESSAGE_LOG_MAX_CHARS || 240))

function sanitizeMessageForLog(text) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  if (raw.length <= MESSAGE_LOG_MAX_CHARS) return raw
  return `${raw.slice(0, MESSAGE_LOG_MAX_CHARS)}…`
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
const SHUTDOWN_DRAIN_TIMEOUT_MS = Math.max(0, envNumber('SHUTDOWN_DRAIN_TIMEOUT_MS', 15_000))
// Timeout duro em volta de cada sock.sendMessage/relayMessage. Sem isso, um
// socket Baileys silenciosamente morto trava o await indefinidamente, e como
// a fila em memória processa serialmente, todo job posterior fica "queued"
// até reinício do worker. Com timeout vira erro transitório que reentra no
// retry loop; após SEND_MAX_ATTEMPTS o job é marcado 'error' e a fila avança.
//
// Política por tentativa: 1ª paciente (gera link preview, mídia hospedada,
// rede pode oscilar), demais rápidas para liberar a fila. Configurável via
// env caso precise uniformizar em incidentes — caem todos no mesmo valor.
const SEND_MESSAGE_TIMEOUT_MS = Math.max(5_000, envNumber('SEND_MESSAGE_TIMEOUT_MS', 0)) || null
const SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS = [90_000, 60_000, 45_000]
function resolveSendTimeoutMs(attempt) {
  if (SEND_MESSAGE_TIMEOUT_MS) return SEND_MESSAGE_TIMEOUT_MS
  const idx = Math.max(0, Math.min(SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS.length - 1, (attempt || 1) - 1))
  return SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS[idx]
}
const DEST_RATE_LIMIT_MS = Math.max(0, envNumber('DEST_RATE_LIMIT_MS', 1_000))
const SMART_DELAY_PROGRESSIVE_THRESHOLD = Math.max(1, envNumber('SMART_DELAY_PROGRESSIVE_THRESHOLD', 20))
const SMART_DELAY_PROGRESSIVE_STEP_MS = Math.max(0, envNumber('SMART_DELAY_PROGRESSIVE_STEP_MS', 5_000))
const SMART_DELAY_PROGRESSIVE_MAX_EXTRA_MS = Math.max(0, envNumber('SMART_DELAY_PROGRESSIVE_MAX_EXTRA_MS', 60_000))
const SMART_DELAY_REST_EVERY = Math.max(0, envNumber('SMART_DELAY_REST_EVERY', 0))
const SMART_DELAY_REST_MS = Math.max(0, envNumber('SMART_DELAY_REST_MS', 0))
const SMART_DELAY_TYPING_ENABLED = String(process.env.SMART_DELAY_TYPING_ENABLED ?? '1') !== '0'
const SMART_DELAY_TYPING_MIN_MS = Math.max(0, envNumber('SMART_DELAY_TYPING_MIN_MS', 1_200))
const SMART_DELAY_TYPING_MAX_MS = Math.max(SMART_DELAY_TYPING_MIN_MS, envNumber('SMART_DELAY_TYPING_MAX_MS', 7_000))
const SMART_DELAY_TYPING_CHARS_PER_SECOND = Math.max(1, envNumber('SMART_DELAY_TYPING_CHARS_PER_SECOND', 18))
// QUEUE_BACKEND aceita 'memory', 'bullmq' ou vazio (auto). Quando vazio
// e REDIS_URL está setado, default vira 'bullmq' — assim deploy em produção
// ganha persistência automaticamente. Comportamento controlado em
// resolveBackendMode() para manter a regra em um lugar só.
const SEND_QUEUE_BACKEND_ENV = String(process.env.QUEUE_BACKEND || '').toLowerCase()
const REDIS_URL = process.env.REDIS_URL || ''
const BULLMQ_QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || `wabot-send-${userId}`
const MSG_QUEUE_CONCURRENCY = Math.max(1, envNumber('MSG_QUEUE_CONCURRENCY', 2))
// Default subido de 15s -> 25s: dentro do orçamento da incomingQueue cabe
// scrape de título (3s) + conversão de afiliado (rede) + dedup + DB write.
// Em Amazon BR (HTML de ~1.3MB) 15s ficava apertado. Watchdog em
// MSG_QUEUE_WATCHDOG_MS (30s) continua como safety-net pro caso patológico.
const MSG_QUEUE_TIMEOUT_MS = Math.max(1_000, envNumber('MSG_QUEUE_TIMEOUT_MS', 25_000))
const MSG_QUEUE_WATCHDOG_MS = Math.max(5_000, envNumber('MSG_QUEUE_WATCHDOG_MS', 40_000))
const MSG_QUEUE_MAX_SIZE = Math.max(10, envNumber('MSG_QUEUE_MAX_SIZE', 500))
const MAX_INCOMING_MESSAGE_CHARS = Math.max(500, envNumber('MAX_INCOMING_MESSAGE_CHARS', 8_000))

// Watchdog de "monitor silencioso": detecta grupos monitorados que pararam
// de receber mensagens enquanto outros monitores do mesmo usuário continuam
// ativos. Sintoma típico de sender_key dessincronizada no Signal — o
// WebSocket segue ok, mas o libsignal devolve Bad MAC pra mensagens daquele
// grupo. Chamar groupFetchAllParticipating() força o WhatsApp a re-emitir
// sender_keys atualizadas (mesmo efeito de abrir o seletor de grupos no
// painel). Ação é leve (~1s) e não derruba a sessão.
const MONITOR_SILENCE_CHECK_INTERVAL_MS = Math.max(60_000, envNumber('MONITOR_SILENCE_CHECK_INTERVAL_MS', 5 * 60_000))
const MONITOR_SILENCE_THRESHOLD_MS = Math.max(5 * 60_000, envNumber('MONITOR_SILENCE_THRESHOLD_MS', 30 * 60_000))
const MONITOR_REFRESH_COOLDOWN_MS = Math.max(60_000, envNumber('MONITOR_REFRESH_COOLDOWN_MS', 60 * 60_000))

const monitorSilenceTimer = setInterval(
  () => {
    pruneTimestampMap(lastSendByDest)
    pruneTimestampMap(lastIncomingByMonitorJid)
    monitorSilenceWatchdog().catch(err => logger.error({ err: err?.message }, 'monitorSilenceWatchdog falhou'))
  },
  MONITOR_SILENCE_CHECK_INTERVAL_MS,
)
monitorSilenceTimer.unref?.()

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

// Ambos os Maps são limitados pelo número de grupos distintos que o usuário
// usa (destinos de envio / monitores), mas só fazem `.set()` — nunca encolhem.
// Para um worker de vida longa (semanas), a poda periódica abaixo garante que
// não acumulem entradas obsoletas indefinidamente. TTL generoso: nenhuma das
// duas leituras usa janela maior que minutos, então 6h é folgado e seguro.
const TIMESTAMP_MAP_TTL_MS = Math.max(60_000, envNumber('TIMESTAMP_MAP_TTL_MS', 6 * 60 * 60_000))
const TIMESTAMP_MAP_MAX_ENTRIES = Math.max(100, envNumber('TIMESTAMP_MAP_MAX_ENTRIES', 5_000))
const lastSendByDest = new Map()
const lastIncomingByMonitorJid = new Map()

function pruneTimestampMap(map, now = Date.now()) {
  for (const [key, ts] of map) {
    if (now - ts > TIMESTAMP_MAP_TTL_MS) map.delete(key)
  }
  // Hard cap defensivo: se ainda exceder, descarta as entradas mais antigas.
  if (map.size > TIMESTAMP_MAP_MAX_ENTRIES) {
    const excess = [...map.entries()].sort((a, b) => a[1] - b[1]).slice(0, map.size - TIMESTAMP_MAP_MAX_ENTRIES)
    for (const [key] of excess) map.delete(key)
  }
}

const workerStartedAt = Date.now()
let lastWaGroupsRefreshAt = 0
let waGroupsRefreshInFlight = false
let interruptedSendLogsMarked = false
let adSendCount = 0
const doneCallbacks = new Map()
let sendBackend = null

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
  const queueSize = typeof sendBackend?.getQueueSize === 'function' ? sendBackend.getQueueSize() : 0
  return {
    backend: sendBackend?.backend || 'memory',
    queueSize: typeof queueSize === 'number' ? queueSize : 0,
    processing: sendBackend?.getProcessing?.() || false,
    maxSize: SEND_QUEUE_MAX_SIZE,
    maxAttempts: SEND_MAX_ATTEMPTS,
    retryBaseMs: SEND_RETRY_BASE_MS,
    retryMaxMs: SEND_RETRY_MAX_MS,
    destinationRateLimitMs: DEST_RATE_LIMIT_MS,
    smartDelay: {
      progressiveThreshold: SMART_DELAY_PROGRESSIVE_THRESHOLD,
      progressiveStepMs: SMART_DELAY_PROGRESSIVE_STEP_MS,
      progressiveMaxExtraMs: SMART_DELAY_PROGRESSIVE_MAX_EXTRA_MS,
      restEvery: SMART_DELAY_REST_EVERY,
      restMs: SMART_DELAY_REST_MS,
      typingEnabled: SMART_DELAY_TYPING_ENABLED,
      typingMinMs: SMART_DELAY_TYPING_MIN_MS,
      typingMaxMs: SMART_DELAY_TYPING_MAX_MS,
    },
    ...sendMetrics,
    avgLatencyMs: sendMetrics.latencyCount ? Math.round(sendMetrics.latencyTotalMs / sendMetrics.latencyCount) : 0,
  }
}

function canAcceptSendJob() {
  return !shuttingDown
}

function getSendBackendQueueSize() {
  const size = typeof sendBackend?.getQueueSize === 'function' ? sendBackend.getQueueSize() : 0
  return typeof size === 'number' ? size : 0
}

function buildSmartDelayMs(botConfig, queueSize = getSendBackendQueueSize()) {
  const jitterDelayMs = calculateJitterDelayMs({
    delayMin: botConfig?.delayMin,
    delayMax: botConfig?.delayMax,
  })
  return calculateProgressiveDelayMs({
    baseDelayMs: jitterDelayMs,
    queueSize,
    threshold: SMART_DELAY_PROGRESSIVE_THRESHOLD,
    stepMs: SMART_DELAY_PROGRESSIVE_STEP_MS,
    maxExtraMs: SMART_DELAY_PROGRESSIVE_MAX_EXTRA_MS,
  })
}

async function enqueueSendJob(job) {
  if (!canAcceptSendJob()) {
    sendMetrics.rejectedTotal++
    return false
  }
  const normalizedJob = { attempts: 0, enqueuedAt: Date.now(), ...job, onDone: undefined }
  // IMPORTANTE: NÃO chamar buildPayload aqui. A payload (que pode conter
  // image.buffer Buffer real) precisa ser materializada apenas no dequeue,
  // dentro do worker — caso contrário, em backend BullMQ, o Buffer é
  // serializado via JSON.stringify e vira `{type:'Buffer',data:[...]}` na
  // deserialização. O Baileys não reconhece como mídia e a oferta sai sem
  // imagem (regressão já vivida — ver AGENTS.md).
  //
  // Em backend `memory` a função `buildPayload` viaja in-process e roda no
  // dequeue. Em backend `bullmq`, a função não sobrevive ao Redis: o guard
  // em sendBackend.enqueue rejeita explicitamente (fail-loud em vez de
  // perder imagem silenciosamente).
  if (normalizedJob.delayMs === undefined) normalizedJob.delayMs = 0
  if (normalizedJob.typingDelayMs === undefined) normalizedJob.typingDelayMs = 0
  if (typeof job.onDone === 'function') doneCallbacks.set(job.logId, job.onDone)
  sendMetrics.queuedTotal++
  if (job.type === 'broadcast') sendMetrics.broadcastQueuedTotal++
  else if (job.type === 'scheduled') sendMetrics.scheduledQueuedTotal++
  else sendMetrics.convertedQueuedTotal++
  return sendBackend.enqueue(normalizedJob)
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
  if (GLOBAL_RATE_LIMIT_MODE !== 'off') {
    const gate = await globalRateLimitWait(destJid, DEST_RATE_LIMIT_MS)
    if (!gate.allowed && gate.waitMs > 0) await sleep(gate.waitMs)
  }
}

async function finishSendJob(job, result) {
  const onDone = doneCallbacks.get(job.logId)
  doneCallbacks.delete(job.logId)
  await finalizeSendJob(onDone, job, result)
}

function withSendTimeout(promise, ctx) {
  const timeoutMs = resolveSendTimeoutMs(ctx?.attempt)
  return withSendTimeoutImpl(promise, { ...ctx, timeoutMs })
}


function isHttpUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function buildBroadcastImageRecipe(text, options = {}) {
  if (!isHttpUrl(options.imageUrl)) return null
  return {
    type: 'imageUrl',
    text: String(text || ''),
    imageUrl: options.imageUrl,
    refererUrl: isHttpUrl(options.imageRefererUrl) ? options.imageRefererUrl : undefined,
  }
}

async function buildPayloadFromRecipe(recipe) {
  if (recipe?.type !== 'imageUrl') return undefined

  let image = null
  try {
    const fetched = await fetchImageBuffer(recipe.imageUrl, recipe.refererUrl)
    image = fetched ? await normalizeImageForWhatsApp(fetched.buffer) : null
    if (fetched && !image) {
      logger.warn({ srcMime: fetched.mimetype, size: fetched.buffer?.length }, 'broadcast image: normalizeImageForWhatsApp falhou — enviando texto com preview')
    }
  } catch (err) {
    logger.warn({ err: err?.message, imageUrl: recipe.imageUrl }, 'broadcast image: falha ao baixar imagem — enviando texto com preview')
  }

  return buildMonitoredMessagePayload({
    finalText: recipe.text,
    image,
    useLinkPreview: !image,
  })
}

// Resolve qual canal injetar no botão "Ver canal" a partir do GRUPO DE DESTINO
// (postDetail.channelButtonJid/Name). Cada grupo de destino define seu próprio
// canal (ou nenhum) — não existe mais canal global nem fallback. Sem canal
// válido no destino → null (mensagem sai sem botão). O `postDetail` vem de
// cfg.groups.postDetails (toPostDetail em groupEntitlements.js).
function resolveChannelForward(postDetail) {
  const jid = normalizeChannelForwardJid(postDetail?.channelButtonJid)
  if (jid) {
    return { newsletterJid: jid, newsletterName: String(postDetail?.channelButtonName ?? '').trim(), serverMessageId: null }
  }
  return null
}

async function sendPreparedPayload({ sock, job, payload, attempt = 1 }) {
  if (payload && payload._route === 'relay' && payload.relay?.type && payload.relay?.proto) {
    await withSendTimeout(
      sock.relayMessage(job.destJid, { [payload.relay.type]: payload.relay.proto }, {}),
      { destJid: job.destJid, route: 'relay', attempt },
    )
    return
  }

  if (payload && payload.primary) {
    const channelDest = isChannelDestination(job.destJid)
    if (detectKind(job.destJid) === null) {
      logger.warn({ destJid: job.destJid }, 'JID kind inesperado chegou ao send path; usando sendMessage como fallback')
    }
    const routes = [
      {
        body: channelDest ? stripChannelUnsafeFields(payload.primary) : payload.primary,
        sendOptions: payload.primarySendOptions,
      },
      ...(payload.fallbacks || []).map((body, idx) => ({
        body: channelDest ? stripChannelUnsafeFields(body) : body,
        sendOptions: payload.fallbackSendOptions?.[idx],
      })),
    ]
    let lastErr = null
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]
      try {
        await withSendTimeout(
          sock.sendMessage(job.destJid, route.body, route.sendOptions || undefined),
          { destJid: job.destJid, route: i === 0 ? 'primary' : `fallback[${i - 1}]`, attempt },
        )
        return
      } catch (err) {
        lastErr = err
        if (err?.code === 'SEND_MESSAGE_TIMEOUT') {
          logger.warn({ destJid: job.destJid, route: i === 0 ? 'primary' : `fallback[${i - 1}]` }, 'sendMessage timeout; tentando próximo fallback se houver')
        }
      }
    }
    throw lastErr || new Error('Todos os fallbacks de envio falharam')
  }

  await withSendTimeout(
    sock.sendMessage(job.destJid, payload),
    { destJid: job.destJid, route: 'default', attempt },
  )
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

    const restDelayMs = calculateRestWindowDelayMs({
      sentCount: sendMetrics.successTotal,
      every: SMART_DELAY_REST_EVERY,
      durationMs: SMART_DELAY_REST_MS,
    })
    const totalDelayMs = Math.max(0, job.delayMs || 0) + restDelayMs
    if (totalDelayMs > 0) {
      logger.info({ destJid: job.destJid, delayMs: totalDelayMs, baseDelayMs: job.delayMs || 0, restDelayMs, type: job.type }, 'Smart delay antes do envio')
      await sleep(totalDelayMs)
    }

    // PR-5.C.1 + 5.B.1: lookup do groupId do canal-destino (uma vez por job)
    // para alimentar ChannelHealth e passar pelo velocity scheduler.
    let channelGroupId = null
    if (isChannelDestination(job.destJid)) {
      try {
        const g = await db.group.findFirst({
          where: { userId, waJid: job.destJid, role: 'post', kind: 'channel' },
          select: { id: true },
        })
        channelGroupId = g?.id ?? null
        if (channelGroupId) {
          // checkAndReserve já cobre: pausa por health, quiet hours, daily cap,
          // intervalo mínimo, burst cap. Reserva o slot quando libera.
          const cfgFull = await getConfig().catch(() => null)
          const cfg = cfgFull?.botConfig ?? {}
          let gate = await throttleCheckAndReserve(channelGroupId, cfg, {
            preservationActive: shouldRunChannelScheduler(cfgFull?.preservationActive, cfg),
          })
          let throttleCycles = 0
          while (!gate.allow && !shuttingDown) {
            throttleCycles++
            const waitMs = Math.max(0, (gate.deferUntil ?? Date.now()) - Date.now())
            logger.info({ destJid: job.destJid, reason: gate.reason, waitMs, throttleCycles }, 'Velocity scheduler: aguardando janela de throttle do canal')
            await sleep(waitMs)
            gate = await throttleCheckAndReserve(channelGroupId, cfg, {
              preservationActive: shouldRunChannelScheduler(cfgFull?.preservationActive, cfg),
            })
          }
          if (shuttingDown) throw new Error('Worker encerrando durante espera de throttle do canal')
        }
      } catch (err) {
        logger.warn({ err: err?.message, destJid: job.destJid }, 'channelHealth/throttle lookup falhou; seguindo sem pausa')
      }
    }

    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {
      try {
        const sockForAttempt = activeSock
        if (!sockForAttempt) throw new Error('Bot não conectado')
        if (payload === null) {
          if (typeof job.buildPayload === 'function') payload = await job.buildPayload()
          else if (job.payloadRecipe) payload = await buildPayloadFromRecipe(job.payloadRecipe)
          else payload = job.payload
        }
        if (payload === undefined) throw new Error('Invalid send job: payload/buildPayload ausente')
        // Botão "Ver canal" do grupo de destino, injetado de forma central para
        // cobrir TODOS os caminhos não-relay (texto puro, imagem montada,
        // broadcast/oferta automática, agendado). O caminho relay (mídia
        // grupo→grupo) já injeta via buildRelayProto, então é pulado aqui.
        // Destino canal (@newsletter) não leva contextInfo (stripChannelUnsafeFields).
        if (job.channelForward && payload && payload._route !== 'relay' && !isChannelDestination(job.destJid)) {
          payload = injectChannelForwardIntoPayload(payload, job.channelForward)
        }
        await waitDestinationRateLimit(job.destJid)
        if (SMART_DELAY_TYPING_ENABLED && job.typingDelayMs > 0 && !job.skipTyping) {
          try {
            await Promise.resolve(sockForAttempt?.sendPresenceUpdate?.('composing', job.destJid)).catch(() => {})
            await sleep(job.typingDelayMs)
            await Promise.resolve((activeSock ?? sockForAttempt)?.sendPresenceUpdate?.('paused', job.destJid)).catch(() => {})
          } catch (presenceErr) {
            logger.debug({ err: presenceErr?.message, destJid: job.destJid }, 'sendPresenceUpdate falhou; ignorando typing')
          }
        }
        await sendPreparedPayload({ sock: sockForAttempt, job, payload, attempt })
        const finishedAt = Date.now()
        lastSendByDest.set(job.destJid, finishedAt)
        logger.info({ destJid: job.destJid, platforms: job.platforms, attempt, type: job.type }, 'Mensagem enviada')

        if (channelGroupId) {
          recordChannelSendResult(channelGroupId, { ok: true, latencyMs: finishedAt - startedAt }, { now: finishedAt })
            .catch(err => logger.warn({ err: err?.message }, 'recordChannelSendResult(ok) falhou'))
        }

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
            await sockForAttempt.sendMessage(job.destJid, { text: AD_TEXT }).catch(() => {})
          }
        }
        return
      } catch (err) {
        if (isChannelDestination(job.destJid) && (
          err?.code === 'CHANNEL_THROTTLED' ||
          /Canal throttled \(/i.test(err?.message || '')
        )) {
          const waitMs = Math.max(0, (err?.deferUntil ? (new Date(err.deferUntil).getTime() - Date.now()) : getRetryDelayMs(attempt)))
          logger.info({ destJid: job.destJid, err: err.message, waitMs, attempt, type: job.type }, 'Throttle de canal detectado durante envio — aguardando e retomando')
          await sleep(waitMs)
          continue
        }
        // Canal sem permissão: aborta retries para não queimar SEND_MAX_ATTEMPTS
        // em destino permanentemente bloqueado (e evitar rate-limit/ban).
        if (isChannelDestination(job.destJid) && isChannelForbiddenError(err)) {
          logger.warn({ destJid: job.destJid, err: err.message, attempt, type: job.type }, 'Canal-destino sem permissão (forbidden) — abortando retries')
          throw err
        }
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
    const kind = isChannelForbiddenError(err) ? 'channel_forbidden' : undefined
    const canonicalErrorMsg = classifyError(err, { destJid: job.destJid, kind })
    await db.messageLog.update({
      where: { id: job.logId },
      data: { status: 'error', errorMsg: canonicalErrorMsg, sentAt: new Date() },
    }).catch(() => {})
    sendMetrics.errorTotal++
    sendMetrics.lastErrorAt = new Date().toISOString()
    sendMetrics.lastError = err.message
    if (channelGroupId) {
      const errorCode = isChannelForbiddenError(err)
        ? '403'
        : (err?.output?.statusCode ? String(err.output.statusCode) : (err?.code ?? null))
      recordChannelSendResult(channelGroupId, { ok: false, errorCode, errorMsg: err.message })
        .catch(e => logger.warn({ err: e?.message }, 'recordChannelSendResult(fail) falhou'))
    }
    await finishSendJob(job, { ok: false, error: err.message })
  }
}

async function markInterruptedSendLogs() {
  const now = new Date()
  stopHeartbeatIpc()
  await Promise.all([
    db.messageLog.updateMany({
      where: { userId, status: { in: ['queued', 'sending'] } },
      data: {
        status: 'error',
        errorMsg: classifyError(null, { kind: 'worker_restart' }),
        sentAt: now,
      },
    }),
    db.scheduledMessage.updateMany({
      where: { userId, status: { in: ['queued', 'sending'] } },
      data: { status: 'failed', sentAt: now },
    }),
  ])
}

async function createSendBackend() {
  const onRejected = () => { sendMetrics.rejectedTotal++ }
  // sendJobTracker é lido por shutdown() via waitUntilDrained para esperar
  // jobs em vôo terminarem antes de marcar restos como interrompidos.
  const onDequeued = (job) => sendJobTracker.track(() => processSendJob(job))
  const mode = resolveBackendMode({ queueBackendEnv: SEND_QUEUE_BACKEND_ENV, redisUrl: REDIS_URL })
  if (mode === 'memory') {
    return createMemorySendBackend({ maxSize: SEND_QUEUE_MAX_SIZE, onRejected, onDequeued })
  }
  if (mode === 'memory-fallback') {
    logger.warn('QUEUE_BACKEND=bullmq definido sem REDIS_URL; fallback para memória')
    return createMemorySendBackend({ maxSize: SEND_QUEUE_MAX_SIZE, onRejected, onDequeued })
  }
  // mode === 'bullmq'
  try {
    logger.info({ queueName: BULLMQ_QUEUE_NAME, dlqQueueName: `${BULLMQ_QUEUE_NAME}-dlq` }, 'Usando BullMQ como backend de envio')
    const bullBackend = await createBullmqSendBackend({
      redisUrl: REDIS_URL,
      queueName: BULLMQ_QUEUE_NAME,
      onRejected,
      onDequeued,
      concurrency: 1,
    })
    const memoryFallback = createMemorySendBackend({ maxSize: SEND_QUEUE_MAX_SIZE, onRejected, onDequeued })
    return {
      ...bullBackend,
      enqueue(job) {
        return bullBackend.enqueue(job).then(ok => {
          if (ok) return true
          logger.warn({ logId: job?.logId }, 'BullMQ indisponível no enqueue; fallback imediato para fila em memória')
          return memoryFallback.enqueue(job)
        })
      },
      async close() {
        await Promise.allSettled([
          bullBackend.close(),
          memoryFallback.close(),
        ])
      },
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao iniciar BullMQ; fallback para memória')
    return createMemorySendBackend({ maxSize: SEND_QUEUE_MAX_SIZE, onRejected, onDequeued })
  }
}

let startBotInFlight = false
async function startBot() {
  // Guard contra startBots concorrentes (boot inicial + IPC pairing + restart
  // timer podem todos chamar isto). Concorrência causa dois sockets fechando
  // um ao outro mid-handshake, propagando "Connection Closed" pro pairing.
  if (startBotInFlight) {
    logger.warn('startBot já em andamento — ignorando chamada paralela')
    return
  }
  startBotInFlight = true
  try {
    await startBotInner()
  } finally {
    startBotInFlight = false
  }
}

async function startBotInner() {
  if (!sendBackend) sendBackend = await createSendBackend()
  await getConfig()
  if (!interruptedSendLogsMarked) {
    interruptedSendLogsMarked = true
    await markInterruptedSendLogs()
  }

  // Duas janelas: msgIds (curta) protege contra redelivery do WhatsApp do
  // mesmo msg.key.id; links (longa) protege contra a MESMA oferta cair no
  // mesmo destino mais de uma vez por dia. Caso real: várias automações
  // (canais-fonte diferentes) apontando pro mesmo grupo republicam a mesma
  // URL ao longo do dia — sem janela diária a oferta saía repetida. A chave
  // de dedup é `destJid:convertedUrl` (independe da fonte), então duas
  // automações com o mesmo produto pro mesmo grupo colidem e só a 1ª passa.
  // Default 24h = "no máximo uma vez por dia"; override via DEDUP_LINK_WINDOW_MS.
  const dedupeWindowMs = Math.max(1_000, Number(process.env.DEDUP_MSGID_WINDOW_MS) || 300_000)
  const linkDedupWindowMs = Math.max(dedupeWindowMs, Number(process.env.DEDUP_LINK_WINDOW_MS) || 24 * 60 * 60_000)
  const dedup = pruneDedupStore(
    loadDedup(),
    Date.now(),
    { msgIds: dedupeWindowMs, links: linkDedupWindowMs },
  )
  scheduleDedupSave(dedup)

  setLifecycleState(WA_LIFECYCLE.INITIALIZING, { reason: 'start_bot' })
  mkdirSync(AUTH_DIR, { recursive: true })
  await clearAppStateSyncKeys()
  startHeartbeatIpc()

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

  // Pairing mode: requisitar o código depois que WA emitir o primeiro 'qr'
  // (sinal de que noise handshake + auth challenge terminaram e o servidor
  // está pronto pra aceitar a IQ link_code_companion_reg). Esperar só o
  // 'connecting' é cedo demais — auth challenge ainda não rodou, e a IQ
  // de pairing é rejeitada com "Connection Closed". O exemplo canônico do
  // Baileys faz `if (qr && !creds.registered) requestPairingCode`.
  if (pairingState.isActive()) {
    const { requestId, phone } = pairingState.snapshot()
    ;(async () => {
      try {
        if (sock.authState?.creds?.registered) {
          throw new Error('Sessão já está autenticada. Use "Esquecer número salvo" antes de parear por número.')
        }
        // Aguarda 'qr' (= WA pronto pra pairing) OU 'open' (= já registrado)
        // OU 'close' (= erro antes de chegar lá). Cap em 25s.
        const ready = await new Promise((resolve, reject) => {
          const onUpdate = ({ connection, qr, lastDisconnect }) => {
            if (qr) {
              sock.ev.off('connection.update', onUpdate)
              resolve({ via: 'qr' })
            } else if (connection === 'open') {
              sock.ev.off('connection.update', onUpdate)
              resolve({ via: 'open' })
            } else if (connection === 'close') {
              sock.ev.off('connection.update', onUpdate)
              const code = lastDisconnect?.error?.output?.statusCode
              reject(new Error(`Socket fechado antes de chegar pronto para pairing (code=${code ?? 'unknown'})`))
            }
          }
          sock.ev.on('connection.update', onUpdate)
          setTimeout(() => {
            sock.ev.off('connection.update', onUpdate)
            reject(new Error('WA não respondeu em 25s ao iniciar pareamento'))
          }, 25_000)
        })
        if (!pairingState.ownsRequest(requestId)) return
        if (ready.via === 'open') {
          throw new Error('Sessão já está conectada — não é possível parear por número agora.')
        }

        logger.info({ requestId }, 'WA pronto para pairing (qr emitido); solicitando código')
        const code = await Promise.race([
          sock.requestPairingCode(phone),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout interno (20s) ao gerar pairing code no WhatsApp')), 20_000)),
        ])
        if (!pairingState.ownsRequest(requestId)) return
        pairingState.markCode(code)
        logger.info({ requestId, codeLen: code?.length }, 'Pairing code recebido do WhatsApp')
        if (process.send) process.send({ type: 'pairingCode', requestId, code })
      } catch (err) {
        if (!pairingState.ownsRequest(requestId)) return
        logger.error({ err: err.message, stack: err.stack, requestId }, 'Falha ao solicitar pairing code no socket WA')
        pairingState.clear()
        if (process.send) process.send({ type: 'pairingCode', requestId, error: err.message })
      }
    })()
  }

  // PR-5.A: Baileys emite stream:error em rate-overlimit / forbidden /
  // not-authorized. Gravar uma marca rate_limited em FollowLog faz o
  // followGuard pausar follows por 1h para a sessão.
  const handleStreamError = (node) => {
    try {
      const code = node?.attrs?.code || node?.children?.[0]?.tag || 'unknown'
      const blocking = ['rate-overlimit', 'not-authorized', 'forbidden', '401', '403', '429']
      if (!blocking.includes(String(code))) return
      logger.warn({ code }, 'stream:error capturado; quarentenando follows desta sessão')
      logFollow(userId, '<stream>', 'rate_limited', String(code)).catch(err => {
        logger.warn({ err: err?.message }, 'logFollow(rate_limited) falhou')
      })
      recordChannelStreamError(userId, String(code)).catch(err => {
        logger.warn({ err: err?.message }, 'recordChannelStreamError falhou')
      })
    } catch (err) {
      logger.warn({ err: err?.message }, 'handleStreamError falhou')
    }
  }
  sock.ws?.on?.('CB:stream:error', handleStreamError)

  // Captura JIDs de canais (@newsletter) que aparecem nos chats do usuário,
  // pra alimentar o picker "Canais que sigo" no dashboard. Baileys 6.7.16
  // não tem listFollowedNewsletters; chegamos lá via histórico + upserts.
  sock.ev.on('messaging-history.set', ({ chats }) => trackChannelChats(chats))
  sock.ev.on('chats.upsert', (chats) => trackChannelChats(chats))

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      setLifecycleState(WA_LIFECYCLE.AUTHENTICATING, { reason: 'qr_generated' })
      // Em pairing mode, NÃO vazar o QR pra UI — o usuário pediu código,
      // não scan. Baileys ainda gera QR internamente como fallback, ignoramos.
      if (!pairingState.suppressQrEmission() && process.send) process.send({ type: 'qr', data: qr })
await persistSessionPatch({ status: 'connecting', lifecycle: 'authenticating', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date() })
    }

    if (connection === 'open') {
      setLifecycleState(WA_LIFECYCLE.READY, { reason: 'connection_open' })
      activeSock = sock
      pendingSock = null
      pairingState.clear()
      const phone = sock.user?.id?.split(':')[0] ?? null
      if (process.send) process.send({ type: 'status', data: 'connected', phone })
await persistSessionPatch({ status: 'connected', phone, lifecycle: 'ready', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date(), lastDisconnectCode: null })
      trackAnalyticsEventSafe({ userId, event: 'whatsapp_connected' })
      ensureChannelSubscriptions().catch(err => logger.error({ err: err?.message }, 'channels: erro ao inscrever no boot'))
    }

    if (connection === 'close') {
      setLifecycleState(WA_LIFECYCLE.DISCONNECTED, { reason: 'connection_close' })
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      const isLoggedOut = code === DisconnectReason.loggedOut
      const isRestartRequired = code === DisconnectReason.restartRequired
      const wasPairing = pairingState.suppressAutoRestart()
      activeSock = null
      pendingSock = null
      if (process.send) process.send({ type: 'status', data: 'disconnected' })
await persistSessionPatch({ status: 'disconnected', lifecycle: 'disconnected', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date(), lastDisconnectCode: code != null ? String(code) : null }).catch(() => {})
      if (isLoggedOut) {
        // Sessão revogada/expirada — limpar auth para que próximo start gere QR limpo
        await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {})
        logger.info('Sessão encerrada pelo servidor WA — auth_info limpo automaticamente')
      } else if (wasPairing && isRestartRequired) {
        // Pairing aceito pelo WA: o servidor manda close com code 515 esperando
        // que a gente reconecte com as novas creds salvas via saveCreds. Esse é
        // o caminho FELIZ do pairing — limpa o estado e dispara startBot pra
        // completar o handshake pós-pairing e chegar em connection: 'open'.
        logger.info({ code }, 'Pairing aceito pelo WA (restartRequired 515) — reiniciando com creds novas')
        pairingState.clear()
        setTimeout(startBot, 500)
      } else if (wasPairing) {
        // Pairing pendente (usuário ainda digitando código no app) ou falha
        // não-515 durante pairing: NÃO auto-reiniciar agora. Se o usuário
        // falhar em colar o código a tempo, a UI chamará novamente o endpoint.
        logger.warn({ code }, 'WA close durante pairing (não-515) — não reiniciando automaticamente')
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
      const normalizedJid = normalizeJidForMatch(jid)
      const cfg = await getConfig()
      logger.info({ jid, monitorGroups: cfg.groups.monitor, feedGlobal: cfg.botConfig.feedGlobal }, 'mensagem recebida')
      const monitorGroup = cfg.groups.monitor.find(m => normalizeJidForMatch(m.waJid) === normalizedJid)
      const shouldTrackSkipped = Boolean(monitorGroup) || (cfg.botConfig.feedGlobal && isMirrorableJid(jid))
      async function recordSkippedMessage({ reason, platform = 'unknown', originalUrl = '', convertedUrl = '' }) {
        if (!shouldTrackSkipped) return
        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption || ''
        await db.messageLog.create({
          data: {
            userId,
            platform,
            sourceGroup: normalizedJid || 'unknown',
            destGroup: 'skipped',
            originalUrl,
            convertedUrl,
            messageText: sanitizeMessageForLog(messageText || reason),
            status: 'skipped',
            errorMsg: reason,
          },
        }).catch(() => {})
      }

      // Quando uma URL já enviada nas últimas 2h é vista de novo, em vez de
      // criar mais uma linha 'skip:dedup_recent_link' (gerando N rows iguais
      // que poluem o painel), incrementamos um contador na linha existente
      // mais recente do mesmo (userId, destJid, convertedUrl). Janela de busca
      // = linkDedupWindowMs. Se não houver linha recente (estado dessincronizado
      // após restart, por exemplo), cria uma nova como fallback para não perder
      // visibilidade do evento.
      async function registerDedupBlock({ reason, platform, destJid, originalUrl: incomingUrl, convertedUrl: outgoingUrl, messageText }) {
        if (!shouldTrackSkipped) return
        const since = new Date(Date.now() - linkDedupWindowMs)
        const lookupUrl = outgoingUrl || incomingUrl || ''
        try {
          const recent = lookupUrl
            ? await db.messageLog.findFirst({
                where: {
                  userId,
                  destGroup: destJid,
                  OR: [
                    { convertedUrl: lookupUrl },
                    { originalUrl: lookupUrl },
                  ],
                  sentAt: { gte: since },
                },
                orderBy: { sentAt: 'desc' },
                select: { id: true },
              })
            : null
          if (recent) {
            await db.messageLog.update({
              where: { id: recent.id },
              data: { dedupHits: { increment: 1 } },
            })
            return
          }
        } catch (err) {
          logger.warn({ err: err?.message, reason }, 'registerDedupBlock lookup falhou; fallback para create')
        }
        await db.messageLog.create({
          data: {
            userId,
            platform: platform || 'unknown',
            sourceGroup: normalizedJid || 'unknown',
            destGroup: destJid || 'skipped',
            originalUrl: incomingUrl || '',
            convertedUrl: outgoingUrl || '',
            messageText: sanitizeMessageForLog(messageText || reason),
            status: 'skipped',
            errorMsg: reason,
            dedupHits: 0,
          },
        }).catch(() => {})
      }

      if (!cfg.botConfig.feedGlobal && !monitorGroup) {
        return
      }
      // feedGlobal aceita mensagens de qualquer JID espelhável (grupo ou canal).
      // O pipeline downstream é agnóstico ao tipo; o tratamento específico
      // de envio para canal-destino vem na Fase 3.
      if (cfg.botConfig.feedGlobal && !isMirrorableJid(jid)) {
        return
      }

      // Desembrulha wrappers (ephemeralMessage/viewOnceMessage/etc.) ANTES de
      // ler a legenda. Sem isso, imagem com legenda em grupo com mensagens
      // temporárias chega com `msg.message.imageMessage` undefined, o texto vem
      // vazio, nenhum link é detectado e a política LINK_ONLY ignora como
      // `nolink`. Fallback para o raw cobre conteúdo não-embrulhado.
      const innerMessage = extractMessageContent(msg.message)
      const text = extractIncomingText(innerMessage) || extractIncomingText(msg.message)

      if (text && text.length > MAX_INCOMING_MESSAGE_CHARS) {
        logger.warn({ msgId: msg.key.id, chars: text.length, limit: MAX_INCOMING_MESSAGE_CHARS }, 'Mensagem grande demais — processamento ignorado para preservar latência')
        await recordSkippedMessage({ reason: 'skip:text_too_large' })
        return
      }

      // Filtro por palavras bloqueadas (override por grupo monitorado quando preenchido)
      const blockedKeywords = monitorGroup?.blockedKeywords?.trim() || cfg.botConfig.blockedKeywords
      if (blockedKeywords) {
        const blocked = blockedKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        const lower = text.toLowerCase()
        if (blocked.some(kw => lower.includes(kw))) {
          await recordSkippedMessage({ reason: 'skip:blocked_keyword' })
          logger.info({ blocked }, 'Mensagem bloqueada por keyword'); return
        }
      }

      const sanitizedText = text ? sanitizeInviteLinks(text) : ''
      if (text && !sanitizedText) return

      const links = detectLinks(sanitizedText)
      const messageKind = detectMessageKind(innerMessage, sanitizedText)
      const policy = normalizeForwardingPolicy(monitorGroup)
      const canForwardCurrentMessage = shouldForwardMessage({
        hasLinks: links.length > 0,
        messageKind,
        policy,
      })
      if (!canForwardCurrentMessage) {
        const hasGenericUrl = /https?:\/\//i.test(sanitizedText)
        const unsupportedStoreSuffix = links.length === 0 && hasGenericUrl ? ':unsupported_store' : ''
        await db.messageLog.create({
          data: {
            userId,
            platform: links[0]?.platform || 'nolink',
            sourceGroup: jid,
            destGroup: 'skipped',
            originalUrl: links[0]?.url || '',
            convertedUrl: '',
            messageText: sanitizeMessageForLog(sanitizedText || text || ''),
            status: 'skipped',
            errorMsg: `skip:policy:${policy.forwardMode}:${policy.noLinkScope}:${messageKind}${unsupportedStoreSuffix}`,
          },
        }).catch(() => {})
        return
      }

      // Filtro por plataforma (override por grupo monitorado quando preenchido)
      const platformCsv = monitorGroup?.allowedPlatforms?.trim() || cfg.botConfig.platforms
      const enabledPlatforms = new Set(platformCsv.split(',').filter(Boolean))

      // Retorna o proto imageMessage/videoMessage original sem baixar.
      // Esse era o caminho estável em produção: reaproveita a mídia já hospedada
      // nos servidores do WhatsApp e troca somente o caption convertido, evitando
      // novo upload/preview para mensagens monitoradas.
      function getOriginalMediaMessage() {
        const inner = extractMessageContent(msg.message)
        const ext = inner?.extendedTextMessage
        const quoted = ext?.contextInfo?.quotedMessage
        if (inner?.imageMessage) return { type: 'imageMessage', proto: inner.imageMessage }
        if (quoted?.imageMessage) return { type: 'imageMessage', proto: quoted.imageMessage }
        if (inner?.videoMessage) return { type: 'videoMessage', proto: inner.videoMessage }
        if (quoted?.videoMessage) return { type: 'videoMessage', proto: quoted.videoMessage }
        if (inner?.audioMessage) return { type: 'audioMessage', proto: inner.audioMessage }
        if (quoted?.audioMessage) return { type: 'audioMessage', proto: quoted.audioMessage }
        if (inner?.documentMessage) return { type: 'documentMessage', proto: inner.documentMessage }
        if (quoted?.documentMessage) return { type: 'documentMessage', proto: quoted.documentMessage }
        if (inner?.stickerMessage) return { type: 'stickerMessage', proto: inner.stickerMessage }
        if (quoted?.stickerMessage) return { type: 'stickerMessage', proto: quoted.stickerMessage }
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
      // { buffer, mimetype } pronto para enviar à Baileys, respeitando a
      // configuração de imagem do grupo monitorado.
      let cachedImage
      let imageFetched = false
      async function getImage() {
        if (imageFetched) return cachedImage
        imageFetched = true
        if (!monitorGroup || monitorGroup.imageMode === 'none') return null

        const enabled = links.filter(l => enabledPlatforms.has(l.platform))
        const target = monitorGroup.imageLinkTarget === 'last' ? enabled[enabled.length - 1] : enabled[0]
        const platform = target?.platform || 'unknown'
        logger.info({ msgId: msg.key.id, imageMode: monitorGroup.imageMode, platform }, 'getImage: iniciando resolução de imagem')

        cachedImage = await resolveMonitoredImage({
          mode: monitorGroup.imageMode,
          target,
          credentials: cfg.credentials,
          downloadOriginalImage,
          fetchProductImage,
          fetchImageBuffer,
          fallbackToOriginal: monitorGroup.fallbackToOriginal !== false,
          logger,
        })
        return cachedImage
      }


      async function recordConversionIssue({ platform, url, jid, text, reason }) {
        logger.warn({ platform, url, reason }, 'Conversão ignorada com diagnóstico para o painel')
        await db.messageLog.create({
          data: {
            userId,
            platform,
            sourceGroup: jid,
            destGroup: 'conversion',
            originalUrl: url,
            convertedUrl: '',
            messageText: sanitizeMessageForLog(text),
            status: 'error',
            errorMsg: `error:conversion:${reason}`,
          },
        }).catch(err => {
          logger.warn({ err: err.message, platform }, 'Falha ao gravar diagnóstico de conversão')
        })
        trackAnalyticsEventSafe({ userId, event: 'send_error', metadata: { platform, errorType: 'conversion_diagnostic' } })
      }

      // Converter todos os links habilitados em paralelo. Conversores podem
      // fazer 4-5 chamadas HTTP sequenciais cada (resolve short → API afiliado
      // → validate); processar N links em série estoura o teto da fila quando
      // a mensagem tem múltiplas URLs. Ordem é preservada porque a substituição
      // no texto casa por URL original, não por índice em conversions[].
      const linkResults = await Promise.all(links.map(async ({ platform, url }) => {
        if (!enabledPlatforms.has(platform)) {
          logger.info({ platform }, 'Plataforma desabilitada — pulando')
          return null
        }
        logger.info({ platform, url }, 'Link detectado')
        const credentialValidation = validateCredentialData(platform, cfg.credentials[platform])
        if (!credentialValidation.configured) {
          await recordConversionIssue({
            platform,
            url,
            jid,
            text,
            reason: `Credenciais de ${credentialValidation.label} ausentes ou incompletas: ${credentialValidation.missing.join(', ')}`,
          })
          return null
        }

        try {
          const conversionResult = await convertLink(platform, url, cfg.credentials)
          if (!conversionResult) {
            await recordConversionIssue({ platform, url, jid, text, reason: `Conversor de ${credentialValidation.label} não retornou link convertido. Confira se as credenciais estão válidas.` })
            return null
          }
          logger.info({ platform, converted: conversionResult.url, warning: conversionResult.warning }, 'Link convertido')
          return { platform, url, converted: conversionResult.url, warning: conversionResult.warning }
        } catch (err) {
          await recordConversionIssue({ platform, url, jid, text, reason: `Falha na conversão de ${credentialValidation.label}: ${err.message}` })
          return null
        }
      }))
      const conversions = linkResults.filter(Boolean)

      const warningKinds = new Set(conversions.map(c => c.warning).filter(Boolean))
      for (const kind of warningKinds) {
        const sample = conversions.find(c => c.warning === kind)
        await db.messageLog.create({
          data: {
            userId,
            platform: sample?.platform || 'unknown',
            sourceGroup: jid,
            destGroup: 'warning',
            originalUrl: sample?.url || '',
            convertedUrl: '',
            messageText: '',
            status: 'skipped',
            errorMsg: `warning:${kind}`,
          },
        }).catch(err => {
          logger.warn({ err: err.message, kind }, 'Falha ao gravar aviso de conversão')
        })
      }

      let finalText = sanitizedText
      if (links.length) {
      if (!conversions.length) {
        await db.messageLog.create({
          data: {
            userId,
            platform: links[0]?.platform || 'unknown',
            sourceGroup: jid,
            destGroup: 'skipped',
            originalUrl: links[0]?.url || '',
            convertedUrl: '',
            messageText: sanitizeMessageForLog(sanitizedText || ''),
            status: 'skipped',
            errorMsg: 'skip:no_valid_conversions',
          },
        }).catch(() => {})
        return
      }
        finalText = applyConversionsAndBranding(sanitizedText, conversions, cfg.botConfig.brandingGroupLink, cfg.botConfig.brandingCtaText)
      }
      const originalMedia = getOriginalMediaMessage()
      if (!finalText && !originalMedia) {
        logger.warn({ msgId: msg.key.id }, 'Mensagem vazia após processamento — envio ignorado')
        return
      }

      const primary = conversions[0] ?? { platform: 'nolink', url: '', converted: '' }

      // Guard anti-mismatch: já apareceu em produção mensagem com caption
      // de "toalhas", link de "mochila" e foto de "jaqueta" (upstream
      // republicou uma oferta errada). Como nosso pipeline relaya a imagem
      // de cima e troca só o caption, herdamos esse desalinhamento. Raspar
      // og:title do link convertido e comparar com o caption pega o caso
      // sem confiar em nada do upstream. Skip silencioso quando o scrape
      // falha — não queremos derrubar oferta legítima por timeout.
      if (
        !TITLE_MISMATCH_GUARD_DISABLED &&
        primary.url &&
        TITLE_MISMATCH_GUARD_PLATFORMS.has(primary.platform)
      ) {
        const scrapedTitle = await scrapeProductTitle(primary.url).catch(() => null)
        if (scrapedTitle && !hasSignificantTokenOverlap(scrapedTitle, sanitizedText)) {
          logger.warn({
            msgId: msg.key.id,
            platform: primary.platform,
            originalUrl: primary.url,
            convertedUrl: primary.converted,
            scrapedTitle,
            captionPreview: sanitizeMessageForLog(sanitizedText).slice(0, 200),
          }, 'skip:title_mismatch — caption não bate com o título raspado do produto destino')
          await recordSkippedMessage({
            reason: 'skip:title_mismatch',
            platform: primary.platform,
            originalUrl: primary.url,
            convertedUrl: primary.converted,
          })
          return
        }
      }

      const baseDestinations = monitorGroup?.targetPostJids?.length ? monitorGroup.targetPostJids : cfg.groups.post
      const destinations = cfg.botConfig.postToStatus ? [...baseDestinations, 'status@broadcast'] : baseDestinations
      // PR-5.B.2: stagger entre destinos para quebrar simultaneidade exata.
      // Primeiro destino sem atraso; demais com jitter aleatório limitado.
      const staggerJitterMs = Math.max(0, Number(cfg.botConfig.channelStaggerJitterMs ?? 0))
      let destIndex = -1
      for (const destJid of destinations) {
        destIndex++
        // Botão "Ver canal" definido pelo GRUPO DE DESTINO (ou null = sem botão).
        const channelForward = resolveChannelForward(cfg.groups.postDetails.find(g => g.waJid === destJid))
        const dedupSubject = primary.url || `${msg.key.id || 'nolink'}:${sanitizeMessageForLog(finalText).slice(0, 80)}`
        const key = `${destJid}:${dedupSubject}`
        if (dedup.links[key] && Date.now() - dedup.links[key] < linkDedupWindowMs) {
          await registerDedupBlock({
            reason: 'skip:dedup_recent_link',
            platform: primary.platform,
            destJid,
            originalUrl: primary.url,
            convertedUrl: primary.converted,
            messageText: finalText,
          })
          logger.info({ destJid }, 'Duplicata ignorada'); continue
        }
        if (GLOBAL_DEDUP_MODE !== 'off') {
          // Usa a janela longa (diária) também na dedup cross-instância via
          // Redis — antes usava dedupeWindowMs (5min), o que deixava a mesma
          // oferta passar de novo poucos minutos depois quando o bloqueio
          // in-memory não pegava (ex.: outro processo/instância).
          const globalDedup = await globalDedupCheckAndSet(key, linkDedupWindowMs)
          if (globalDedup.duplicate) {
            await registerDedupBlock({
              reason: 'skip:dedup_recent_link_global',
              platform: primary.platform,
              destJid,
              originalUrl: primary.url,
              convertedUrl: primary.converted,
              messageText: finalText,
            })
            logger.info({ destJid }, 'Duplicata global ignorada')
            continue
          }
        }
        dedup.links[key] = Date.now()
        scheduleDedupSave(dedup)

        const platforms = conversions.length ? conversions.map(c => c.platform).join('+') : 'nolink'
        const logData = {
          userId,
          platform: platforms,
          sourceGroup: jid,
          destGroup: destJid,
          originalUrl: primary.url,
          convertedUrl: primary.converted,
          messageText: sanitizeMessageForLog(finalText),
        }

        // Restaura o caminho estável que continua funcionando em produção:
        // quando há mídia original, relayMessage reaproveita o proto já hospedado
        // no WhatsApp e troca apenas o caption. Se não houver mídia original, cai
        // para upload simples de imagem com caption e, por último, texto puro.
        // Quando imageMode=original mas só houver jpegThumbnail minúsculo, usa
        // preview automático do WhatsApp em vez de imagem pixelada.
        const imageMode = monitorGroup?.imageMode
        const wantImage = imageMode !== 'none'
        const original = wantImage ? originalMedia : null
        let useLinkPreview = false  // será setado a true se jpegThumbnail for descartado

        const previousSuccessCount = await db.messageLog.count({ where: { userId, status: 'success' } }).catch(() => 1)
        const log = await db.messageLog.create({
          data: { ...logData, status: 'queued' },
        })
        let sentVia = 'text'

        // PR-5.B.2: variação de copy por canal-destino (determinística por
        // destJid+data). Aplica só em canal — em grupo não há fingerprint
        // de "mesma mensagem em N", então mantém texto original.
        const isChannelDest = isChannelDestination(destJid)
        const variantText = isChannelDest
          ? (isPreservationFeatureEnabled(cfg.preservationActive, cfg.botConfig, PRESERVATION_FEATURE.COPY_VARIATION)
              ? applyVariation(finalText, { groupId: destJid, poolJson: resolveCopyVariationPoolJson(cfg.botConfig.copyVariationPoolJson) })
              : finalText)
          : finalText

        // Stagger: 1º destino sai sem atraso adicional; demais recebem jitter.
        const staggerMs = (destIndex > 0 && isChannelDest && isPreservationFeatureEnabled(cfg.preservationActive, cfg.botConfig, PRESERVATION_FEATURE.CHANNEL_THROTTLE) && staggerJitterMs > 0)
          ? Math.floor(Math.random() * staggerJitterMs)
          : 0

        // buildPayload é LAZY de propósito: roda no dequeue, dentro do
        // worker. Mantém image.buffer (Buffer) em memória do processo, sem
        // passar pelo Redis. Ver enqueueSendJob() para a explicação completa.
        const buildPayload = async () => {
          // Quando o destino tem botão de canal (channelForward), pulamos o relay
          // de propósito: o relay reaproveita o proto de mídia da ORIGEM e injetar
          // o NOSSO canal nele faz o WhatsApp derrubar o envio. Em vez disso caímos
          // no caminho sendMessage com a imagem rebaixada (getImage) — o MESMO
          // caminho comprovado das ofertas automáticas — e a injeção central
          // (mídia-only) adiciona o botão. Sem botão, mantemos o relay (fidelidade
          // máxima de mídia, inclui vídeo).
          if (shouldUseRelayPath({ destJid, hasOriginal: !!original }) && !channelForward) {
            const hasCaption = original.type === 'imageMessage' || original.type === 'videoMessage'
            // Higieniza o contextInfo herdado da ORIGEM (remove botão de terceiros
            // e externalAdReply). forwardNewsletter=null: relay nunca injeta canal.
            const replayProto = buildRelayProto(original.proto, {
              caption: hasCaption ? variantText : undefined,
              forwardNewsletter: null,
            })
            return {
              _route: 'relay',
              relay: {
                type: original.type,
                proto: replayProto,
              },
            }
          }

          let image = null
          if (wantImage) {
            const fetched = await getImage()
            image = fetched ? await normalizeImageForWhatsApp(fetched.buffer) : null
            if (fetched && !image) {
              logger.warn({ msgId: msg.key.id, srcMime: fetched.mimetype, size: fetched.buffer?.length }, 'normalizeImageForWhatsApp falhou — enviando sem imagem')
            }
            if (imageMode === 'original' && !image) {
              useLinkPreview = true
            }
            if (image && isChannelDest && isPreservationFeatureEnabled(cfg.preservationActive, cfg.botConfig, PRESERVATION_FEATURE.IMAGE_MUTATION)) {
              const mutated = await mutateChannelImage(image.buffer, image.mimetype, {
                groupId: destJid,
                enabled: true,
              })
              if (mutated.buffer !== image.buffer) {
                image = { ...image, buffer: mutated.buffer, mimetype: mutated.mimetype }
              }
            }
          }

          return buildMonitoredMessagePayload({
            finalText: variantText,
            image,
            useLinkPreview,
          })
        }

        const accepted = await enqueueSendJob({
          type: 'converted',
          logId: log.id,
          destJid,
          platforms,
          plan: cfg.plan,
          delayMs: buildSmartDelayMs(cfg.botConfig) + staggerMs,
          typingDelayMs: calculateTypingDelayMs({ text: variantText, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
          channelForward,
          buildPayload,
          onDone: async (result) => {
            if (result.ok) {
              logger.info({ destJid, platforms, sentVia }, 'Mensagem enviada')
              if (previousSuccessCount === 0) trackAnalyticsEventSafe({ userId, event: 'first_send_success', metadata: { platform: platforms } })
            } else {
              trackAnalyticsEventSafe({ userId, event: 'send_error', metadata: { platform: platforms, errorType: result.error } })
            }
          },
        })

        if (!accepted) {
          await db.messageLog.update({
            where: { id: log.id },
            data: { status: 'error', errorMsg: classifyError(null, { kind: 'queue_full' }), sentAt: new Date() },
          }).catch(() => {})
          logger.warn({ destJid, platforms, logId: log.id }, 'Mensagem convertida rejeitada pela fila')
        }
      }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.info({ type, count: messages.length }, 'messages.upsert recebido')
    if (type !== 'notify' && type !== 'append') return
    const cutoff = Date.now() - 5 * 60_000

    for (const msg of messages) {
      rememberChannelJid(msg?.key?.remoteJid)
      // DEBUG temporário (gated por DEBUG_INCOMING_UPSERT) — investigação do
      // sumiço de mensagens com botão "Ver canal" (forwardedNewsletterMessageInfo)
      // que não viram linha no painel. Loga, ANTES de qualquer continue, qual
      // filtro descartaria a mensagem e se ela carrega info de newsletter.
      if (process.env.DEBUG_INCOMING_UPSERT) {
        try {
          const dbgTsRaw = Number(msg.messageTimestamp ?? 0)
          const dbgTs = Number.isFinite(dbgTsRaw) && dbgTsRaw > 0 ? dbgTsRaw * 1000 : null
          const ageMs = dbgTs ? Date.now() - dbgTs : null
          const inner = extractMessageContent(msg.message) || msg.message || {}
          const hasNewsletter = (() => {
            const scan = (v, d = 0) => {
              if (!v || typeof v !== 'object' || d > 6) return false
              if (v.forwardedNewsletterMessageInfo) return true
              for (const child of Object.values(v)) {
                if (child && typeof child === 'object' && scan(child, d + 1)) return true
              }
              return false
            }
            return scan(msg.message)
          })()
          let wouldDrop = null
          if (msg.key.fromMe) wouldDrop = 'fromMe'
          else if (dbgTs && dbgTs < cutoff) wouldDrop = `cutoff_5min(age=${ageMs}ms)`
          logger.info({
            jid: msg.key.remoteJid,
            msgId: msg.key.id,
            fromMe: Boolean(msg.key.fromMe),
            msgTsRaw: dbgTsRaw,
            ageMs,
            cutoffWindowMs: 5 * 60_000,
            topKeys: Object.keys(msg.message || {}),
            innerKeys: Object.keys(inner || {}),
            hasNewsletter,
            wouldDrop,
          }, 'DEBUG_INCOMING_UPSERT')
        } catch (dbgErr) {
          logger.warn({ err: dbgErr?.message }, 'DEBUG_INCOMING_UPSERT falhou')
        }
      }
      if (msg.key.fromMe) continue
      // Marca atividade do JID — usado pelo monitorSilenceWatchdog pra
      // diferenciar "monitor parado por falha de decrypt" de "monitor
      // inativo organicamente". Atualiza independente de filtros downstream.
      const remoteJid = normalizeJidForMatch(msg.key.remoteJid)
      if (remoteJid) lastIncomingByMonitorJid.set(remoteJid, Date.now())
      const msgTsRaw = Number(msg.messageTimestamp ?? 0)
      const hasValidTimestamp = Number.isFinite(msgTsRaw) && msgTsRaw > 0
      const msgTs = hasValidTimestamp ? msgTsRaw * 1000 : null
      if (msgTs && msgTs < cutoff) continue

      const now = Date.now()
      pruneDedupStore(dedup, now, { msgIds: dedupeWindowMs, links: linkDedupWindowMs })
      const dedupKey = buildIncomingDedupKey(msg)
      if (dedupKey && hasRecentDedupEntry(dedup.msgIds, dedupKey, now, dedupeWindowMs)) {
        logger.info({ dedupKey, jid: msg.key.remoteJid }, 'Mensagem duplicada ignorada')
        continue
      }
      if (rememberDedupEntry(dedup, dedupKey, now)) scheduleDedupSave(dedup)

      const msgId = msg.key.id || dedupKey || `${msg.key.remoteJid || 'unknown'}:${msgTsRaw || now}`
      const accepted = incomingQueue.enqueue(() => processIncomingMessage(msg, sock), {
        label: `msg:${msgId}`,
        orderKey: msg.key.remoteJid,
        onError: async (err) => {
          const currentCfg = await getConfig().catch(() => null)
          const currentJid = msg.key.remoteJid
          const isMonitored = Boolean(currentCfg?.groups?.monitor?.find?.(m => m.waJid === currentJid))
          const isFeedGlobalMirrorable = Boolean(currentCfg?.botConfig?.feedGlobal && isMirrorableJid(currentJid))
          if (!isMonitored && !isFeedGlobalMirrorable) {
            logger.error({ msgId, dedupKey, err: err.message }, 'Mensagem descartada fora do escopo monitorado — sem log em painel')
            return
          }
          const reason = classifyError(err, { kind: 'incoming' })
          // timeout:incoming representa "tentamos processar e não conseguiu a tempo"
          // — vira status='error'. Demais (decrypt, incoming_error) seguem 'skipped'.
          const status = reason.startsWith('timeout:') ? 'error' : 'skipped'
          await db.messageLog.create({
            data: {
              userId,
              platform: 'unknown',
              sourceGroup: msg.key.remoteJid || 'unknown',
              destGroup: 'skipped',
              originalUrl: '',
              convertedUrl: '',
              messageText: sanitizeMessageForLog(
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                'incoming_error'
              ),
              status,
              errorMsg: reason,
            },
          }).catch(() => {})
          logger.error({ msgId, dedupKey, err: err.message }, 'Mensagem descartada após erro/timeout — fila continua')
        },
      })
      if (!accepted) {
        logger.warn({ msgId, jid: msg.key.remoteJid }, 'Mensagem rejeitada pela fila (cheia ou worker encerrando)')
      }
    }
  })

  async function restartSessionAfterCryptoSurge() {
    if (sessionRecoveryInFlight || shuttingDown) return
    sessionRecoveryInFlight = true
    try {
      const currentSock = activeSock || pendingSock
      if (currentSock?.end) currentSock.end(new Error('restart_after_crypto_surge'))
    } catch (err) {
      logger.warn({ err: err?.message }, 'Falha ao encerrar sessão antes da recuperação automática')
    }
    activeSock = null
    pendingSock = null
    setTimeout(() => {
      startBot()
        .catch(error => logger.error({ err: error?.message }, 'Falha ao reiniciar sessão após surto de erro criptográfico'))
        .finally(() => { sessionRecoveryInFlight = false })
    }, 1_000)
  }

  function registerSessionError(err) {
    const raw = String(err?.message || err || '')
    if (!/Bad MAC|MessageCounterError|Key used already or never filled/i.test(raw)) return
    const now = Date.now()
    sessionErrorTimestamps.push(now)
    sessionErrorTimestamps = sessionErrorTimestamps.filter(ts => now - ts <= SESSION_ERROR_WINDOW_MS)
    const shouldRecover =
      sessionErrorTimestamps.length >= SESSION_ERROR_THRESHOLD &&
      now - sessionRecoveryLastAt >= SESSION_RECOVERY_COOLDOWN_MS &&
      !shuttingDown
    if (!shouldRecover) return
    sessionRecoveryLastAt = now
    logger.error(
      { count: sessionErrorTimestamps.length, windowMs: SESSION_ERROR_WINDOW_MS, cooldownMs: SESSION_RECOVERY_COOLDOWN_MS },
      'Surto de erros criptográficos detectado; reiniciando sessão WA automaticamente'
    )
    restartSessionAfterCryptoSurge().catch(error => logger.error({ err: error?.message }, 'Erro na rotina de recuperação automática'))
  }
  sock.ev.on('connection.update', ({ lastDisconnect }) => registerSessionError(lastDisconnect?.error))
}


async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  stopHeartbeatIpc()

  // Drena jobs em vôo antes de marcar pendentes como interrompidos.
  // shuttingDown=true acima já desativa retries em processSendJob (linha 581),
  // então jobs ativos terminam (ok ou falha definitiva) em poucos segundos.
  // markInterruptedSendLogs só roda depois, capturando o que sobrou da fila
  // ou jobs que excederam o timeout.
  if (!sendJobTracker.isDrained()) {
    const drain = await waitUntilDrained({
      isDrained: sendJobTracker.isDrained,
      timeoutMs: SHUTDOWN_DRAIN_TIMEOUT_MS,
      pollIntervalMs: 100,
    })
    logger.info({ ...drain, remaining: sendJobTracker.inFlightCount() }, 'shutdown: drenagem de envios concluída')
  }

  await Promise.all([
    flushDedupNow().catch(err => {
      logger.error({ err: err.message }, 'Erro ao persistir deduplicação antes de encerrar')
    }),
    markInterruptedSendLogs().catch(err => {
      logger.error({ err: err.message }, 'Erro ao marcar envios pendentes como interrompidos')
    }),
    sendBackend?.close?.().catch(err => {
      logger.error({ err: err.message }, 'Erro ao encerrar backend da fila de envios')
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
    configCachePromise = null
    logger.info('Config recarregada')
    ensureChannelSubscriptions().catch(err => logger.error({ err: err?.message }, 'channels: erro ao inscrever após reload'))
  }

  if (msg?.type === 'refreshWaGroups') {
    const result = await triggerWaGroupsRefresh('ipc_manual')
    process.send({ type: 'refreshWaGroups', requestId: msg.requestId, data: result })
  }

  if (msg?.type === 'listGroups') {
    if (!activeSock) {
      process.send({ type: 'groups', requestId: msg.requestId, data: [], error: 'Bot não conectado' })
      return
    }
    activeSock.groupFetchAllParticipating()
      .then(groups => {
        const list = Object.entries(groups).map(([id, g]) => {
          const parentJid = g.linkedParent
          const parent = parentJid ? groups[parentJid] : null
          const name = parent?.subject && parent.subject !== g.subject
            ? `${parent.subject} - ${g.subject}`
            : g.subject
          return { waJid: id, name }
        })
        process.send({ type: 'groups', requestId: msg.requestId, data: list })
      })
      .catch(err => {
        process.send({ type: 'groups', requestId: msg.requestId, data: [], error: err.message })
      })
  }

  if (msg?.type === 'requestPairingCode') {
    const requestId = msg.requestId
    const phone = msg.phone
    if (!phone) {
      process.send({ type: 'pairingCode', requestId, error: 'Telefone obrigatório' })
      return
    }
    // Fluxo atômico de pairing:
    //   1. Aguardar startBot em andamento finalizar (boot inicial ou restart)
    //   2. setActive(...) (suprime QR IPC + auto-restart em close; agenda expiry)
    //   3. Tear-down do socket atual (se houver) — pairing exige fresh socket
    //   4. Limpar AUTH_DIR para garantir creds.registered === false
    //   5. Chamar startBot() — o trigger em startBot pede o código logo após
    //      makeWASocket e devolve via IPC 'pairingCode'.
    try {
      if (pairingState.isActive()) {
        logger.warn({ existing: pairingState.snapshot().requestId, newRequestId: requestId }, 'Pairing já em andamento — substituindo')
      }

      // Worker pode acabar de bootar: o boot startBot pode estar criando
      // socket nesse exato momento. Aguarda finalizar antes de tear-down
      // (até 8s). Se não finalizar, segue assim mesmo — o tear-down forçará
      // o close, e a guard startBotInFlight evita race no startBot seguinte.
      const waitStart = Date.now()
      while (startBotInFlight && (Date.now() - waitStart) < 8_000) {
        await new Promise(r => setTimeout(r, 100))
      }

      // setActive ANTES do tear-down: connection.update do sock fechando
      // verá suppressAutoRestart=true e não agendará setTimeout(startBot).
      pairingState.setActive({
        phone,
        requestId,
        onExpire: (expired) => {
          logger.warn({ requestId: expired.requestId }, 'Pairing window expirou sem código')
          if (process.send) process.send({ type: 'pairingCode', requestId: expired.requestId, error: 'Tempo esgotado aguardando código de pareamento' })
        },
      })

      try { activeSock?.end?.(undefined) } catch {}
      try { pendingSock?.end?.(undefined) } catch {}
      try { activeSock?.ws?.close?.() } catch {}
      try { pendingSock?.ws?.close?.() } catch {}
      activeSock = null
      pendingSock = null

      // Pequena espera pra eventos 'close' propagarem antes de criar novo sock
      await new Promise(r => setTimeout(r, 300))

      await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {})

      logger.info({ requestId }, 'Iniciando socket fresh em pairing mode')
      startBot().catch(err => {
        if (!pairingState.ownsRequest(requestId)) return
        logger.error({ err: err.message, requestId }, 'startBot falhou durante pairing')
        pairingState.clear()
        if (process.send) process.send({ type: 'pairingCode', requestId, error: `Falha ao iniciar sessão: ${err.message}` })
      })
    } catch (err) {
      logger.error({ err: err.message, requestId }, 'Erro inesperado no handler de pairing')
      pairingState.clear()
      if (process.send) process.send({ type: 'pairingCode', requestId, error: err.message })
    }
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
          sourceGroup: broadcastSourceGroup(msg.options),
          destGroup: jid,
          originalUrl: '',
          convertedUrl: '',
          messageText: sanitizeMessageForLog(msg.text),
          status: 'queued',
        },
      })
      const imageRecipe = buildBroadcastImageRecipe(msg.text, msg.options)
      // Botão "Ver canal" herdado do grupo de destino (oferta automática,
      // broadcast manual). null = sem botão. A injeção acontece em processSendJob.
      const broadcastChannelForward = resolveChannelForward((await getConfig()).groups.postDetails.find(g => g.waJid === jid))
      const accepted = await enqueueSendJob({
        type: 'broadcast',
        logId: log.id,
        destJid: jid,
        platforms: 'broadcast',
        plan: 'broadcast',
        delayMs: buildSmartDelayMs((await getConfig()).botConfig),
        typingDelayMs: calculateTypingDelayMs({ text: msg.text, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
        channelForward: broadcastChannelForward,
        ...(imageRecipe ? { payloadRecipe: imageRecipe } : { payload: { text: msg.text } }),
      })
      if (accepted) {
        queued++
      } else {
        const canonicalErrorMsg = classifyError(null, { kind: 'queue_full' })
        errors.push({ jid, error: canonicalErrorMsg })
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: 'error', errorMsg: canonicalErrorMsg, sentAt: new Date() },
        }).catch(() => {})
      }
    }
    process.send({ type: 'broadcastResult', requestId: msg.requestId, data: { queued, rejected: errors.length, errors } })
  }

  if (msg?.type === 'channel:metadata') {
    if (!activeSock) {
      process.send({ type: 'channel:metadataResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      const data = await getChannelMetadata({
        sock: activeSock,
        jid: msg.jid,
        inviteCode: msg.inviteCode,
      })
      process.send({ type: 'channel:metadataResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message, jid: msg.jid, inviteCode: msg.inviteCode }, 'channel:metadata falhou')
      process.send({ type: 'channel:metadataResult', requestId: msg.requestId, error: err.message })
    }
    return
  }

  if (msg?.type === 'channel:follow') {
    if (!activeSock) {
      process.send({ type: 'channel:followResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      const data = await followChannel({
        sock: activeSock,
        jid: msg.jid,
        followedSet: followedChannelJids,
        inFlight: inFlightChannelJids,
        logger,
      })
      rememberChannelJid(msg.jid)
      process.send({ type: 'channel:followResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message, jid: msg.jid }, 'channel:follow falhou')
      process.send({ type: 'channel:followResult', requestId: msg.requestId, error: err.message })
    }
    return
  }

  if (msg?.type === 'channel:listFollowed') {
    if (!activeSock) {
      process.send({ type: 'channel:listFollowedResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      // União: canais que o bot seguiu nesta vida + canais detectados no
      // histórico/chats do usuário. Set dedupa automaticamente.
      const data = await listFollowedChannels({
        sock: activeSock,
        followedSet: new Set([...followedChannelJids, ...knownChannelJids]),
      })
      process.send({ type: 'channel:listFollowedResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message }, 'channel:listFollowed falhou')
      process.send({ type: 'channel:listFollowedResult', requestId: msg.requestId, error: err.message })
    }
    return
  }
})

startBot().catch(err => {
  logger.error(err, 'Erro fatal no worker')
  process.exit(1)
})
