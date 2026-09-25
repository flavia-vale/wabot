import 'dotenv/config'
import { resolvePhoneReuseMode, decidePhoneReuse, buildPhoneReuseNotice } from './domain/session/phoneReuse.js'
import { recordPhoneOwnership, loadPreviousPhoneOwners } from './domain/session/phoneOwnership.js'
import { sendAdminAlert } from './email/adminAlerts.js'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  extractMessageContent,
  prepareWAMessageMedia,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import NodeCache from '@cacheable/node-cache'
import { readFileSync, mkdirSync } from 'fs'
import { rm, rename, writeFile, readdir, access } from 'fs/promises'
import { dirname } from 'path'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

import logger from './logger.js'
import { detectLinks } from './detector.js'
import { resolveCustomDomainLinks, findCandidateLinks, allCandidatesFailedBecauseOfferEnded } from './core/customDomainLinkResolver.js'
import { convertLink } from './converters/index.js'
import { buildConversionIssue } from './conversionDiagnostics.js'
import { applyConversionsAndBranding, DEFAULT_BRANDING_CTA_TEXT, hasSignificantTokenOverlap, isCouponAnnouncement, looksLikeGenericCoupon, normalizeBrandingCtaText, normalizeBrandingLink, sanitizeInviteLinks, uniqueConversionsByUrl } from './messageProcessor.js'
import { fetchProductImage as fetchProductImageBase, fetchImageBuffer as fetchImageBufferBase, normalizeImageForWhatsApp as normalizeImageForWhatsAppBase } from './converters/imageScrapers.js'
import { buildInlineThumbnail } from './core/inlineThumbnail.js'
import { composePreviewCardImage } from './core/previewCardCanvas.js'
import { buildStoreBrandCardImage } from './converters/storeBrandCard.js'
import { shouldUseOriginPhotoFallback } from './core/previewImageFallbackPolicy.js'
import { upscaleCardPhotoIfTiny } from './core/cardPhoto.js'
import { resolveLinkKind } from './converters/linkKind.js'
import { shouldUseCouponBrandCard, resolveCouponTextSignal } from './converters/couponBrandCardPolicy.js'
import { isDirectVitrineShare } from './converters/mercadolivre.js'
import { scrapeProductTitle } from './converters/productTitleScraper.js'
import { resolveMonitoredImage, decideSkipActiveFetchForCoupon } from './monitoredImageResolver.js'
import { downloadHighQualityLinkPreview } from './core/linkPreviewThumbnail.js'
import { appendRelayFooter } from './core/relayFooter.js'
import { resolveMonitorDestinations, shouldDropUnlinkedDestination, DESTINATION_REASON } from './core/destinationRouting.js'
import { DELIVERY_KIND } from './core/deliveryKind.js'
import { captureInstagramMirror } from './instagram/mirroring/capture.js'
import { isStorePhotoPreferenceEnabled, shouldPreferStorePhoto } from './core/storePhotoPreference.js'
import { shouldRelayOriginalMediaForImageMode } from './monitoredRelayPolicy.js'
import { shouldReuploadOriginalMedia, destinationImageBaseMode, destinationImageUsesWatermark, effectiveDestinationImageMode, resolveOfferAppearance } from './core/imageModePolicy.js'
import { renderDestinationWatermark } from './core/destinationWatermark.js'
import db from './db.js'
import { getAuthInfoDir, getDedupFile, getKnownChannelsFile } from './paths.js'
import { trackAnalyticsEventSafe } from './analytics.js'
import { recordOperationalSignal } from './observability/operationalSignals.js'
import { shouldIgnoreChatJid, buildAllowedJidSet, shouldIgnoreDesyncedChannel } from './core/ignoredJidPolicy.js'
import { shouldIgnoreByChatScope, shouldAutoDisableChatScope, normalizeChatScopeMode, normalizeJid as normalizeChatScopeJid, CHAT_SCOPE_MODES, DEFAULT_CHAT_SCOPE_PANIC_MS } from './core/chatScopePolicy.js'
import { validateCredentialData } from './credentialHealth.js'
import { sanitizeMessageForLog, truncateByCodePoints, MESSAGE_LOG_MAX_CHARS } from './messageLogSanitizer.js'
import { decryptCredential } from './credentialCrypto.js'
import { persistCredentialPatch } from './credentialPatch.js'
import { createMessageQueue } from './messageQueue.js'
import { createMemorySendBackend, createBullmqSendBackend, finalizeSendJob, resolveBackendMode, findUnserializableField } from './sendQueueBackend.js'
import { buildMirrorDedupKeys } from './core/mirrorDedupKey.js'
import { checkAndSetGlobalDedup } from './core/globalDedup.js'
import { detectKind, JID_KIND } from './core/jid.js'
import { subscribeToMonitorChannels } from './core/channels.js'
import { getChannelMetadata, followChannel, listFollowedChannels } from './core/channelDirectory.js'
import { logFollow } from './core/followGuard.js'
import {
  recordSendResult as recordChannelSendResult,
  recordStreamError as recordChannelStreamError,
} from './core/channelHealth.js'
import { peekDestinationDecision, reserveDestinationSlot } from './core/channelThrottle.js'
import { resolveDestinationPreservation } from './core/preservationConfig.js'
import {
  DESTINATION_SPACING_REASON,
  isDestinationSpacingEnabled,
  toDestinationIntervalMs,
  decideDestinationSpacing,
  combineGateDecisions,
  reserveSpacingSlot,
} from './core/destinationSpacing.js'
import { buildQueueExpiredReason, shouldDropExpiredQueueJob } from './core/queueExpiry.js'
import { buildOutsideSendWindowReason, shouldDropOutsideSendWindow } from './core/sendWindow.js'
import { CONVERSION_FAILURE, buildNoValidConversionsErrorMsg } from './core/conversionFailureReason.js'
import { decideMirrorConversions, findUnconvertedStoreLinks } from './core/mirrorLinkGuard.js'
import { applyVariation, resolveCopyVariationPoolJson } from './core/copyVariation.js'
import { PRESERVATION_FEATURE, isPreservationFeatureEnabled } from './core/preservationFeatures.js'
import { waitUntilDrained, makeInFlightTracker } from './core/drainQueue.js'
import { shouldUseRelayPath, isChannelDestination, isChannelForbiddenError, buildRelayProto, injectChannelForwardIntoPayload, normalizeChannelForwardJid } from './core/channelSend.js'
import { createPairingState, PAIRING_WINDOW_MS_DEFAULT } from './core/pairingState.js'
import { createPairingAuthBackup } from './core/pairingAuthBackup.js'
import { resolveWaWebVersion, WA_VERSION_REGISTRY_URL_DEFAULT, WA_FAILURE_VERSION_REJECTED } from './core/waVersion.js'
import { calcBackoffDelayMs, registerReplacedAndDecide, registerCloseAndDecide, shouldResetBackoff, registerBadSessionAndDecide, shouldResetAuthForBadSession, registerStableCloseAndDecide, shouldConsiderStableCloseCooldown, extractAckMessageIdFromStreamErrorNode, registerStuckMessageAndDecide, extractRemoteJidFromLogArgs } from './core/reconnectPolicy.js'
import { buildAuthResetSessionPatch, buildCloseSessionPatch, buildHeartbeatSessionPatch, computeHeartbeatState, DEFAULT_MAX_RECONNECTING_MS } from './core/sessionPersistencePolicy.js'
import { buildEntitledGroupConfig } from './billing/groupEntitlements.js'
import { getAdvancedPreservationAccess, isPreservationActive } from './billing/plans.js'
// Feature 017 (arquitetura multicanal de entrega), D-A2: sendPreparedPayload
// é o único ponto que fala com o socket do WhatsApp, movido para o adaptador
// de WhatsApp com o corpo INALTERADO (test/delivery-whatsapp-send-inalterado.test.js).
import { sendPreparedPayload } from './delivery/whatsapp/send.js'
import { DELIVERY_NETWORK } from './core/delivery/networks.js'
import { enqueueDeliveryOutbox } from './deliveryOutbox/enqueue.js'
import { calculateProgressiveDelayMs, calculateRestWindowDelayMs, calculateTypingDelayMs } from './smartDelay.js'
import { buildMonitoredMessagePayload } from './monitoredMessagePayload.js'
import { applyMirrorTemplate } from './core/mirrorTemplate.js'
import { convertPerPlatformSerially } from './core/conversionScheduler.js'
import { chooseCoupon, renderCouponText, applyCouponToken, sanitizePriceCents } from './core/clientCouponPolicy.js'
import { buildIncomingDedupKey, hasRecentDedupEntry, hasSeenIncomingId, pruneDedupStore, rememberDedupEntry, rememberSeenIncomingId } from './messageDedup.js'
import { INCOMING_ACCEPT_REASON, INCOMING_DROP_REASON, INCOMING_LATE_MAX_AGE_MS, INCOMING_MAX_AGE_MS, shouldProcessIncomingMessage } from './core/incomingFreshness.js'
import { classifyError } from './errorTaxonomy.js'
import { recoverStuckSendLogs, STUCK_SEND_LOG_CUTOFF_MS } from './jobs/stuckSendLogs.js'
import { detectMessageKind, extractIncomingText, normalizeForwardingPolicy, shouldForwardMessage } from './forwardingPolicy.js'
import { broadcastSourceGroup } from './offerQueue/sourceTag.js'
import Redis from 'ioredis'
import { parseEnumEnv, logModeSummary } from './core/envModes.js'
import { buildRedisOptions } from './core/redisFactory.js'
import { installWorkerCrashGuards } from './core/workerCrashGuard.js'
import { buildWorkerMetadata } from './workerMetadata.js'
import { recordWaConnectionEventSafe } from './waConnectionTelemetry.js'
import { createDurableStuckMessageRetryCache } from './core/stuckMessageQuarantine.js'
import { decideRetryPace, RETRY_ACTION, DEFAULT_GIVEUP_ATTEMPTS, DEFAULT_SLOW_INTERVAL_MS, DEFAULT_NEVER_CONNECTED_MAX } from './core/reconnectGiveupPolicy.js'
import { computeReceptionState, isReceptionProblem, DEFAULT_RECEPTION_WINDOW_MS, DEFAULT_RECEPTION_MIN_FAILURES, DEFAULT_BLIND_ACROSS_RECONNECTS_MS } from './core/receptionHealth.js'
import { shouldSelfHealReception, DEFAULT_SILENCE_MS, DEFAULT_BASELINE_WINDOW_MS, DEFAULT_MIN_BASELINE, DEFAULT_COOLDOWN_MS, DEFAULT_MAX_PER_DAY } from './core/receptionSelfHeal.js'
import {
  resolveSelfWelcomePilotEmails,
  isPilotEmail,
  shouldSendSelfWelcomeMessage,
  decideActivationNudge,
  buildSelfWelcomeMessageText,
  buildFirstOfferPublishedMessageText,
  buildMissingCredentialNudgeText,
  buildMissingGroupsNudgeText,
  buildAdminSupportMessageText,
} from './core/selfWelcomeMessage.js'
import { VIDEO_CADASTRO_ETIQUETAS_URL, VIDEO_ATIVACAO_ROBO_URL } from './tutorialVideo.js'
import sharp from 'sharp'
import { applySharpTuning } from './core/sharpTuning.js'

// Cache e pool de threads do libvips. Roda UMA vez, no load do módulo, porque o
// ajuste é global do processo (não por operação). Sem env configurada é no-op e
// o Sharp fica com os padrões dele — ver src/core/sharpTuning.js.
//
// ⚠️ Depende só de imports; NÃO referenciar constante de escopo de módulo aqui.
// Uma linha acima de qualquer `const` deste arquivo estoura ReferenceError (TDZ)
// no load e mata TODO worker no boot — foi o que quase aconteceu com o log dos
// filtros de recepção (ver AGENTS.md).
const sharpTuning = applySharpTuning(sharp, process.env)
if (!sharpTuning.skipped) {
  logger.info({ ...sharpTuning.applied, erro: sharpTuning.error }, 'Ajuste de memória do Sharp aplicado')
}

export async function createBotSessionRuntime({
  userId = process.env.BOT_USER_ID,
  sendIpc = message => process.send?.(message),
  exitRuntime = code => process.exit(code),
  registerProcessHandlers = false,
  autoStart = false,
  sharedLimits = {},
  ownerInstance = process.env.NODE_APP_INSTANCE ?? '0',
} = {}) {
const withLimit = (semaphore, task) => semaphore?.run ? semaphore.run(task) : task()
const fetchProductImage = (...args) => withLimit(sharedLimits.scrapingSemaphore, () => fetchProductImageBase(...args))
const fetchImageBuffer = (...args) => withLimit(sharedLimits.scrapingSemaphore, () => fetchImageBufferBase(...args))
const normalizeImageForWhatsApp = (...args) => withLimit(sharedLimits.sharpSemaphore, () => normalizeImageForWhatsAppBase(...args))
const WORKER_STARTED_AT = Date.now()
const workerMetadata = buildWorkerMetadata({ userId, startedAt: WORKER_STARTED_AT })
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 })
eventLoopDelay.enable()

function getRuntimeMemoryMetrics() {
  const memory = process.memoryUsage()
  const nsToMs = value => Number.isFinite(value) ? Math.round((value / 1e6) * 100) / 100 : null
  return {
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
    eventLoopDelayMs: {
      p50: nsToMs(eventLoopDelay.percentile(50)),
      p95: nsToMs(eventLoopDelay.percentile(95)),
      p99: nsToMs(eventLoopDelay.percentile(99)),
      max: nsToMs(eventLoopDelay.max),
    },
  }
}

// Guardas de processo: um throw assíncrono benigno do Baileys num socket já
// fechado (ex.: 428 "Connection Closed" disparado por sendRetryRequest após um
// conflito/replaced 440) não pode matar o worker — senão a reconexão automática
// agendada no connection.update nunca roda e a sessão fica offline até religar
// manual. Ver src/core/workerCrashGuard.js.
if (registerProcessHandlers) installWorkerCrashGuards({
  logger,
  onFatal: () => { setTimeout(() => exitRuntime(1), 50).unref?.() },
})


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

// Nudge anti-ban (P1-3): em produção, com dedup global ativa, fail-open deixa
// passar um envio duplicado quando o Redis pisca — exatamente o cenário que
// gera ban. O recomendado é REDIS_DEDUP_FAIL_MODE=closed (derruba só a mensagem
// corrente, recuperável). Avisamos no boot em vez de mudar o default
// silenciosamente, porque a virada fail-open→closed é mudança de semântica que
// deve ser validada em staging antes (ver docs/redis-bullmq-resilience-audit.md).
if (String(process.env.APP_ENV) === 'production' && Boolean(process.env.REDIS_URL) && GLOBAL_DEDUP_MODE !== 'off' && REDIS_DEDUP_FAIL_MODE === 'open') {
  logger.warn('REDIS_DEDUP_FAIL_MODE=open em produção: num blip de Redis a dedup global pode DUPLICAR um envio (risco de ban). Recomendado setar REDIS_DEDUP_FAIL_MODE=closed no .env (validar em staging antes).')
}

function useGlobalRedis() {
  if (!process.env.REDIS_URL) return false
  if (GLOBAL_RATE_LIMIT_MODE === 'off' && GLOBAL_DEDUP_MODE === 'off') return false
  return true
}

function ensureRuntimeRedis() {
  if (!useGlobalRedis()) return null
  if (runtimeRedis) return runtimeRedis
  runtimeRedis = new Redis(process.env.REDIS_URL, buildRedisOptions('bot-worker-runtime', { lazyConnect: false, maxRetriesPerRequest: null }))
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

// TTL fixo (não o ttlMs do chamador) que a CHAVE do Redis usa pra se
// autolimpar — só limita memória, não representa mais a janela lógica de
// dedup (ver comentário dentro de globalDedupCheckAndSet: por quê).
const GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS = Math.max(60_000, Number(process.env.GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS) || 24 * 60 * 60_000)

// SendDedupKey (tabela SQLite) só existe pra fechar a corrida de
// milissegundos entre o findFirst diagnóstico e o create do MessageLog (ver
// uso em startBotInner) — não representa a janela lógica de dedup (essa é
// decidida por dedup local + MessageLog/DB + Redis, que reavaliam a janela
// atual a cada checagem). Fixo e curto de propósito: usar a janela lógica do
// linkKind aqui (como era antes) prendia reservas de CUPOM com o TTL da
// janela ANTIGA (até 24h) sempre que o índice único continuava ocupado —
// bug real reportado em produção.
const SEND_DEDUP_RESERVATION_TTL_MS = Math.max(30_000, Number(process.env.SEND_DEDUP_RESERVATION_TTL_MS) || 5 * 60_000)

// Idade máxima considerada para um envio AINDA PENDENTE (status queued/sending)
// contar como duplicata na dedup por DB.
//
// RCA 2026-07 (mensagem espelhada 5x): a dedup por DB só enxergava linhas com
// `sentAt` DENTRO da janela do link (120min). Só que `sentAt` de uma linha
// `queued` é o momento em que ela foi criada, e um job pode ficar horas parado
// na fila esperando a preservação do destino (horário de funcionamento, burst
// cap, daily cap — ver deferSendJob). Passados os 120min, a linha pendente
// ficava INVISÍVEL pra dedup: a mesma oferta reofertada pelo WhatsApp entrava
// de novo, e quando a janela do destino abria as duas (ou cinco) saíam em
// sequência, espaçadas pelo throttle. Uma mensagem que ainda NÃO foi entregue
// é duplicata independente da idade — só limitamos por este teto pra que uma
// linha presa em `queued` por bug não bloqueie o destino pra sempre.
const PENDING_DEDUP_MAX_AGE_MS = Math.max(60_000, Number(process.env.PENDING_DEDUP_MAX_AGE_MS) || 24 * 60 * 60_000)

async function globalDedupCheckAndSet(key, ttlMs) {
  const r = ensureRuntimeRedis()
  if (!r) return { duplicate: false }
  try {
    // Lógica em core/globalDedup.js (testada com ioredis-mock em
    // test/core/global-dedup.test.js) — bot-worker.js é grande demais pra
    // importar em teste sem efeitos colaterais, então essa extração é o que
    // permite cobertura funcional de verdade (não só regex no source) pra
    // uma lógica que já causou incidente real de cupom preso em dedup.
    return await checkAndSetGlobalDedup(r, `dedup:${userId}:${key}`, ttlMs, { safetyCapMs: GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS })
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
if (!userId) throw new Error('BOT_USER_ID não definido')
const OWNER_INSTANCE = ownerInstance
const SESSION_ERROR_WINDOW_MS = Math.max(30_000, Number(process.env.WA_SESSION_ERROR_WINDOW_MS || 120_000))
const SESSION_ERROR_THRESHOLD = Math.max(5, Number(process.env.WA_SESSION_ERROR_THRESHOLD || 30))
const SESSION_RECOVERY_COOLDOWN_MS = Math.max(60_000, Number(process.env.WA_SESSION_RECOVERY_COOLDOWN_MS || 300_000))

let cachedBaileysVersion = null

// Saúde de cripto exposta ao painel (banner global "reconecte"). Detectamos o
// sintoma observável de sessão dessincronizada: o Baileys manda "sent retry
// receipt" a cada mensagem que NÃO conseguiu descriptografar (Bad MAC /
// MessageCounterError). Janela e limiar menores que os de auto-recovery porque
// o objetivo aqui é AVISAR a usuária antes que ela fique cega — não derrubar a
// sessão. Só sinaliza 'degraded' com a sessão já conectada (READY).
const WA_SESSION_DEGRADED_WINDOW_MS = Math.max(60_000, Number(process.env.WA_SESSION_DEGRADED_WINDOW_MS || 10 * 60_000))
const WA_SESSION_DEGRADED_THRESHOLD = Math.max(2, Number(process.env.WA_SESSION_DEGRADED_THRESHOLD || 5))
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

// Fix de causa raiz (RCA 2026-07 — ver src/core/ignoredJidPolicy.js): ignorar no
// socket Baileys as mensagens de grupos @g.us que o robô NÃO monitora. Um grupo
// dessincronizado que o cliente participa mas o robô não usa derrubava a sessão
// a cada ~50min via retry-receipt → stream:error 500. Default OFF (rollout
// seguro / reversível sem redeploy); ligar só após validar em staging.
const IGNORE_UNMONITORED_GROUPS = String(process.env.WA_IGNORE_UNMONITORED_GROUPS || '0') === '1'
// Allowlist normalizado (monitor + destino + canal-botão), atualizado a cada
// getConfig(). `ready` só vira true depois da 1ª carga — antes disso não
// ignoramos nada (default seguro no boot). Escopo de módulo: sobrevive a
// reconexões do MESMO worker.
let allowedChatJids = new Set()
let allowedChatJidsReady = false

// RCA 2026-08-29: mensagem de uma origem MONITORADA podia ser descartada em
// silêncio total — sem linha no bot.log e sem linha em Envios. Aconteceram dois
// `return` mudos logo depois de a origem ser reconhecida (texto que virou vazio
// ao remover convites; mensagem sem link e sem texto aproveitável). Do lado da
// cliente isso é indistinguível de "o robô parou": ela manda a oferta no grupo
// monitorado e não aparece absolutamente nada em lugar nenhum. Foi exatamente o
// que travou o diagnóstico de staging por horas.
//
// Por que era mudo de propósito: um reconnect dispara rajada de
// senderKeyDistribution/protocolMessage nos grupos, e logar por MENSAGEM
// inundaria o bot.log (que já passa de 400MB). A saída é a mesma do escopo de
// conversas (`reviewChatScope`): AGREGAR — no máximo uma linha por origem por
// minuto, carregando quantas foram suprimidas desde a última. Escopo de módulo
// para sobreviver às reconexões do MESMO worker.
const MONITORED_DROP_LOG_INTERVAL_MS = Math.max(0, Number(process.env.MONITORED_DROP_LOG_INTERVAL_MS ?? 60_000))
const monitoredDropLogState = new Map()

// Oferta publicada pelo SITE PRÓPRIO do grupo de origem (RCA 2026-09-13): o
// texto traz `https://<dominio-dele>/p/xxx` em vez do link da loja. Sem este
// passo o sanitizador apaga essa URL (ela credita o concorrente),
// `detectLinks` não acha nada e a oferta morre como `nolink` — do lado de fora,
// "o robô não espelha".
//
// Desembrulhar ANTES do sanitizador faz o resto do pipeline (sanitizador,
// detector, conversor, dedup, imagem) seguir sem NENHUMA mudança, e quem
// converte continua sendo o conversor da loja com a credencial da cliente — a
// comissão é dela, não de quem publicou. A decisão é por LINK: mensagem MISTA
// (alguns produtos com link direto da loja, outros pelo site do dono do grupo)
// também é desembrulhada — era o que perdia os links do 3º produto em diante
// (RCA 2026-09-17). Só gasta rede quando há URL que não é de loja; qualquer
// falha devolve o texto como veio.
// Devolve `{ text, failures }`: o motivo da falha precisa chegar ao painel, e
// não só ao log. Sem ele, oferta ENCERRADA no site de origem era mostrada à
// cliente como "ainda não fazemos conversão para essa loja" — falso, e com ação
// oposta (RCA 2026-09-19).
async function unwrapCustomDomainOfferLinks(text, { userId, jid, msgId } = {}) {
  if (!text) return { text, failures: [] }
  try {
    const desembrulhado = await resolveCustomDomainLinks(text)
    // Candidato que NÃO resolveu precisa deixar rastro com o motivo: em
    // 2026-09-13 este caminho devolveu só `null` em staging, com código no ar,
    // rede boa e a página trazendo o link — e não havia por onde começar.
    if (desembrulhado.failures?.length) {
      logger.warn({ msgId, jid, falhas: desembrulhado.failures }, 'Link de domínio próprio NÃO resolveu até a loja')
    }
    if (!desembrulhado.resolved.length) return { text, failures: desembrulhado.failures || [] }
    logger.info({ msgId, jid, resolvidos: desembrulhado.resolved }, 'Link de domínio próprio desembrulhado até a loja')
    for (const item of desembrulhado.resolved) {
      try { recordOperationalSignal('custom_domain_link_resolved', { userId, platform: item.platform }) } catch {}
    }
    return { text: desembrulhado.text, failures: desembrulhado.failures || [] }
  } catch (err) {
    logger.warn({ msgId, jid, err: err?.message }, 'Falha ao desembrulhar link de domínio próprio — seguindo com o texto original')
    return { text, failures: [] }
  }
}

function logMonitoredSourceDrop(jid, reason, details = {}) {
  const now = Date.now()
  const entry = monitoredDropLogState.get(jid) || { lastLoggedAt: 0, suppressed: 0 }
  if (now - entry.lastLoggedAt < MONITORED_DROP_LOG_INTERVAL_MS) {
    entry.suppressed += 1
    monitoredDropLogState.set(jid, entry)
    return
  }
  monitoredDropLogState.set(jid, { lastLoggedAt: now, suppressed: 0 })
  logger.info(
    { jid, reason, suppressedSinceLast: entry.suppressed, ...details },
    'Origem monitorada: mensagem descartada antes de virar oferta',
  )
}

// Cache jid→nome (subject) preenchido no groupFetchAllParticipating. Best-effort,
// só para anexar o NOME do grupo culpado nos eventos de desync (Part B —
// visibilidade admin), evitando que a operadora precise cruzar o jid na mão.
const groupSubjectByJid = new Map()

// Fase 2 do plano de recepção (RCA 2026-08-26): "olhar só o que foi escolhido".
// Inverte a lista de exceções acima — ver src/core/chatScopePolicy.js. Modo em
// degraus, default `off`, rollback sem redeploy pela env.
const CHAT_SCOPE_MODE = normalizeChatScopeMode(process.env.WA_CHAT_SCOPE_MODE)
const CHAT_SCOPE_PANIC_MS = Math.max(0, Number(process.env.WA_CHAT_SCOPE_PANIC_MS ?? DEFAULT_CHAT_SCOPE_PANIC_MS))
const CHAT_SCOPE_SIGNAL_INTERVAL_MS = Math.max(5 * 60_000, Number(process.env.WA_CHAT_SCOPE_SIGNAL_INTERVAL_MS || 60 * 60_000))
const CHAT_SCOPE_LOG_SAMPLE_PER_TYPE = Math.max(0, Number(process.env.WA_CHAT_SCOPE_LOG_SAMPLE || 5))

// Identidades da própria conta (número e `@lid`). Preenchido no `open` — é por
// elas que chegam histórico e notificações da própria conta.
let selfChatJids = new Set()
// Freio de emergência: quando aciona, vale até o restart do worker.
let chatScopeDisabled = false
// Contagem do que foi ignorado, por tipo. Sem isto trocaríamos um problema
// visível (mensagem some do log) por um invisível.
let chatScopeIgnoredByType = new Map()
let chatScopeIgnoredSinceLastAccepted = 0
let chatScopeSampledJids = new Map()
let lastChatScopeSignalAt = 0

function recordChatScopeIgnored(type, jid) {
  chatScopeIgnoredByType.set(type, (chatScopeIgnoredByType.get(type) || 0) + 1)
  chatScopeIgnoredSinceLastAccepted += 1
  // Amostra limitada: os primeiros N endereços distintos por tipo, para dar
  // rastro sem inflar o log (mensagem ignorada é evento de alto volume).
  if (CHAT_SCOPE_LOG_SAMPLE_PER_TYPE <= 0) return
  const seen = chatScopeSampledJids.get(type) || new Set()
  if (seen.size >= CHAT_SCOPE_LOG_SAMPLE_PER_TYPE || seen.has(jid)) return
  seen.add(jid)
  chatScopeSampledJids.set(type, seen)
  logger.info({ jid, type, mode: CHAT_SCOPE_MODE }, 'Conversa fora da lista de escolhidos: confirmada e descartada sem tentar abrir')
}

function getChatScopeSnapshot() {
  return {
    mode: CHAT_SCOPE_MODE,
    disabled: chatScopeDisabled,
    ignoredByType: Object.fromEntries(chatScopeIgnoredByType),
    ignoredSinceLastAccepted: chatScopeIgnoredSinceLastAccepted,
  }
}

// Roda junto do heartbeat. Duas coisas: o freio de emergência e o sinal
// durável agregado (nunca por mensagem).
function reviewChatScope() {
  if (CHAT_SCOPE_MODE === CHAT_SCOPE_MODES.OFF) return
  const now = Date.now()
  if (shouldAutoDisableChatScope({
    now,
    enabled: true,
    alreadyDisabled: chatScopeDisabled,
    everAccepted: lastAcceptedAtMs != null,
    lastAcceptedAtMs,
    ignoredSinceLastAccepted: chatScopeIgnoredSinceLastAccepted,
    panicMs: CHAT_SCOPE_PANIC_MS,
  })) {
    chatScopeDisabled = true
    logger.error({
      mode: CHAT_SCOPE_MODE,
      ignoredSinceLastAccepted: chatScopeIgnoredSinceLastAccepted,
      lastAcceptedAgeMs: now - lastAcceptedAtMs,
    }, 'FREIO DE EMERGÊNCIA: a conta parou de receber mensagem com a regra de escopo ligada — regra desligada sozinha, tudo volta a passar até o próximo restart')
    try { recordOperationalSignal('wa_chat_scope_auto_disabled', { userId, mode: CHAT_SCOPE_MODE, ignored: chatScopeIgnoredSinceLastAccepted }) } catch {}
    return
  }
  if (now - lastChatScopeSignalAt < CHAT_SCOPE_SIGNAL_INTERVAL_MS) return
  lastChatScopeSignalAt = now
  if (chatScopeIgnoredByType.size === 0) return
  const ignoredByType = Object.fromEntries(chatScopeIgnoredByType)
  logger.info({ mode: CHAT_SCOPE_MODE, ignoredByType }, 'Resumo do escopo de conversas na janela')
  try { recordOperationalSignal('wa_chat_scope_filtered', { userId, mode: CHAT_SCOPE_MODE, ...ignoredByType }) } catch {}
  chatScopeIgnoredByType = new Map()
  chatScopeSampledJids = new Map()
}

function updateAllowedChatJids(groups) {
  try {
    const jids = [
      ...(groups?.monitorJids ?? []),
      ...(groups?.post ?? []),
      ...((groups?.postDetails ?? []).map(detail => detail?.channelButtonJid).filter(Boolean)),
    ]
    allowedChatJids = buildAllowedJidSet(jids)
    allowedChatJidsReady = true
    monitoredSourceCount = (groups?.monitorJids ?? []).length
  } catch {
    // Nunca deixa a atualização do allowlist quebrar o getConfig.
  }
}

let activeSock = null
let pendingSock = null  // socket criado mas ainda não conectado (disponível para pairing code)
let shuttingDown = false

// RCA 2026-07: por padrão o Baileys cria `msgRetryCounterCache` e
// `placeholderResendCache` do zero a cada makeWASocket() — ou seja, a cada
// reconexão. Isso zera o contador de tentativas de qualquer mensagem que o
// cliente não conseguiu decifrar (ex.: edição de mensagem de canal/@newsletter
// com sessão de chave dessincronizada): o Baileys deveria desistir depois de
// `maxMsgRetryCount` (5, default) e a TTL de 1h, mas como o contador nunca
// sobrevive à próxima reconexão, ele nunca chega a 5 — o WhatsApp reoferece a
// MESMA mensagem pra sempre, cada oferta rejeitada derruba o stream inteiro
// (`stream:error`), e a queda reseta o contador de novo. Loop que se
// autoalimenta: a queda impede a mensagem de ser esquecida, e a mensagem não-
// esquecida causa a próxima queda (caso real: sessão caindo a cada ~50min por
// dias seguidos presa numa única mensagem). A cache comum vive no escopo do
// módulo; a quarentena dos ids comprovadamente travados também é persistida no
// AUTH_DIR para sobreviver a restart do worker e ao `del` interno do Baileys.
const WA_MAX_MSG_RETRY_COUNT = 5
const msgRetryCounterCache = createDurableStuckMessageRetryCache({
  file: `${getAuthInfoDir(userId)}/stuck-message-quarantine.json`,
  maxRetryCount: WA_MAX_MSG_RETRY_COUNT,
  logger,
})
const placeholderResendCache = new NodeCache({ stdTTL: 60 * 60, useClones: false })
// Timestamp (Date.now()) até quando uma reconexão automática já está agendada
// (setTimeout(startBot, ...) pendente). Existe um intervalo real entre o close
// (activeSock/pendingSock viram null) e o próximo startBot() de fato criar um
// socket novo — de 5s (delay mínimo) a até 30min (cooldown de quedas estáveis/
// flap/replaced). Sem isso o heartbeat (persistWorkerHeartbeat) via de tratar
// esse intervalo como 'idle' e sobrescrever o status 'connecting' que o close
// setou de propósito, fazendo o painel mostrar "desconectado" numa sessão que
// vai se reconectar sozinha. Não é setado quando o close é terminal (logout,
// reset de auth por badSession, ou pairing pré-código) — nesses casos o
// próximo startBot só ocorre por ação do usuário, então 'idle'/disconnected
// está correto.
let reconnectDeadlineMs = 0

// Marca desde quando a sessão está sem `connected` (null enquanto conectada).
// Setado na PRIMEIRA vez que se sai de `connected` (não é resetado a cada
// retry dentro do mesmo episódio de queda) — é o que permite ao heartbeat
// medir "há quanto tempo estamos tentando" e desistir de mostrar 'connecting'
// depois de MAX_RECONNECTING_MS (válvula de segurança contra loop escondido
// do cliente; ver computeHeartbeatState em core/sessionPersistencePolicy.js).
let disconnectedSinceMs = Date.now()
const MAX_RECONNECTING_MS = Math.max(30_000, envNumber('WA_HEARTBEAT_MAX_RECONNECTING_MS', DEFAULT_MAX_RECONNECTING_MS))

function scheduleReconnect(delayMs, metadata = {}) {
  reconnectDeadlineMs = Date.now() + Math.max(0, delayMs)
  recordWaConnectionEventSafe({
    userId,
    type: 'reconnect_attempt',
    code: metadata.code,
    lifecycle: lifecycleState,
    ownerInstance: OWNER_INSTANCE,
    metadata: { delayMs: Math.max(0, delayMs), attempt: reconnectAttempts, reason: metadata.reason || 'scheduled' },
  })
  setTimeout(startBot, delayMs)
}

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

// Sinais de falha de decrypt para o indicador de saúde da sessão no painel.
let cryptoErrorTimestamps = []
let lastCryptoErrorAt = null

let heartbeatTimer = null
let lastHeartbeatPersistAt = 0

async function persistWorkerHeartbeat(state, { reconnectScheduled = false } = {}) {
  // Heartbeat IPC tells the manager process that the worker process is alive,
  // but the dashboard reads WaSession from the DB. Persist a lightweight,
  // throttled heartbeat so the panel cannot keep showing "connected" when
  // the worker is alive but Baileys has no active socket.
  const now = Date.now()
  const intervalMs = Math.max(Number(process.env.WA_HEARTBEAT_DB_INTERVAL_MS || 60000), 15000)
  if (now - lastHeartbeatPersistAt < intervalMs) return
  lastHeartbeatPersistAt = now

  const patch = {
    lastHeartbeatAt: new Date(),
    ownerInstance: OWNER_INSTANCE,
    ...buildHeartbeatSessionPatch({ state, reconnectScheduled }),
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
    const reconnectScheduled = Date.now() < reconnectDeadlineMs
    const state = computeHeartbeatState({
      hasActiveSock: Boolean(activeSock),
      hasPendingSock: Boolean(pendingSock),
      hasReconnectScheduled: reconnectScheduled,
      disconnectedForMs: disconnectedSinceMs == null ? 0 : Date.now() - disconnectedSinceMs,
      maxReconnectingMs: MAX_RECONNECTING_MS,
    })
    if (sendIpc) sendIpc({ type: 'heartbeat', ts: Date.now(), state })
    try { reportReceptionHealth(getReceptionHealth()) } catch {}
    try { trySelfHealReception() } catch (err) { logger.warn({ err: err?.message }, 'Falha na checagem de auto-cura de recepção') }
    try { reviewChatScope() } catch {}
    maybeSendActivationNudge().catch(() => {})
    void persistWorkerHeartbeat(state, { reconnectScheduled })
  }, intervalMs)
  heartbeatTimer.unref?.()
}
function stopHeartbeatIpc() {
  if (!heartbeatTimer) return
  clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

const AUTH_DIR = getAuthInfoDir(userId)
// A credencial atual NÃO é apagada ao iniciar o pareamento — vai para um
// backup e volta se o pareamento falhar antes de o código chegar ao usuário.
// Sem isso, um clique em "conectar" durante uma recusa do WhatsApp (405)
// destruía a credencial boa e travava a sessão de vez (RCA 2026-07-28).
const pairingAuthBackup = createPairingAuthBackup({ authDir: AUTH_DIR, fs: { rename, rm, access }, logger })
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
    // Ids ACEITOS nas últimas SEEN_INCOMING_ID_WINDOW_MS (RCA 2026-09-24):
    // é o que permite aceitar mensagem atrasada de origem monitorada sem
    // reabrir a reoferta do RCA 2026-07. Em disco de propósito — o reinício
    // em massa da frota (56 contas às 01h e 06h de 24/09) recriaria um
    // conjunto vazio em memória e a fila offline drenada na volta entraria
    // toda de novo.
    seenIds: store?.seenIds && typeof store.seenIds === 'object' ? store.seenIds : {},
  }
}

function loadDedup() {
  try { return normalizeDedup(JSON.parse(readFileSync(DEDUP_FILE, 'utf8'))) }
  catch { return { msgIds: [], links: {}, seenIds: {} } }
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

// Confere se o número que acabou de conectar já foi usado por outra conta e,
// conforme o modo, avisa ou recusa. Ver src/domain/session/phoneReuse.js para
// as quatro invariantes — em especial: conta pagante nunca é bloqueada, e sem
// dado confiável a sessão CONTINUA conectada.
async function handlePhoneOwnership({ phone, sock }) {
  const modo = resolvePhoneReuseMode()
  await recordPhoneOwnership({ db, userId, phone })
  if (modo === 'off') return

  const [anteriores, user] = await Promise.all([
    loadPreviousPhoneOwners({ db, phone, currentUserId: userId }),
    db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, plan: true, accessExpiresAt: true } }),
  ])
  const decisao = decidePhoneReuse({ phone, currentUser: user ?? { id: userId }, previousOwners: anteriores, mode: modo })
  if (decisao.acao === 'permitir') return

  logger.warn({ motivo: decisao.motivo, contas: decisao.contas.length, acao: decisao.acao }, 'Número de WhatsApp já usado por outra conta')
  trackAnalyticsEventSafe({
    userId,
    event: decisao.acao === 'bloquear' ? 'ops_wa_phone_reuse_blocked' : 'ops_wa_phone_reuse_detected',
    metadata: { motivo: decisao.motivo, contas: decisao.contas.length },
  })
  // E-mail interno: sinal em `AnalyticsEvent` fica no banco e ninguém consulta
  // — foi essa a lição do `ops_stale_worker_code`. O canal interno tem cooldown
  // de 24h por assunto e `key` leva a conta, então duas contas no mesmo dia
  // geram dois avisos, e a mesma conta reconectando não vira rajada.
  sendAdminAlert({
    db,
    slug: 'admin_numero_repetido',
    key: userId,
    vars: {
      cliente: user?.email ?? userId,
      contas_anteriores: decisao.contas.join(', '),
      o_que_aconteceu: decisao.acao === 'bloquear'
        ? 'A conexão foi recusada (trava ligada)'
        : 'A conexão foi permitida (modo aviso)',
      quando: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    },
    logger,
  }).catch(() => {})

  if (decisao.acao !== 'bloquear') return

  const aviso = buildPhoneReuseNotice({ motivo: decisao.motivo, previousEmail: anteriores[0]?.email })
  await persistSessionPatch({
    status: 'disconnected',
    lifecycle: 'phone_reuse_blocked',
    blockNotice: JSON.stringify(aviso),
  }).catch(() => {})
  // Encerra a sessão SEM apagar credencial: a recusa é de política, não de
  // pareamento, e apagar o auth faria a cliente escanear um QR novo para bater
  // na mesma parede.
  try { sock?.end?.(new Error('phone_reuse_blocked')) } catch { /* best-effort */ }
}

// Mensagem de boas-vindas pelo PRÓPRIO WhatsApp, na primeira conexão de
// contas do PILOTO (ver src/core/selfWelcomeMessage.js — plano de reforço de
// ativação, 2026-09-23). Best-effort e fail-safe: qualquer falha aqui não pode
// derrubar a conexão real; a decisão de ENVIAR já foi tomada por quem chama
// (precisa saber se `WaSession.phone` já tinha valor ANTES desta conexão).
//
// Toda mensagem pelo próprio WhatsApp (automática ou manual da admin) grava
// em CustomerContactLog — a MESMA tabela do "Registrar contato de CS" — para
// aparecer no histórico único da aba "Contato com cliente" e no drill-down
// da cliente em /admin/clientes/[id]. Best-effort: falha aqui nunca pode
// derrubar o envio real, que já aconteceu.
async function logWhatsappSelfMessageContact({ reason, texto, actorUserId = null }) {
  try {
    await db.customerContactLog.create({
      data: { userId, channel: 'whatsapp', reason, outcome: 'contacted', notes: texto, actorUserId },
    })
  } catch (err) {
    logger.warn({ err: String(err?.message ?? err), reason }, 'Falha ao registrar contato de WhatsApp no histórico (best-effort)')
  }
}

async function maybeSendSelfWelcomeMessage({ phone, sock, hadPhoneBefore }) {
  try {
    const pilotEmails = resolveSelfWelcomePilotEmails()
    if (!pilotEmails.length) return
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
    const deve = shouldSendSelfWelcomeMessage({ accountEmail: user?.email, hadPhoneBefore, pilotEmails })
    if (!deve || !phone) return
    const jid = `${phone}@s.whatsapp.net`
    const texto = buildSelfWelcomeMessageText({ videoUrl: VIDEO_CADASTRO_ETIQUETAS_URL })
    await sock.sendMessage(jid, { text: texto })
    logger.info({ userId }, 'Mensagem de boas-vindas (piloto de ativação) enviada para o próprio número')
    trackAnalyticsEventSafe({ userId, event: 'ops_self_welcome_message_sent' })
    logWhatsappSelfMessageContact({ reason: 'boas_vindas_conexao', texto })
  } catch (err) {
    logger.warn({ err: String(err?.message ?? err) }, 'Falha ao enviar mensagem de boas-vindas (piloto, best-effort)')
  }
}

// Mensagem de "prova de valor" pelo PRÓPRIO WhatsApp, na 1ª oferta publicada
// com sucesso (momento 2 — ver src/core/selfWelcomeMessage.js). Chamada só
// quando `previousSuccessCount === 0`, no `onDone` do envio espelhado — é o
// mesmo instante em que `first_send_success` já é gravado, então os dois
// nascem juntos e nunca discordam sobre "foi a primeira".
async function maybeSendFirstOfferMessage() {
  try {
    if (!activeSock) return
    const pilotEmails = resolveSelfWelcomePilotEmails()
    if (!pilotEmails.length) return
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!isPilotEmail(user?.email, pilotEmails)) return
    const phone = activeSock.user?.id?.split(':')[0] ?? null
    if (!phone) return
    const texto = buildFirstOfferPublishedMessageText()
    await activeSock.sendMessage(`${phone}@s.whatsapp.net`, { text: texto })
    logger.info({ userId }, 'Mensagem de 1ª oferta publicada (piloto) enviada para o próprio número')
    trackAnalyticsEventSafe({ userId, event: 'ops_self_first_offer_message_sent' })
    logWhatsappSelfMessageContact({ reason: 'primeira_oferta_publicada', texto })
  } catch (err) {
    logger.warn({ err: String(err?.message ?? err) }, 'Falha ao enviar mensagem de 1ª oferta (piloto, best-effort)')
  }
}

// Throttle do nudge de ativação (momentos 3 e 4): a checagem roda a cada tick
// do heartbeat (15s), mas só precisa AVALIAR de tempos em tempos — em escopo
// de módulo pra sobreviver a reconexões dentro do MESMO worker (mesma lição
// do msgRetryCounterCache).
let lastActivationNudgeCheckAt = 0
const ACTIVATION_NUDGE_CHECK_INTERVAL_MS = Math.max(
  Number(process.env.SELF_ACTIVATION_NUDGE_CHECK_INTERVAL_MS || 30 * 60 * 1000),
  5 * 60 * 1000,
)
const ACTIVATION_NUDGE_MIN_DELAY_MS = Math.max(
  Number(process.env.SELF_ACTIVATION_NUDGE_MIN_DELAY_MS || 24 * 60 * 60 * 1000),
  0,
)

// Nudge de ativação pelo PRÓPRIO WhatsApp — momentos 3 (falta etiqueta) e 4
// (falta grupo), 24h depois da 1ª conexão (ver decideActivationNudge em
// src/core/selfWelcomeMessage.js). Best-effort e fail-safe: qualquer falha
// aqui é só logada, nunca afeta a sessão real.
async function maybeSendActivationNudge() {
  if (!activeSock) return
  const now = Date.now()
  if (now - lastActivationNudgeCheckAt < ACTIVATION_NUDGE_CHECK_INTERVAL_MS) return
  lastActivationNudgeCheckAt = now
  try {
    const pilotEmails = resolveSelfWelcomePilotEmails()
    if (!pilotEmails.length) return
    const [user, firstConnected, credentialCount, groups, sentNudges] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { email: true } }),
      db.analyticsEvent.findFirst({
        where: { userId, event: 'whatsapp_connected' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      db.credential.count({ where: { userId } }),
      db.group.findMany({ where: { userId }, select: { role: true } }),
      db.analyticsEvent.findMany({ where: { userId, event: 'ops_self_activation_nudge_sent' }, select: { metadata: true } }),
    ])
    if (!isPilotEmail(user?.email, pilotEmails)) return
    const connectedForMs = firstConnected?.createdAt ? now - firstConnected.createdAt.getTime() : null
    const hasCredential = credentialCount > 0
    const hasGroups = groups.some(g => g.role === 'monitor') && groups.some(g => g.role === 'post')
    let sentCredentialNudge = false
    let sentGroupsNudge = false
    for (const row of sentNudges) {
      try {
        const kind = JSON.parse(row.metadata || '{}').kind
        if (kind === 'missing_credential') sentCredentialNudge = true
        if (kind === 'missing_groups') sentGroupsNudge = true
      } catch { /* linha antiga sem metadata legível: ignora */ }
    }
    const kind = decideActivationNudge({
      accountEmail: user?.email,
      pilotEmails,
      connectedForMs,
      minDelayMs: ACTIVATION_NUDGE_MIN_DELAY_MS,
      hasCredential,
      hasGroups,
      sentCredentialNudge,
      sentGroupsNudge,
    })
    if (!kind) return
    const phone = activeSock.user?.id?.split(':')[0] ?? null
    if (!phone) return
    const texto = kind === 'missing_credential'
      ? buildMissingCredentialNudgeText({ videoUrl: VIDEO_CADASTRO_ETIQUETAS_URL })
      : buildMissingGroupsNudgeText({ videoUrl: VIDEO_ATIVACAO_ROBO_URL })
    await activeSock.sendMessage(`${phone}@s.whatsapp.net`, { text: texto })
    logger.info({ userId, kind }, 'Nudge de ativação (piloto) enviado para o próprio número')
    trackAnalyticsEventSafe({ userId, event: 'ops_self_activation_nudge_sent', metadata: { kind } })
    logWhatsappSelfMessageContact({ reason: kind === 'missing_credential' ? 'lembrete_sem_etiqueta' : 'lembrete_sem_grupo', texto })
  } catch (err) {
    logger.warn({ err: String(err?.message ?? err) }, 'Falha ao avaliar/enviar nudge de ativação (piloto, best-effort)')
  }
}

async function loadConfig() {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { groups: true, credentials: true, botConfig: true, groupTargets: { include: { post: true } } },
  })
  if (!user) throw new Error(`Usuário ${userId} não encontrado`)

  if (user.accessExpiresAt && user.accessExpiresAt < new Date()) {
    if (sendIpc) sendIpc({ type: 'status', data: 'blocked' })
    // Sem isso, o WaSession.status fica preso no último valor antes do
    // vencimento (normalmente 'connected') — o health monitor do supervisor só
    // busca sessões com status IN ('connected','connecting') pra ressuscitar, e
    // nunca vê que essa conta está permanentemente bloqueada. Resultado: fork
    // → detecta vencido → sai → 15s depois o health monitor tenta de novo →
    // loop infinito de restart/quarentena (RCA 2026-07, contas com trial
    // vencido e sessão que estava conectada antes de vencer).
    await persistSessionPatch({ status: 'disconnected', lifecycle: 'disconnected' }).catch(err => {
      logger.warn({ err: String(err?.message ?? err) }, 'Falha ao persistir status de acesso expirado')
    })
    logger.error('Acesso expirado — bot bloqueado')
    exitRuntime(0)
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

  Object.defineProperty(credentials, '__onCredentialPatch', {
    enumerable: false,
    value: async (platform, patch) => {
      try {
        const updated = await persistCredentialPatch({ userId, platform, patch })
        if (updated && credentials[platform]) {
          credentials[platform] = { ...credentials[platform], ...patch }
        }
      } catch (err) {
        logger.warn({ platform, err: err?.message }, 'Falha ao persistir cookies rotacionados da credencial')
      }
    },
  })

  const { groups } = buildEntitledGroupConfig({
    groups: user.groups,
    groupTargets: user.groupTargets,
    planSubject: { plan: user.plan, accessExpiresAt: user.accessExpiresAt },
    logger,
  })

  // Mantém o allowlist do shouldIgnoreJid em dia com a config atual (grupos
  // monitor/destino podem mudar quando o cliente edita no painel → reloadConfig
  // zera o cache e o próximo getConfig repopula).
  updateAllowedChatJids(groups)

  const botConfig = {
    delayMin: 5,
    delayMax: 15,
    platforms: 'shopee,amazon,mercadolivre,magazineluiza,shein,aliexpress',
    blockedKeywords: '',
    welcomeMsg: '',
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

  // Cupons da própria cliente (specs/017-client-coupon-catalog, D1 da pesquisa):
  // uma consulta a mais por CARGA de config (mesmo TTL de CONFIG_CACHE_TTL_MS
  // das demais, ~60s), NUNCA por envio — processSendJob já chama getConfig()
  // hoje, então ler os cupons daqui não acrescenta consulta nenhuma no
  // caminho de envio (FR-028a/SC-009). Só os LIGADOS entram: a validade em si
  // é comparada com o relógio a cada envio pela regra pura (chooseCoupon), não
  // aqui — só o ligado/desligado tem a janela de até CONFIG_CACHE_TTL_MS.
  let coupons = []
  try {
    coupons = await db.clientCoupon.findMany({ where: { userId, enabled: true } })
  } catch (err) {
    logger.warn({ err: err?.message }, 'Falha ao carregar cupons da cliente; ofertas seguem sem cupom até a próxima carga')
  }

  return { credentials, groups, plan: user.plan, accessExpiresAt: user.accessExpiresAt, botConfig, preservationActive, coupons }
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
        let log
        try {
          log = await db.messageLog.create({
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
        } catch (err) {
          // Mesma defesa em profundidade do handler de broadcast
          // (specs/006-worker-crash-log-safety): sem este try/catch, uma
          // falha de escrita aqui (ex.: SQLITE_BUSY pontual) escapava para o
          // catch de checkScheduledMessages() inteiro — abortando o processamento
          // dos jids restantes DESTA mensagem, de TODAS as outras mensagens
          // agendadas pendentes no mesmo tick, e deixando `msg` presa em
          // status='queued' para sempre (a query de pending só busca
          // status='pending', e o watchdog de recuperação só roda uma vez no
          // boot do worker). Loga e segue para o próximo jid.
          logger.error({ err: err?.message, jid, scheduledMessageId: msg.id }, 'Falha ao gravar MessageLog de mensagem agendada; pulando este destinatário')
          state.remaining--
          state.hasError = true
          continue
        }

        // Mesma regra do broadcast: o grupo de destino define o botão e o
        // formato. Deixar a agendada de fora faria o MESMO grupo se comportar
        // diferente conforme a esteira que enviou.
        const scheduledPostDetail = (await getConfig()).groups.postDetails.find(g => g.waJid === jid)
        const scheduledChannelForward = resolveChannelForward(scheduledPostDetail)
        const scheduledImageRecipe = buildBroadcastImageRecipe(msg.text, { imageUrl: msg.imageUrl, imageRefererUrl: msg.imageRefererUrl, appearance: resolveOfferAppearance(scheduledPostDetail, { hasChannelButton: !!scheduledChannelForward }) })
        const accepted = await enqueueSendJob({
          type: 'scheduled',
          logId: log.id,
          destJid: jid,
          platforms: 'scheduled',
          plan: 'scheduled',
          // Sem freio de fila congelado aqui: a pressão é medida por destino
          // no dequeue (processSendJob). Ver getSendBackendQueueSizeForDest.
          delayMs: 0,
          typingDelayMs: calculateTypingDelayMs({ text: msg.text, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
          channelForward: scheduledChannelForward,
          // Agendado sai com cupom igual ao "Enviar agora" (decisão da dona do
          // produto, 2026-09-23). O cupom é escolhido quando a mensagem SAI,
          // não quando foi agendada: vencido ou desligado até lá, não sai.
          couponContext: couponContextFromText(msg.text, msg.couponPriceCents),
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

const scheduledMessagesTimer = setInterval(checkScheduledMessages, 30_000)

// Watchdog de MessageLog preso em 'sending' (safety net): roda a cada 5min e
// reclassifica como erro recuperável as linhas paradas em 'sending' há mais que
// o cutoff. unref() para não segurar o processo. Ver src/jobs/stuckSendLogs.js.
const STUCK_SEND_LOG_SWEEP_MS = Math.max(60_000, Number(process.env.STUCK_SEND_LOG_SWEEP_MS || 5 * 60_000))
const stuckSendLogsTimer = setInterval(() => {
  recoverStuckSendLogs({ userId })
    .then(({ recovered }) => {
      if (recovered > 0) logger.warn({ recovered, cutoffMs: STUCK_SEND_LOG_CUTOFF_MS }, 'Watchdog: MessageLog preso em sending reclassificado como erro')
    })
    .catch(err => logger.error({ err: err.message }, 'Watchdog de envios presos falhou'))
}, STUCK_SEND_LOG_SWEEP_MS).unref()

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
    // Cacheia jid→subject (best-effort) para nomear grupos culpados nos eventos
    // de desync consumidos pelo painel admin.
    if (groups) {
      for (const [jid, meta] of Object.entries(groups)) {
        if (meta?.subject) groupSubjectByJid.set(normalizeJidForMatch(jid), meta.subject)
      }
    }
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

  if (!silent.length) return
  // `hasActive` existe para não alarmar conta naturalmente parada: se NENHUM
  // monitor tem tráfego, o silêncio pode ser a madrugada. Só que exigir isso
  // deixava a FALHA TOTAL — todos os monitores calados — como o único estado que
  // este vigia não enxerga, e é justamente o pior (RCA 2026-09-14: a conta ficou
  // dois dias com 0 de 2 monitores recebendo e ele nunca rodou).
  // Com todos calados, a evidência que substitui `hasActive` é a mesma da
  // cegueira entre reconexões: a sessão está OCUPADA (falhando decrypt ou caindo
  // repetidamente) e ainda assim não aceita nada. Sem essa evidência, silêncio
  // segue sendo só silêncio.
  const todosCalados = !hasActive
  const ocupadaESemAceitar = failuresSinceLastAccepted > 0 || stableDropsSinceLastAccepted > 0
  if (todosCalados && !ocupadaESemAceitar) return

  logger.warn(
    {
      silent,
      thresholdMs: MONITOR_SILENCE_THRESHOLD_MS,
      todosCalados,
      failuresSinceLastAccepted,
      stableDropsSinceLastAccepted,
    },
    'Monitor(es) silenciado(s) detectado(s); forçando refresh de sender_keys'
  )
  await triggerWaGroupsRefresh('silence_watchdog')
}

// Marca única do produto (decisão 2026-09-23: "Espelha Grupos em tudo").
const AD_TEXT = '💡 Bot gerenciado pelo Espelha Grupos — automatize seus grupos de afiliados'
function envNumber(name, fallback) {
  if (process.env[name] === undefined) return fallback
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

const SEND_QUEUE_MAX_SIZE = envNumber('SEND_QUEUE_MAX_SIZE', 1_000)
const SEND_MAX_ATTEMPTS = Math.max(1, envNumber('SEND_MAX_ATTEMPTS', 3))
const SEND_RETRY_BASE_MS = Math.max(0, envNumber('SEND_RETRY_BASE_MS', 2_000))
// Defer de throttle ≤ este teto é esperado inline (barato, ex.: min_interval de
// poucos segundos). Acima dele (quiet_hours/burst_cap/daily_cap/health_paused e
// min_interval longo), o job é re-enfileirado com notBefore para NÃO congelar a
// fila serial do usuário.
//
// RCA 2026-07: o default era 90s. Um destino com `minIntervalSec=100` fazia o
// consumidor dormir INLINE quase 90s (medido no log: waitMs 87693, 89241,
// 89449, 89668) — e nesse tempo NENHUM outro destino recebia nada, mesmo os
// que têm intervalo mínimo de 3s. Como a preservação é por destino, a espera de
// um destino não pode virar espera de todos: 5s cobre o min_interval curto
// legítimo e joga o resto para o caminho de re-enfileiramento, que não bloqueia.
const THROTTLE_INLINE_WAIT_MAX_MS = Math.max(0, envNumber('THROTTLE_INLINE_WAIT_MAX_MS', 5_000))
const SEND_RETRY_MAX_MS = Math.max(SEND_RETRY_BASE_MS, envNumber('SEND_RETRY_MAX_MS', 30_000))
const RECONNECT_BASE_MS = Math.max(1_000, envNumber('RECONNECT_BASE_MS', 5_000))
const RECONNECT_MAX_MS = Math.max(RECONNECT_BASE_MS, envNumber('RECONNECT_MAX_MS', 5 * 60_000))
const FETCH_WA_VERSION_TIMEOUT_MS = Math.max(5_000, envNumber('FETCH_WA_VERSION_TIMEOUT_MS', 10_000))
// connectionReplaced (440): outro socket assumiu a MESMA credencial. Reconectar
// rápido só perpetua o ping-pong (e o spam de notificação de sincronização).
// Cooldown longo + detecção de surto na janela abaixo. Ver core/reconnectPolicy.js.
const RECONNECT_REPLACED_DELAY_MS = Math.max(RECONNECT_BASE_MS, envNumber('RECONNECT_REPLACED_DELAY_MS', RECONNECT_MAX_MS))
const RECONNECT_REPLACED_WINDOW_MS = Math.max(10_000, envNumber('RECONNECT_REPLACED_WINDOW_MS', 5 * 60_000))
const RECONNECT_REPLACED_GIVEUP_THRESHOLD = Math.max(2, envNumber('RECONNECT_REPLACED_GIVEUP_THRESHOLD', 3))
// Flapping genérico (500 badSession / 428 / 408 / ...): o socket cai por conta
// própria (não por outro device, como o 440) mas o efeito no celular é o mesmo —
// cada `open` curto dispara a notificação "A sincronização foi concluída". Após
// RECONNECT_FLAP_THRESHOLD closes em RECONNECT_FLAP_WINDOW_MS, aplicamos um
// cooldown curto (recupera sozinho quando o chip estabiliza). Ver core/reconnectPolicy.js.
const RECONNECT_FLAP_WINDOW_MS = Math.max(30_000, envNumber('RECONNECT_FLAP_WINDOW_MS', 10 * 60_000))
const RECONNECT_FLAP_THRESHOLD = Math.max(2, envNumber('RECONNECT_FLAP_THRESHOLD', 8))
const RECONNECT_FLAP_COOLDOWN_MS = Math.max(RECONNECT_BASE_MS, envNumber('RECONNECT_FLAP_COOLDOWN_MS', 30_000))
// Tempo mínimo de conexão para ser considerada "estável": só abaixo disso um
// `open` deixa o backoff subir. Acima, a queda é de uma sessão saudável e o
// backoff recomeça do zero (reconexão rápida). Ver shouldResetBackoff.
const RECONNECT_STABLE_MS = Math.max(5_000, envNumber('RECONNECT_STABLE_MS', 60_000))
// badSession (500): re-pareamento automático (limpa auth → QR limpo) só quando
// o 500 REPETE e a sessão não fica estável (credencial Signal corrompida de
// verdade). RECONNECT_BADSESSION_RESET_THRESHOLD <= 0 desliga o auto-reset.
const RECONNECT_BADSESSION_WINDOW_MS = Math.max(60_000, envNumber('RECONNECT_BADSESSION_WINDOW_MS', 10 * 60_000))
const RECONNECT_BADSESSION_RESET_THRESHOLD = envNumber('RECONNECT_BADSESSION_RESET_THRESHOLD', 4)
// Alta disponibilidade / "conectar 1× e rodar liso": quando ON, uma sessão que
// JÁ conectou de forma estável alguma vez NUNCA tem o auth apagado por rajada de
// 500 (só loggedOut/401 força re-pareamento). Default OFF preserva o
// comportamento histórico; ligar só após validar em staging (issue #1216).
const RECONNECT_BADSESSION_KEEP_ESTABLISHED_AUTH = ['1', 'true'].includes(String(process.env.BADSESSION_KEEP_ESTABLISHED_AUTH || '').trim().toLowerCase())
// Queda periódica de sessão estável: produção mostrou vários chips caindo em
// code 500/428/408 a cada ~50min (cadência de timer, não flap curto). Como a
// sessão fica estável por muito mais que RECONNECT_STABLE_MS, o backoff normal
// zera e reconecta rápido — cada ciclo vira uma nova push notification no
// celular. Após N quedas estáveis na janela, mantemos uma proteção residual para
// reduzir o volume de re-sync sem apagar auth nem exigir re-pareamento.
const RECONNECT_STABLE_CLOSE_WINDOW_MS = Math.max(30 * 60_000, envNumber('RECONNECT_STABLE_CLOSE_WINDOW_MS', 3 * 60 * 60_000))
const RECONNECT_STABLE_CLOSE_THRESHOLD = Math.max(2, envNumber('RECONNECT_STABLE_CLOSE_THRESHOLD', 4))
// Era 30min e depois 5min: enquanto o cooldown corre, a sessão fica DE FATO fora
// do ar (sem socket ativo — nada é recebido nem espelhado), não é só detalhe de
// UI. Para o produto cumprir a promessa de robô 24h, o default agora mantém uma
// proteção residual contra queda periódica (~50min) mas segura por apenas 1min.
// Quem precisar de postura mais conservadora ainda pode subir via env.
const RECONNECT_STABLE_CLOSE_COOLDOWN_MS = Math.max(RECONNECT_BASE_MS, envNumber('RECONNECT_STABLE_CLOSE_COOLDOWN_MS', 60_000))
// RCA 2026-07 ("Loop de retry-receipt travado"): visibilidade operacional pra
// detectar essa CLASSE de problema cedo, mesmo que reapareça por uma causa
// raiz diferente do bug já corrigido (msgRetryCounterCache resetando a cada
// reconexão). Se o MESMO messageId aparecer no ack de um stream:error
// `WA_STUCK_MSG_THRESHOLD`+ vezes dentro de `WA_STUCK_MSG_WINDOW_MS`, algo
// está impedindo aquela mensagem específica de ser esquecida — alertar antes
// que o cliente perceba a sessão caindo em loop.
const STUCK_MSG_WINDOW_MS = Math.max(5 * 60_000, envNumber('WA_STUCK_MSG_WINDOW_MS', 2 * 60 * 60_000))
const STUCK_MSG_THRESHOLD = Math.max(0, envNumber('WA_STUCK_MSG_THRESHOLD', 2))
let stuckMessageTimestamps = new Map()
// Auto-heal de grupo dessincronizado (issue #1216, Camada 3): investigação de produção
// (jul/2026) achou um grupo NÃO-monitorado com sender-key do Signal dessincronizada
// gerando centenas de falhas de decrypt e derrubando a sessão em cadência de ~50min (o
// mesmo mecanismo do "Loop de retry-receipt travado", só que a fonte era um grupo inteiro,
// não uma mensagem). Curar manualmente (achar o JID no log, pedir refresh/saída) não
// escala por cliente. Aqui, quando o MESMO grupo cruza WA_GROUP_DESYNC_THRESHOLD falhas de
// decrypt na janela, disparamos sozinhos um `triggerWaGroupsRefresh()` (a MESMA função do
// endpoint manual /refresh-wa-state — só re-busca sender-keys no socket já conectado, NÃO
// fecha o WebSocket, NÃO gera QR, NÃO exige nada da cliente). Threshold <= 0 desliga.
const WA_GROUP_DESYNC_WINDOW_MS = Math.max(5 * 60_000, envNumber('WA_GROUP_DESYNC_WINDOW_MS', 30 * 60_000))
const WA_GROUP_DESYNC_THRESHOLD = Math.max(0, envNumber('WA_GROUP_DESYNC_THRESHOLD', 5))
// Evita martelar refresh pro MESMO grupo a cada nova falha dentro da mesma janela —
// dá tempo do refresh anterior se propagar antes de tentar de novo.
const WA_GROUP_DESYNC_REFRESH_COOLDOWN_MS = Math.max(60_000, envNumber('WA_GROUP_DESYNC_REFRESH_COOLDOWN_MS', 5 * 60_000))
// Escalonamento (NUNCA automático além do refresh): se o auto-refresh disparar
// repetidamente pro MESMO grupo numa janela maior sem as falhas pararem, é sinal de que
// refresh sozinho não resolve — precisa de ação manual (cliente sair/reentrar no grupo).
// Isso só gera visibilidade (evento durável); jamais sai do grupo sozinho.
const WA_GROUP_DESYNC_ESCALATE_WINDOW_MS = Math.max(30 * 60_000, envNumber('WA_GROUP_DESYNC_ESCALATE_WINDOW_MS', 3 * 60 * 60_000))
const WA_GROUP_DESYNC_ESCALATE_THRESHOLD = Math.max(0, envNumber('WA_GROUP_DESYNC_ESCALATE_THRESHOLD', 3))
// Escopo de módulo (não dentro de startBotInner) de propósito — precisa sobreviver a
// reconexões dentro do MESMO worker, senão o contador zera a cada `open`/close e o
// threshold nunca é cruzado (mesma lição do RCA do msgRetryCounterCache).
let groupDecryptTimestamps = new Map()
let groupAutoRefreshTimestamps = new Map()
const groupLastAutoRefreshAtByJid = new Map()
// Camada 3-B (RCA 2026-09-23): CANAL (@newsletter) dessincronizado nunca é
// curado pelo refresh de grupo (não é grupo) nem pela quarentena por msgId em
// `msgRetryCounterCache` (cada mensagem nova do canal tem um id DIFERENTE —
// "o mesmo id repetir" nunca acontece). Medido em produção: dois canais
// diferentes derrubaram a MESMA conta duas vezes em menos de 2h, e 63% da
// frota tinha o mesmo sintoma de decrypt-fail crônico. Reaproveita o MESMO
// detector (`registerStuckMessageAndDecide`/`groupDecryptTimestamps`, acima)
// — só a AÇÃO muda: em vez de tentar re-sincronizar (não existe refresh de
// sender-key de canal exposto pelo Baileys), colocamos o canal numa
// quarentena EM MEMÓRIA por uma janela — `shouldIgnoreJid` passa a ACKar e
// descartar mensagens dele ANTES do decrypt (mesmo mecanismo do
// WA_IGNORE_UNMONITORED_GROUPS), a sessão para de cair por causa dele, e ao
// expirar a janela ele volta a ser processado normalmente. Default OFF:
// validar em staging antes de ligar em produção. Canal na allowlist (fonte
// monitorada de propósito) nunca entra em quarentena — ver shouldIgnoreDesyncedChannel.
const WA_CHANNEL_DESYNC_QUARANTINE_ENABLED = ['1', 'true'].includes(String(process.env.WA_CHANNEL_DESYNC_QUARANTINE_ENABLED || '').trim().toLowerCase())
const WA_CHANNEL_DESYNC_QUARANTINE_TTL_MS = Math.max(5 * 60_000, envNumber('WA_CHANNEL_DESYNC_QUARANTINE_TTL_MS', WA_GROUP_DESYNC_WINDOW_MS))
// jid normalizado -> timestamp (ms) de quando entrou em quarentena. Escopo de
// módulo pela mesma razão de groupDecryptTimestamps.
const desyncedChannelJids = new Map()
// Keep-alive do socket: sem ping periódico, um socket morto silenciosamente só
// é detectado tarde, causando reconexão (e nova notificação). 25s é conservador.
const WA_KEEPALIVE_INTERVAL_MS = Math.max(10_000, envNumber('WA_KEEPALIVE_INTERVAL_MS', 25_000))
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
// QUEUE_BACKEND aceita 'memory', 'bullmq' ou vazio. O DEFAULT é 'memory' —
// inclusive quando REDIS_URL está setado. BullMQ é OPT-IN explícito
// (QUEUE_BACKEND=bullmq) porque o payload de envio carrega Buffer de imagem
// que o JSON.stringify do BullMQ corrompe (oferta sai sem foto). NÃO mudar
// para auto-bullmq sem antes mover a montagem da mídia para pós-dequeue.
// Regra centralizada em resolveBackendMode() (src/sendQueueBackend.js).
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
  if (sendIpc) sendIpc({ type: 'lifecycle', data: next, prev, meta })
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

// Estado do "Intervalo entre destinos" (core/destinationSpacing.js,
// specs/018-unificar-protecao-anti-ban, FR-022 a FR-026). ESCOPO DE MÓDULO de
// propósito (mesma lição de msgRetryCounterCache no RCA "Loop de retry-receipt
// travado", AGENTS.md): precisa sobreviver a reconexões do MESMO worker, senão
// o "último envio da conta" reseta a cada `open` e o espaçamento nunca chega a
// valer. Zerado só no restart do processo — sem persistência entre reinícios,
// conforme contracts/destination-spacing.md.
let destinationSpacingState = { lastSendAt: null, lastDestJid: null, nextFreeSlotAt: null }

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
  deferredTotal: 0,
  queueExpiredTotal: 0,
  outsideSendWindowTotal: 0,
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

// Padrões que indicam que a sessão recebeu mensagem mas não conseguiu
// descriptografar (sender_key/contador dessincronizados). "sent retry receipt"
// é o mais confiável: o Baileys o loga uma vez por mensagem indecifrável.
const SESSION_HEALTH_SIGNAL_RE = /sent retry receipt|failed to decrypt|Bad MAC|MessageCounterError|Key used already or never filled/i

// Baileys loga `unexpected error in 'init queries'` em nível error a cada 408
// de fetchProps (ver RCA docs/rca-sessoes-whatsapp-caindo-2026-07.md — Trilho
// B). Isso sozinho já gerou ~14k linhas/dia no bot.log antes do fix de causa
// raiz (bump de versão). Rebaixamos para debug (não aparece no nível padrão
// de produção) só para não inflar o log; não afeta a métrica de saúde acima
// nem a lógica de reconexão, que dependem do fechamento da conexão, não da
// linha de log em si.
const INIT_QUERIES_LOG_RE = /unexpected error in 'init queries'/i

// Fase 0 do plano de recepção (RCA 2026-08): marcadores de RECEPÇÃO, para
// separar "o processo está vivo" de "está chegando mensagem". Escopo de
// módulo de propósito: precisam sobreviver às reconexões do MESMO worker
// (mesma lição do msgRetryCounterCache) — zerar a cada `open` esconderia
// justamente a sessão que reconecta o tempo todo e não recebe nada.
const RECEPTION_WINDOW_MS = Math.max(60_000, Number(process.env.WA_RECEPTION_WINDOW_MS || DEFAULT_RECEPTION_WINDOW_MS))
const RECEPTION_MIN_FAILURES = Math.max(1, Number(process.env.WA_RECEPTION_MIN_FAILURES || DEFAULT_RECEPTION_MIN_FAILURES))
// `WA_BLIND_ACROSS_RECONNECTS_MS=0` desliga só a regra nova (rollback sem
// redeploy), preservando a classificação histórica.
const BLIND_ACROSS_RECONNECTS_MS = Math.max(0, Number(process.env.WA_BLIND_ACROSS_RECONNECTS_MS ?? DEFAULT_BLIND_ACROSS_RECONNECTS_MS))

// Quais filtros de recepção este worker está aplicando — UMA linha por boot.
//
// Não é enfeite. `WA_IGNORE_UNMONITORED_GROUPS` descarta mensagem antes do
// decrypt e NÃO escrevia nada em lugar nenhum: nem no boot, nem ao ignorar
// (ignoredJidPolicy.js não tem logger). Ligá-la em produção e perguntar "pegou
// nos robôs?" não tinha resposta — e em modo `remote` o worker só relê a env
// quando o supervisor reinicia, que é exatamente o caso em que a pergunta
// aparece (RCA 2026-09-14: a flag ficou no .env e nenhum dos 38 workers a
// tinha lido, sem nenhum jeito de constatar isso pelo log).
//
// Volume: uma linha por processo de worker. Zero impacto de RAM.
logger.info({
  ignoreUnmonitoredGroups: IGNORE_UNMONITORED_GROUPS,
  chatScopeMode: CHAT_SCOPE_MODE,
  blindAcrossReconnectsMs: BLIND_ACROSS_RECONNECTS_MS,
}, 'Filtros de recepção deste robô')
const RECEPTION_SIGNAL_THROTTLE_MS = Math.max(5 * 60_000, Number(process.env.WA_RECEPTION_SIGNAL_THROTTLE_MS || 60 * 60_000))
let lastUpsertAtMs = null
let lastAcceptedAtMs = null
let monitoredSourceCount = 0
let lastReceptionSignalAt = 0

// Cegueira que ATRAVESSA reconexões (RCA 2026-09-14, viviloppes@gmail.com).
// Escopo de módulo e zerados SÓ em `markMessageAccepted` — nunca por reconexão
// e nunca por janela de tempo. Era exatamente isso que faltava: todo contador
// de recepção era medido a partir da conexão atual, e a conta do RCA reconecta
// a cada ~50min, então nenhum deles chegava a concluir nada (ver o cabeçalho de
// core/receptionHealth.js). Mesmo idioma de `chatScopeIgnoredSinceLastAccepted`.
let failuresSinceLastAccepted = 0
let stableDropsSinceLastAccepted = 0

function markUpsertReceived() { lastUpsertAtMs = Date.now() }

// Auto-cura de recepção (RCA 2026-08-28). Linha de base da PRÓPRIA conta: só
// os horários das mensagens aceitas na janela, podados. Escopo de módulo —
// precisa sobreviver às reconexões do worker, senão a linha de base zera
// justamente quando ela seria usada.
const SELF_HEAL_SILENCE_MS = Math.max(60_000, Number(process.env.WA_SELF_HEAL_SILENCE_MS ?? DEFAULT_SILENCE_MS))
const SELF_HEAL_BASELINE_WINDOW_MS = Math.max(60_000, Number(process.env.WA_SELF_HEAL_BASELINE_WINDOW_MS ?? DEFAULT_BASELINE_WINDOW_MS))
const SELF_HEAL_MIN_BASELINE = Math.max(0, Number(process.env.WA_SELF_HEAL_MIN_BASELINE ?? DEFAULT_MIN_BASELINE))
const SELF_HEAL_COOLDOWN_MS = Math.max(0, Number(process.env.WA_SELF_HEAL_COOLDOWN_MS ?? DEFAULT_COOLDOWN_MS))
const SELF_HEAL_MAX_PER_DAY = Math.max(0, Number(process.env.WA_SELF_HEAL_MAX_PER_DAY ?? DEFAULT_MAX_PER_DAY))
let acceptedTimestamps = []
let lastSelfHealAtMs = null
let selfHealTimestamps = []

function acceptedInBaselineWindow(now = Date.now()) {
  const cutoff = now - SELF_HEAL_BASELINE_WINDOW_MS
  if (acceptedTimestamps.length > 5_000 || (acceptedTimestamps.length && acceptedTimestamps[0] < cutoff)) {
    acceptedTimestamps = acceptedTimestamps.filter(ts => ts >= cutoff)
  }
  return acceptedTimestamps.length
}

// Refaz a conexão sozinho — exatamente o que a cliente faz quando clica em
// "Conectar", e nada além disso: fecha o socket e deixa o caminho normal de
// reconexão subir de novo. NÃO apaga credencial, NÃO gera QR.
function trySelfHealReception() {
  const now = Date.now()
  const decisao = shouldSelfHealReception({
    now,
    connected: Boolean(activeSock) && lifecycleState === WA_LIFECYCLE.READY,
    connectedSinceMs: connectionOpenedAt,
    lastAcceptedAtMs,
    acceptedInBaselineWindow: acceptedInBaselineWindow(now),
    lastHealAtMs: lastSelfHealAtMs,
    healsToday: selfHealTimestamps.filter(ts => now - ts <= 24 * 60 * 60_000).length,
    silenceMs: SELF_HEAL_SILENCE_MS,
    minBaseline: SELF_HEAL_MIN_BASELINE,
    cooldownMs: SELF_HEAL_COOLDOWN_MS,
    maxPerDay: SELF_HEAL_MAX_PER_DAY,
  })
  if (!decisao.heal) return
  lastSelfHealAtMs = now
  selfHealTimestamps = selfHealTimestamps.filter(ts => now - ts <= 24 * 60 * 60_000).concat(now)
  logger.error({
    silentForMs: decisao.silentForMs,
    baseline: decisao.baseline,
    motivo: decisao.reason,
  }, 'Conectado e sem receber nada há muito tempo numa conta que costuma receber muito — refazendo a conexão sozinho (mesma ação do botão Conectar, sem apagar credencial)')
  try { recordOperationalSignal('wa_reception_self_heal', { userId, silentForMs: decisao.silentForMs, baseline: decisao.baseline }) } catch {}
  recordWaConnectionEventSafe({
    userId,
    type: 'reception_self_heal',
    lifecycle: lifecycleState,
    ownerInstance: OWNER_INSTANCE,
    metadata: { silentForMs: decisao.silentForMs, baseline: decisao.baseline },
  })
  // Fechar o socket cai no handler de close normal, que reagenda a conexão
  // com todo o backoff e as guardas já existentes.
  try { activeSock?.end?.(new Error('reception_self_heal')) } catch (err) {
    logger.warn({ err: err?.message }, 'Falha ao fechar socket na auto-cura de recepção')
  }
}
function markMessageAccepted() {
  lastAcceptedAtMs = Date.now()
  acceptedTimestamps.push(lastAcceptedAtMs)
  chatScopeIgnoredSinceLastAccepted = 0
  // Uma mensagem aceita é a única prova de que a recepção voltou a funcionar —
  // e o único evento que zera a cegueira acumulada.
  failuresSinceLastAccepted = 0
  stableDropsSinceLastAccepted = 0
}

// `WA_RECEPTION_WINDOW_MS=0` desliga a classificação (rollback sem redeploy).
function getReceptionHealth() {
  if (String(process.env.WA_RECEPTION_WINDOW_MS ?? '') === '0') return null
  return computeReceptionState({
    now: Date.now(),
    connected: Boolean(activeSock) && lifecycleState === WA_LIFECYCLE.READY,
    connectedSinceMs: connectionOpenedAt,
    lastUpsertAtMs,
    lastAcceptedAtMs,
    failuresInWindow: getSessionHealth().cryptoErrors,
    // Relógio que não reseta na reconexão: a última aceitação ou, se a conta
    // nunca aceitou nada neste worker, o boot dele.
    observedSinceMs: lastAcceptedAtMs ?? workerStartedAt,
    failuresSinceLastAccepted,
    stableDropsSinceLastAccepted,
    blindAcrossReconnectsMs: BLIND_ACROSS_RECONNECTS_MS,
    hasMonitoredSources: monitoredSourceCount > 0,
    incomingPending: incomingQueue.getStats().pending,
    lastProcessedAtMs: incomingQueue.getStats().lastCompletedAt,
    windowMs: RECEPTION_WINDOW_MS,
    minFailures: RECEPTION_MIN_FAILURES,
  })
}

// Só emite sinal durável para o estado comprovadamente problemático (`blind`),
// e no máximo 1× por hora — alarme repetido treina a pessoa a ignorar.
function reportReceptionHealth(reception) {
  if (!reception || !isReceptionProblem(reception.state)) return
  const now = Date.now()
  if (now - lastReceptionSignalAt < RECEPTION_SIGNAL_THROTTLE_MS) return
  lastReceptionSignalAt = now
  logger.error({
    silentForMs: reception.silentForMs,
    failuresInWindow: reception.failuresInWindow,
    windowMs: reception.windowMs,
    motivo: reception.reason,
    entreReconexoes: Boolean(reception.blindAcrossReconnects),
  }, 'Sessão conectada e SEM receber mensagens')
  try {
    recordOperationalSignal('wa_reception_blind', {
      userId,
      silentForMs: reception.silentForMs,
      failuresInWindow: reception.failuresInWindow,
      // Separa "parou agora" de "está cega há horas, atravessando reconexões" —
      // a segunda é a que ninguém enxergava e a que pede ação humana.
      acrossReconnects: Boolean(reception.blindAcrossReconnects),
    })
  } catch {}
}

function recordCryptoError() {
  const now = Date.now()
  lastCryptoErrorAt = now
  cryptoErrorTimestamps.push(now)
  // Cumulativo (não podado): a rajada de falhas acontece no dreno da fila
  // offline logo após reconectar, e a janela curta a apagava antes de alguém
  // conseguir julgar. Ver core/receptionHealth.js.
  failuresSinceLastAccepted += 1
  const cutoff = now - WA_SESSION_DEGRADED_WINDOW_MS
  // Poda barata: só varre quando o array cresce ou a cabeça já saiu da janela.
  if (cryptoErrorTimestamps.length > 1_000 || cryptoErrorTimestamps[0] < cutoff) {
    cryptoErrorTimestamps = cryptoErrorTimestamps.filter(ts => ts >= cutoff)
  }
}

// Snapshot consumido pelo /api/session/status (via metrics IPC) para o painel
// decidir se mostra o banner "reconecte". 'degraded' exige sessão conectada —
// se ela caiu, o status normal de "desconectado" já cobre o aviso.
function getSessionHealth() {
  const now = Date.now()
  const cutoff = now - WA_SESSION_DEGRADED_WINDOW_MS
  cryptoErrorTimestamps = cryptoErrorTimestamps.filter(ts => ts >= cutoff)
  const cryptoErrors = cryptoErrorTimestamps.length
  const degraded =
    lifecycleState === WA_LIFECYCLE.READY &&
    cryptoErrors >= WA_SESSION_DEGRADED_THRESHOLD &&
    lastCryptoErrorAt != null &&
    now - lastCryptoErrorAt <= WA_SESSION_DEGRADED_WINDOW_MS
  return {
    degraded,
    cryptoErrors,
    windowMs: WA_SESSION_DEGRADED_WINDOW_MS,
    threshold: WA_SESSION_DEGRADED_THRESHOLD,
    lastCryptoErrorAt,
  }
}

// Camada 3 (issue #1216): chamado a cada linha de log que já bateu em
// SESSION_HEALTH_SIGNAL_RE (falha de decrypt). Tenta extrair o remoteJid do grupo/chat dos
// args brutos do logger e, se o MESMO jid cruzar o threshold de falhas na janela, dispara
// um refresh de sender-keys sozinho — sem derrubar a sessão, sem pedir nada da cliente.
// Nunca lança: chamado de dentro do wrapper do logger, não pode quebrar o log em si.
function handleGroupDecryptSignal(args) {
  if (WA_GROUP_DESYNC_THRESHOLD <= 0) return
  try {
    const jid = extractRemoteJidFromLogArgs(args)
    if (!jid) return
    const now = Date.now()
    const r = registerStuckMessageAndDecide(groupDecryptTimestamps, jid, now, {
      windowMs: WA_GROUP_DESYNC_WINDOW_MS,
      threshold: WA_GROUP_DESYNC_THRESHOLD,
    })
    groupDecryptTimestamps = r.state
    if (!r.stuck) return
    // Canal (@newsletter): nunca tenta o refresh de grupo (não se aplica) —
    // coloca em quarentena em memória e para por aqui. Ver comentário na
    // declaração de WA_CHANNEL_DESYNC_QUARANTINE_ENABLED.
    if (jid.endsWith('@newsletter')) {
      if (!WA_CHANNEL_DESYNC_QUARANTINE_ENABLED) return
      const normalizedJid = normalizeJidForMatch(jid)
      if (allowedChatJids.has(normalizedJid)) return
      const alreadyQuarantined = desyncedChannelJids.has(normalizedJid)
      desyncedChannelJids.set(normalizedJid, now)
      if (alreadyQuarantined) return
      logger.warn(
        { jid, decryptFailures: r.count, windowMs: WA_GROUP_DESYNC_WINDOW_MS, ttlMs: WA_CHANNEL_DESYNC_QUARANTINE_TTL_MS },
        'Canal com falhas de decrypt repetidas (sender-key dessincronizada) — ignorando mensagens desse canal temporariamente para não derrubar a sessão'
      )
      const channelName = groupSubjectByJid.get(normalizeJidForMatch(jid)) || null
      try { recordOperationalSignal('wa_channel_desync_quarantine', { userId, jid, name: channelName, count: r.count }) } catch {}
      return
    }
    const lastRefreshAt = groupLastAutoRefreshAtByJid.get(jid) || 0
    if (now - lastRefreshAt < WA_GROUP_DESYNC_REFRESH_COOLDOWN_MS) return
    groupLastAutoRefreshAtByJid.set(jid, now)
    logger.warn(
      { jid, decryptFailures: r.count, windowMs: WA_GROUP_DESYNC_WINDOW_MS },
      'Grupo com falhas de decrypt repetidas (sender-key dessincronizada) — disparando auto-refresh de sender-keys sozinho (não derruba a sessão)'
    )
    const groupName = groupSubjectByJid.get(normalizeJidForMatch(jid)) || null
    try { recordOperationalSignal('wa_group_desync_autoheal', { userId, jid, name: groupName, count: r.count }) } catch {}
    void triggerWaGroupsRefresh('auto_group_desync')
      .then(result => {
        if (!result?.ok) return
        const esc = registerStuckMessageAndDecide(groupAutoRefreshTimestamps, jid, Date.now(), {
          windowMs: WA_GROUP_DESYNC_ESCALATE_WINDOW_MS,
          threshold: WA_GROUP_DESYNC_ESCALATE_THRESHOLD,
        })
        groupAutoRefreshTimestamps = esc.state
        if (esc.stuck) {
          logger.error(
            { jid, autoRefreshCount: esc.count },
            'Grupo continua com falhas de decrypt após múltiplos auto-refresh — pode precisar que a cliente saia e reentre no grupo (ação manual, não-automática)'
          )
          try { recordOperationalSignal('wa_group_desync_unresolved', { userId, jid, name: groupSubjectByJid.get(normalizeJidForMatch(jid)) || null, count: esc.count }) } catch {}
        }
      })
      .catch(() => {})
  } catch {}
}

// Consultado pelo shouldIgnoreJid do socket (abaixo) a cada mensagem — decide
// se ESTE jid está, agora, na quarentena de canal dessincronizado. Puro na
// decisão (delegada a shouldIgnoreDesyncedChannel); só faz a leitura impura do
// Map + normalização do jid, que fica de fora da função pura por vir do
// socket em formato variável (às vezes com sufixo de device).
function isChannelDesyncQuarantined(jid) {
  const normalizedJid = normalizeJidForMatch(jid)
  return shouldIgnoreDesyncedChannel(jid, {
    enabled: WA_CHANNEL_DESYNC_QUARANTINE_ENABLED,
    quarantinedAt: desyncedChannelJids.get(normalizedJid),
    ttlMs: WA_CHANNEL_DESYNC_QUARANTINE_TTL_MS,
    allowedJids: allowedChatJids,
  })
}

// Envelopa o logger pino do Baileys (e seus filhos) para incrementar o contador
// de saúde sempre que uma linha casar com SESSION_HEALTH_SIGNAL_RE. Usa
// defineProperty (própria, gravável) para não esbarrar em métodos não-graváveis
// herdados do protótipo em modo estrito. É o ponto único e confiável de
// detecção: não depende de roteamento de stdout/stderr nem de evento público.
function instrumentBaileysLoggerForHealth(baileysLogger) {
  if (!baileysLogger || baileysLogger.__healthInstrumented) return baileysLogger
  const wrapLevel = (target, level) => {
    const orig = target?.[level]
    if (typeof orig !== 'function') return
    const bound = orig.bind(target)
    Object.defineProperty(target, level, {
      value: (...args) => {
        try {
          for (const arg of args) {
            if (typeof arg === 'string' && SESSION_HEALTH_SIGNAL_RE.test(arg)) { recordCryptoError(); handleGroupDecryptSignal(args); break }
          }
          if (level === 'error' && typeof target.debug === 'function') {
            for (const arg of args) {
              if (typeof arg === 'string' && INIT_QUERIES_LOG_RE.test(arg)) return target.debug(...args)
            }
          }
        } catch {}
        return bound(...args)
      },
      writable: true,
      configurable: true,
    })
  }
  for (const level of ['info', 'warn', 'error']) wrapLevel(baileysLogger, level)
  const origChild = typeof baileysLogger.child === 'function' ? baileysLogger.child.bind(baileysLogger) : null
  if (origChild) {
    Object.defineProperty(baileysLogger, 'child', {
      value: (...args) => instrumentBaileysLoggerForHealth(origChild(...args)),
      writable: true,
      configurable: true,
    })
  }
  Object.defineProperty(baileysLogger, '__healthInstrumented', { value: true, configurable: true })
  return baileysLogger
}

function canAcceptSendJob() {
  return !shuttingDown
}

function getSendBackendQueueSize() {
  const size = typeof sendBackend?.getQueueSize === 'function' ? sendBackend.getQueueSize() : 0
  return typeof size === 'number' ? size : 0
}

// Tamanho da fila que está disputando o consumidor PARA ESTE DESTINO.
//
// RCA 2026-07 (fila de 489, mensagem da meia-noite saindo às 14h): o freio
// progressivo media a fila TOTAL. Como a fila de envio é única e serial, um
// destino com cadência apertada (PROMO FESTAS: burstCap=1/600s, teto de 6
// envios/hora) acumulava centenas de itens e mantinha a fila permanentemente
// acima do limiar — então TODOS os outros destinos, mesmo sem gargalo próprio,
// levavam o atraso máximo (60s) em cada envio. Vazão caiu para ~52/h com ~111/h
// entrando: espiral que nunca se recupera sozinha.
//
// A preservação já é POR DESTINO; a pressão também precisa ser. Backend sem
// suporte a contagem por destino (BullMQ) cai no total — comportamento antigo.
function getSendBackendQueueSizeForDest(destJid) {
  if (destJid && typeof sendBackend?.getQueueSizeByDest === 'function') {
    const size = sendBackend.getQueueSizeByDest(destJid)
    if (typeof size === 'number') return size
  }
  return getSendBackendQueueSize()
}

function buildQueuePressureDelayMs(queueSize = getSendBackendQueueSize()) {
  return calculateProgressiveDelayMs({
    baseDelayMs: 0,
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
    // Como esta oferta deve aparecer (foto / foto com marca / card clicável /
    // card com marca). Vem SEMPRE do GRUPO DE DESTINO — a mesma escolha que o
    // espelhamento já lia. O formato é sobre ONDE a oferta chega, não sobre
    // qual esteira a produziu: assim um grupo se comporta igual venha a oferta
    // de espelhamento, de fila, de oferta automática ou de agendamento, e não
    // existem duas configurações concorrentes para a mesma decisão.
    //
    // Precisa viajar DENTRO da receita porque a receita é o que sobrevive ao
    // BullMQ: o payload só é montado no dequeue, possivelmente noutro
    // processo, onde a config não está à mão. Ausente = 'original'.
    appearance: options.appearance ?? undefined,
  }
}

// Monta o WAUrlInfo manual do modo "preview" (card clicável). Necessário
// porque links de afiliado (s.shopee.com.br, amzn.to, /sec/ do ML) bloqueiam
// o scraper automático do Baileys (link-preview-js) e o preview não sai.
//
// O card é SÓ IMAGEM por decisão de produto (2026-07): título e preço ficam
// exclusivamente no texto da mensagem. O preço raspado do card divergia do
// preço real da oferta com cupom (ex.: card "Por: 1.825,87" vs texto
// "POR 1.675,87 com cupom") e o título duplicava a primeira linha do texto.
// Sem título/descrição o WhatsApp renderiza imagem + domínio, e de quebra o
// modo preview deixou de raspar a página do produto (fetchProductInfo) —
// só busca a imagem.
//
// Card GRANDE: o WhatsApp só renderiza o card grande quando o proto carrega
// thumbnailDirectPath/mediaKey de uma thumbnail UPADA nos servidores do WA —
// linkPreview.highQualityThumbnail preenchido via prepareWAMessageMedia com
// mediaTypeOverride 'thumbnail-link', o MESMO caminho interno que o Baileys
// usa em generateHighQualityLinkPreview (ver Utils/link-preview.js). Uma
// thumbnail inline gigante NÃO produz card grande — só incha o proto (risco
// de rejeição). O inline aqui é o thumb 500px q80 já validado em produção
// (normalizeImageForWhatsApp), como placeholder enquanto o cliente baixa a HQ.
//
// NUNCA usar contextInfo.externalAdReply para "forçar" card grande: é campo
// de anúncio e causa drop silencioso em mensagem monitorada — a guarda em
// monitoredMessagePayload.js rejeita payload com esse campo em qualquer rota.
// Card de preview sem imagem = oferta que sai como TEXTO PURO no grupo.
// Até 2026-08 esse caminho era MUDO em produção: `fetchProductImage` engole
// o próprio erro e devolve `null` (não lança), então o `.catch(logger.debug)`
// abaixo nunca rodava — e `logger.debug` não chega ao `bot.log` de qualquer
// forma (o transport de arquivo é `level: 'info'`, src/logger.js). Resultado:
// a cliente via oferta sem foto e não havia UMA linha de log dizendo em que
// etapa a foto se perdeu. Aqui cada etapa que falha vira `warn` + sinal
// durável (`ops_preview_card_no_image`), para dar pra separar por loja e por
// etapa sem depender de reproduzir o caso.
function reportPreviewCardNoImage(stage, ctx = {}) {
  logger.warn({ ...ctx, stage }, 'Card de preview sem imagem: oferta vai sair como texto puro')
  try { recordOperationalSignal('preview_card_no_image', { userId, stage, platform: ctx.platform || null }) } catch {}
}

// A marca d'água foi pedida pelo destino e NÃO chegou na imagem enviada.
//
// Todos os caminhos de marca são best-effort de propósito (marca que falha
// nunca derruba a oferta), e até 2026-08-31 isso era MUDO: a imagem pequena
// demais nem log tinha (`renderDestinationWatermark` devolve
// `watermarkApplied:false` em silêncio) e o card que não conseguiu foto sai
// pelo preview automático do WhatsApp — com a foto da loja SEM a nossa marca.
// Ou seja: a única forma de descobrir que a marca sumiu era a cliente reclamar,
// que foi exatamente o que aconteceu. Aqui cada perda vira `warn` + sinal
// durável, para dar pra separar por etapa sem reproduzir o caso.
function reportWatermarkMissing(stage, ctx = {}) {
  logger.warn({ ...ctx, stage }, 'Marca d\'água pedida pelo destino não entrou na imagem')
  try { recordOperationalSignal('watermark_missing', { userId, stage, destJid: ctx.destJid || null }) } catch {}
}

// Foto do card SEMPRE na mesma tela (src/core/previewCardCanvas.js).
//
// Substitui o `normalizeImageForWhatsApp` no caminho do card — não soma custo:
// entrega os MESMOS dois campos (buffer que alimenta o upload da miniatura
// grande + miniatura embutida), só que com dimensões fixas, para o card não
// mudar de tamanho conforme a loja/foto que originou a oferta. Tela desligada
// (`PREVIEW_CARD_CANVAS=off`) ou composição que falha caem no caminho
// histórico: melhor card de tamanho irregular do que oferta sem foto.
async function prepararFotoDoCard(buf, { upscale = true } = {}) {
  if (!buf?.length) return null
  // A ordem é a correção: medir/ampliar a FOTO enquanto ela ainda tem suas
  // dimensões reais; só depois montar o canvas 1080px. Se inverter, o guard vê
  // o canvas grande e mantém o produto como selo pequeno no centro.
  const preparada = upscale ? await upscaleCardPhotoIfTiny(buf) : { buffer: buf, upscaled: null }
  const tela = await composePreviewCardImage(preparada.buffer).catch(() => null)
  if (tela?.main && tela?.thumbnail) return { buffer: tela.main, jpegThumbnail: tela.thumbnail, upscaled: preparada.upscaled }
  // Com a tela desligada/falhando, normalize recebe a mesma fonte já preparada
  // (ele nunca amplia de propósito).
  const normalized = await normalizeImageForWhatsApp(preparada.buffer)
  if (!normalized?.jpegThumbnail) return null
  return { buffer: normalized.buffer || normalized.jpegThumbnail, jpegThumbnail: normalized.jpegThumbnail, upscaled: preparada.upscaled }
}

function kindDoCard(fonte) {
  if (fonte === 'origem') return DELIVERY_KIND.CARD_ORIGEM
  if (fonte === 'banner') return DELIVERY_KIND.CARD_BANNER
  return DELIVERY_KIND.CARD_LOJA
}

async function buildManualLinkPreview({ text, primary, credentialsMap, uploadToServer, destJid, couponTextSignal, fetchOriginPhoto, allowSmallOriginPhoto = false, onFonteDaFoto, watermark = null }) {
  // `onFonteDaFoto` (opcional): diz de ONDE veio a foto do card ('loja',
  // 'origem' ou 'banner'). Vai por callback, e não como campo do objeto
  // devolvido, porque esse objeto é o urlInfo que entra no proto do WhatsApp —
  // campo estranho ali é risco desnecessário (ver o RCA do `title` do PR #1186).
  const marcarFonte = fonte => { try { onFonteDaFoto?.(fonte) } catch { /* best-effort */ } }
  const matchedText = isHttpUrl(primary?.converted) ? primary.converted : (isHttpUrl(primary?.url) ? primary.url : '')
  if (!matchedText) return null
  // matched-text precisa existir literalmente no corpo da mensagem; sem essa
  // âncora o cliente WhatsApp não associa o card ao link e não renderiza nada.
  // Sem âncora, devolve null e o Baileys tenta o preview automático.
  if (!String(text || '').includes(matchedText)) {
    reportPreviewCardNoImage('anchor_missing', { platform: primary?.platform, matchedText })
    return null
  }

  const sourceUrl = isHttpUrl(primary?.url) ? primary.url : matchedText

  // jpegThumbnail = placeholder pequeno (inline no proto, mostrado antes da
  // HQ carregar). hqSourceBuffer = imagem em resolução MAIOR, usada só como
  // fonte do upload que alimenta highQualityThumbnail.
  //
  // Por que os dois: prepareWAMessageMedia lê as dimensões reais do buffer
  // que sobe (Utils/messages-media.js:extractImageThumb → sharp .metadata())
  // e grava em thumbnailWidth/thumbnailHeight do proto (Utils/messages.js).
  // Fizemos upload do PRÓPRIO jpegThumbnail (capado em 500px) até aqui, então
  // o card nascia com thumbnailWidth/Height ≤500 — o WhatsApp Mobile estica a
  // imagem pra preencher a largura do balão de qualquer forma, mas o Desktop/
  // Web respeita as dimensões gravadas e renderiza um card pequeno/fino num
  // layout com muito mais espaço horizontal disponível (card ruim só no PC,
  // reportado pela cliente). O preview automático do Baileys nunca tinha esse
  // problema porque sobe a imagem ORIGINAL da página (sem redimensionar antes
  // do upload) — aqui replicamos isso com o buffer "main" (até 1600px) do
  // normalizeImageForWhatsApp, o mesmo já usado no envio de imagem normal.
  let jpegThumbnail
  let hqSourceBuffer
  // ROLLBACK DE PRODUÇÃO (incidente 2026-07, hotfix #1205 em main): o banner de
  // cupom estava saindo em textos que eram de PRODUTO. Um produto compartilhado
  // por short link que não revela ASIN/MLB (ex.: amzn.to/amzn.divulgador.link/
  // meli.la não resolvidos) cai como linkKind:'coupon' e ganhava o banner
  // "Cupom Loja" no lugar da foto do produto. Reativado (specs/008) com
  // blindagem tripla em couponBrandCardPolicy.js (shouldUseCouponBrandCard):
  // exige linkKind==='coupon' E sinal de TEXTO de cupom/vitrine E URL sem
  // ASIN/MLB ao mesmo tempo — produto por short link continua saindo com foto
  // (não regride #1205/#1208). Rollout controlado por env, default OFF.
  const COUPON_BRAND_CARD_ENABLED = process.env.COUPON_BRAND_CARD_ENABLED === 'true'
  const useCouponBrandCard = shouldUseCouponBrandCard({
    enabled: COUPON_BRAND_CARD_ENABLED,
    platform: primary?.platform,
    linkKind: primary?.linkKind,
    couponTextSignal,
    resolvedUrl: primary?.converted || primary?.url,
  })
  if (useCouponBrandCard) {
    // Link de cupom/campanha não tem produto: raspar a landing pegava a
    // imagem de um produto promovido aleatório no card. Usa o banner da
    // marca da loja (storeBrandCard), como os canais concorrentes fazem.
    const banner = (await buildStoreBrandCardImage(primary?.platform)) || undefined
    // O banner nasce em 720x720: grande demais para o campo embutido, que e' o
    // que o WhatsApp desenha ANTES de baixar, e de tamanho diferente do card de
    // produto. Passa pela MESMA tela fixa das fotos, para o card de cupom não
    // sair maior/menor que o card da oferta ao lado dele no grupo.
    const telaBanner = banner ? await prepararFotoDoCard(banner, { upscale: false }) : null
    jpegThumbnail = telaBanner?.jpegThumbnail || (banner ? await buildInlineThumbnail(banner).catch(() => banner) : undefined)
    hqSourceBuffer = telaBanner?.buffer || banner
    if (banner) marcarFonte('banner')
  } else if (primary?.platform) {
    const imageUrl = await fetchProductImage(primary.platform, sourceUrl, credentialsMap || {}, {
      onDiagnostic: ({ stage, detail }) => reportPreviewCardNoImage(stage, { platform: primary.platform, sourceUrl, detail }),
    }).catch((err) => {
      reportPreviewCardNoImage('scrape_threw', { platform: primary.platform, sourceUrl, err: err?.message })
      return null
    })
    if (!isHttpUrl(imageUrl)) {
      // Caminho MAIS COMUM de falha e, até aqui, o único totalmente silencioso:
      // `fetchProductImage` trata o próprio erro e devolve `null` (loja
      // bloqueando o scrape, HTML sem og:image, short link não resolvido,
      // credencial da Shopee recusada). Sem essa linha não dá para saber se a
      // oferta saiu sem foto por causa da loja ou por causa do upload.
      reportPreviewCardNoImage('scrape_sem_imagem', { platform: primary.platform, sourceUrl })
    } else {
      try {
        const fetched = await fetchImageBuffer(imageUrl, sourceUrl)
        if (!fetched?.buffer) {
          reportPreviewCardNoImage('download_sem_bytes', { platform: primary.platform, imageUrl, sourceUrl })
        }
        const preparada = fetched?.buffer ? await prepararFotoDoCard(fetched.buffer) : null
        if (fetched?.buffer && !preparada?.jpegThumbnail) {
          reportPreviewCardNoImage('normalize_falhou', { platform: primary.platform, imageUrl, sourceUrl, bytes: fetched.buffer.length })
        }
        jpegThumbnail = preparada?.jpegThumbnail || undefined
        hqSourceBuffer = preparada?.buffer || jpegThumbnail
        if (jpegThumbnail) {
          marcarFonte('loja')
          if (preparada?.upscaled) logger.info({ platform: primary?.platform, sourceUrl, de: preparada.upscaled.from, para: preparada.upscaled.to }, 'Card de preview: foto pequena ampliada antes de montar a tela')
        }
      } catch (err) {
        reportPreviewCardNoImage('download_falhou', { platform: primary.platform, imageUrl, sourceUrl, err: err?.message })
      }
    }
  } else {
    // Sem plataforma reconhecida não existe caminho de imagem: o card nunca é
    // montado. Vale logar para separar "loja bloqueou" de "link não é de loja".
    reportPreviewCardNoImage('sem_plataforma', { sourceUrl })
  }

  // PLANO B EM CASCATA: a loja não entregou foto, mas a mensagem de origem
  // quase sempre traz uma. Sem isso o card inteiro é descartado abaixo (`if
  // (!jpegThumbnail) return null`) e a oferta sai como TEXTO PURO — perdendo a
  // foto E o clique que abre a loja. Com isso, o card sobrevive ao bloqueio da
  // loja mantendo as duas coisas. Ver src/core/previewImageFallbackPolicy.js
  // para o porquê de o WhatsApp aceitar bytes que não vêm da loja (o banner de
  // cupom, logo acima, já faz exatamente isso com um JPEG gerado localmente).
  //
  // Não roda no caminho do banner de cupom: ali a ausência de foto de produto é
  // intencional (link de campanha não tem produto), e o banner já preencheu.
  // `allowSmallOriginPhoto`: chamada vinda do caminho SEM imagem (modo foto
  // cujo envio ia sair como texto pelado). Ali o plano B não é opcional — sem
  // ele a oferta vai sem nada —, então ele roda mesmo com a env desligada.
  if (!jpegThumbnail && !useCouponBrandCard && typeof fetchOriginPhoto === 'function' && (allowSmallOriginPhoto || shouldUseOriginPhotoFallback())) {
    try {
      const origin = await fetchOriginPhoto()
      const preparada = origin?.buffer ? await prepararFotoDoCard(origin.buffer) : null
      if (preparada?.jpegThumbnail) {
        jpegThumbnail = preparada.jpegThumbnail
        hqSourceBuffer = preparada.buffer
        marcarFonte('origem')
        if (preparada.upscaled) logger.info({ platform: primary?.platform, sourceUrl, de: preparada.upscaled.from, para: preparada.upscaled.to }, 'Card de preview: foto pequena ampliada antes de montar a tela')
        // Sinal PRÓPRIO (não é `ops_preview_card_no_image`): aqui a oferta SAIU
        // com card e com foto. Misturar os dois esconderia justamente o número
        // que interessa — quantas ofertas o plano B salvou, e de qual loja.
        logger.info({ platform: primary?.platform, sourceUrl }, 'Card de preview: foto da loja falhou, usando a foto da mensagem de origem')
        try { recordOperationalSignal('preview_card_origin_fallback', { userId, platform: primary?.platform || null }) } catch {}
      }
    } catch (err) {
      // Best-effort: o plano B falhando devolve o caso ao estado que já era o
      // atual (card descartado, texto puro). Nunca derruba o envio.
      logger.warn({ err: err?.message, sourceUrl }, 'Card de preview: plano B da foto de origem falhou')
    }
  }

  // Roda ANTES da marca d'água de propósito: `renderDestinationWatermark`
  // DESISTE de marcar foto pequena demais (devolve `watermarkApplied:false`),
  // então ampliar primeiro faz a marca ser desenhada na resolução final e
  // recupera casos em que ela simplesmente não saía.
  // MARCA D'ÁGUA NO CARD DE PREVIEW (modo `preview_watermark`).
  //
  // O card não é um caminho separado de imagem: ele carrega os MESMOS bytes que
  // o envio de foto — `jpegThumbnail` (placeholder inline) e o buffer que
  // alimenta o `highQualityThumbnail`. Compor a marca aqui, ANTES do upload HQ,
  // é o que garante que o que a pessoa vê no card pequeno e o que ela vê ao
  // tocar sejam a MESMA imagem marcada (`renderDestinationWatermark` já deriva
  // a miniatura da principal justamente para isso — ver
  // src/core/destinationWatermark.js).
  //
  // Vale para qualquer fonte de foto do card (loja, plano B da origem, banner
  // de cupom): a promessa da cliente é "a oferta sai com a minha marca", e ela
  // não muda porque a foto veio de outro lugar.
  //
  // Best-effort, como no caminho de foto: marca que falha NUNCA derruba o card
  // — a oferta sai com a foto sem marca, que é muito melhor do que texto pelado.
  if (jpegThumbnail && watermark?.text) {
    try {
      const rendered = await renderDestinationWatermark(hqSourceBuffer || jpegThumbnail, { text: watermark.text, color: watermark.color, size: watermark.size, position: watermark.position })
      hqSourceBuffer = rendered.main
      jpegThumbnail = rendered.thumbnail
      if (!rendered.watermarkApplied) reportWatermarkMissing(`card:${rendered.skipReason || 'nao_aplicada'}`, { destJid, platform: primary?.platform })
    } catch (err) {
      logger.warn({ err: err?.message, destJid }, 'Marca d\'água no card falhou; card sai com a foto sem marca')
      reportWatermarkMissing('card:render_falhou', { destJid, platform: primary?.platform, err: err?.message })
    }
  } else if (watermark?.text && !jpegThumbnail) {
    // Sem foto não há card, e o envio cai no preview AUTOMÁTICO do WhatsApp —
    // que, quando consegue montar algo, mostra a foto da loja SEM a nossa marca.
    // A oferta sai; a marca não. Precisa aparecer no log com nome próprio.
    reportWatermarkMissing('card:sem_foto', { destJid, platform: primary?.platform })
  }

  let highQualityThumbnail
  if (hqSourceBuffer && typeof uploadToServer === 'function') {
    try {
      // jid precisa ir aqui: é o que o Baileys usa (isJidNewsletter(options.jid)
      // em prepareWAMessageMedia) para decidir upload raw/plaintext (canal) vs.
      // criptografado (chat/grupo). Sem isso o thumbnail HQ sempre subia
      // cifrado, e canal não decifra — card ficava borrado/em branco
      // (o card caía pro jpegThumbnail inline pequeno, ou nem isso).
      const { imageMessage } = await prepareWAMessageMedia(
        { image: hqSourceBuffer },
        { upload: uploadToServer, mediaTypeOverride: 'thumbnail-link', jid: destJid },
      )
      highQualityThumbnail = imageMessage || undefined
    } catch (err) {
      logger.warn({ err: err?.message, sourceUrl }, 'linkPreview manual: upload da thumbnail HQ falhou — card sai compacto')
    }
  }

  // Sem thumbnail não há card de imagem para montar; um urlInfo só com
  // matched-text renderia uma barra vazia. Null deixa o Baileys tentar o
  // preview automático (e a mensagem sai como texto quando ele não vier).
  if (!jpegThumbnail) return null

  return {
    'canonical-url': matchedText,
    'matched-text': matchedText,
    // Título = nome da LOJA (nunca título de produto/preço — decisão de
    // produto 2026-07). O campo não pode ser omitido: sem title o cliente
    // WhatsApp NÃO renderiza o card (regressão observada em staging no
    // deploy do PR #1186 — cards sumiram até este fix). Em cupom, prefixa
    // "Cupom" — mesmo texto do banner (buildStoreBrandCardImage), pra não
    // ficar inconsistente (imagem diz "Cupom Amazon", título diz só "Amazon").
    title: storePreviewTitle(primary?.platform, matchedText, useCouponBrandCard),
    ...(jpegThumbnail ? { jpegThumbnail } : {}),
    ...(highQualityThumbnail ? { highQualityThumbnail } : {}),
  }
}

const STORE_PREVIEW_TITLES = {
  amazon: 'Amazon',
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magalu',
  shein: 'SHEIN',
  aliexpress: 'AliExpress',
}

// Flag experimental (default OFF) para testar em staging se dá pra esconder
// o nome da loja do card sem repetir a regressão do PR #1186 (card sumiu
// quando `title` foi OMITIDO). Aqui a chave `title` continua SEMPRE presente
// (guard estrutural em test/store-brand-card.test.js não muda) — só o
// CONTEÚDO vira um espaço em vez do nome da loja. Não sabemos ainda se o
// WhatsApp trata string vazia/proto3 default-value como "ausente" (o que
// reproduziria o bug) — por isso espaço (valor não-default) em vez de "".
// Validar mandando oferta real em staging e checando o card no celular
// antes de promover para main; se o card sumir, desligar a env (sem redeploy).
const PREVIEW_CARD_HIDE_STORE_TITLE = process.env.PREVIEW_CARD_HIDE_STORE_TITLE === 'true'

function storePreviewTitle(platform, url, isCoupon) {
  if (PREVIEW_CARD_HIDE_STORE_TITLE) return ' '
  const label = STORE_PREVIEW_TITLES[String(platform || '')]
  if (label) return isCoupon ? `Cupom ${label}` : label
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'Oferta' }
}

// Card clicável para os caminhos SEM mensagem monitorada (fila de ofertas e
// ofertas automáticas). É o primo simples de buildManualLinkPreview: lá a foto
// precisa ser caçada na loja porque a origem é uma mensagem de terceiro; aqui a
// foto do produto JÁ veio junto com a oferta (`imageUrl` da receita), então só
// falta achar a âncora do link e montar o card.
//
// A âncora é obrigatória pelo mesmo motivo de sempre: sem o link literal no
// corpo da mensagem o WhatsApp não associa o card e não renderiza nada.
async function buildBroadcastLinkPreview({ text, destJid, jpegThumbnail, hqBuffer }) {
  const corpo = String(text || '')
  const link = detectLinks(corpo).find(l => corpo.includes(l.url))
  if (!link) return null

  let thumb = jpegThumbnail
  let hq = hqBuffer
  // Mesma tela fixa do card do espelhamento: a foto da receita vem da loja com
  // a proporção que a loja usa, e sem isto cada oferta da fila sai com um card
  // de tamanho diferente. A miniatura embutida é refeita a partir da imagem
  // composta — divergir dela traria de volta o "muda de tamanho ao carregar".
  const preparada = hqBuffer ? await prepararFotoDoCard(hqBuffer) : null
  if (preparada?.buffer && preparada?.jpegThumbnail) {
    thumb = preparada.jpegThumbnail
    hq = preparada.buffer
  } else if (!thumb && hqBuffer) {
    const normalized = await normalizeImageForWhatsApp(hqBuffer)
    thumb = normalized?.jpegThumbnail
    hq = normalized?.buffer || normalized?.jpegThumbnail
  }
  // Sem foto não há card: um urlInfo só com matched-text renderiza uma barra
  // vazia. Devolver null faz quem chamou cair na foto/texto, como antes.
  if (!thumb) return null

  let highQualityThumbnail
  if (hq && typeof activeSock?.waUploadToServer === 'function') {
    try {
      const { imageMessage } = await prepareWAMessageMedia(
        { image: hq },
        { upload: activeSock.waUploadToServer, mediaTypeOverride: 'thumbnail-link', jid: destJid },
      )
      highQualityThumbnail = imageMessage || undefined
    } catch (err) {
      logger.warn({ err: err?.message, destJid }, 'Card da oferta: upload da miniatura grande falhou — card sai compacto')
    }
  }

  return {
    'canonical-url': link.url,
    'matched-text': link.url,
    // `title` NUNCA pode ser omitido: sem ele o WhatsApp não renderiza o card
    // (regressão do PR #1186). Mesma regra do card do espelhamento.
    title: storePreviewTitle(link.platform, link.url, false),
    jpegThumbnail: thumb,
    ...(highQualityThumbnail ? { highQualityThumbnail } : {}),
  }
}

async function buildPayloadFromRecipe(recipe, { destJid } = {}) {
  if (recipe?.type !== 'imageUrl') return undefined

  // Ponto único: a receita nunca é lida crua. Receita antiga (enfileirada
  // antes desta versão) não tem `appearance` e cai em 'original' — o
  // comportamento que ela já esperava.
  const appearance = resolveOfferAppearance(recipe.appearance ?? {})

  let baixada = null
  try {
    const fetched = await fetchImageBuffer(recipe.imageUrl, recipe.refererUrl)
    baixada = fetched?.buffer ?? null
    if (fetched && !baixada) {
      logger.warn({ srcMime: fetched.mimetype }, 'broadcast image: download sem bytes — enviando texto com preview')
    }
  } catch (err) {
    logger.warn({ err: err?.message, imageUrl: recipe.imageUrl }, 'broadcast image: falha ao baixar imagem — enviando texto com preview')
  }

  // A marca é composta UMA vez e serve aos dois formatos: no card ela vira a
  // miniatura, na foto ela vira o corpo. Assim a pessoa vê a mesma imagem
  // marcada nos dois casos. Best-effort: marca que falha deixa a oferta sair
  // sem marca, nunca sem imagem.
  let marcada = null
  if (baixada && appearance.watermark) {
    try {
      marcada = await renderDestinationWatermark(baixada, appearance.watermark)
      if (!marcada.watermarkApplied) reportWatermarkMissing(`oferta:${marcada.skipReason || 'nao_aplicada'}`, { destJid })
    } catch (err) {
      logger.warn({ err: err?.message, destJid }, 'Marca d\'água da oferta falhou; enviando imagem sem marca')
      reportWatermarkMissing('oferta:render_falhou', { destJid, err: err?.message })
    }
  } else if (appearance.watermark && !baixada) {
    reportWatermarkMissing('oferta:sem_foto', { destJid })
  }

  if (appearance.baseMode === 'preview') {
    const linkPreview = await buildBroadcastLinkPreview({
      text: recipe.text,
      destJid,
      jpegThumbnail: marcada?.thumbnail,
      hqBuffer: marcada?.main ?? baixada,
    }).catch(err => {
      logger.warn({ err: err?.message, destJid }, 'Card da oferta falhou; oferta sai com a foto')
      return null
    })
    if (linkPreview) {
      return buildMonitoredMessagePayload({
        finalText: recipe.text,
        image: null,
        useLinkPreview: true,
        linkPreview,
      })
    }
    // Sem âncora de link ou sem foto o card é impossível. Cair na FOTO (abaixo)
    // é melhor do que insistir e mandar texto pelado — a oferta continua
    // saindo com imagem, só sem o clique que abre a loja.
  }

  let image = null
  if (marcada) {
    image = {
      buffer: marcada.main,
      mimetype: 'image/jpeg',
      jpegThumbnail: marcada.thumbnail,
      width: marcada.width,
      height: marcada.height,
    }
  } else if (baixada) {
    image = await normalizeImageForWhatsApp(baixada)
    if (!image) {
      logger.warn({ size: baixada.length }, 'broadcast image: normalizeImageForWhatsApp falhou — enviando texto com preview')
    }
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

/**
 * Re-enfileira um job adiado por defer LONGO (janela silenciosa, burst/daily
 * cap, pausa de saúde) sem congelar a fila serial. Reverte o MessageLog para
 * `queued`, agenda o reenvio com `notBefore = gate.deferUntil` e devolve o
 * controle ao consumidor — os próximos jobs (de outros destinos/fontes) saem
 * normalmente. O callback onDone (doneCallbacks por logId) é preservado: só
 * finalizamos o job se ele NÃO couber na fila.
 */
function deferReasonMessage(reason) {
  // Nenhuma dessas frases pode citar tela antiga ("Preservação por destino")
  // nem termo técnico. O gate de rajada (burst) foi removido em 2026-09-25 —
  // só intervalo mínimo, limite diário e horário de funcionamento seguem
  // adiando envio.
  if (reason === 'daily_cap') {
    return 'Este grupo/canal já bateu o limite diário de ofertas configurado no Anti-banimento. Os envios continuam amanhã.'
  }
  if (reason === 'min_interval') {
    return 'Esperando o intervalo mínimo entre uma oferta e outra deste grupo/canal, configurado no Anti-banimento.'
  }
  if (reason === 'outside_operating_hours' || reason === 'quiet_hours') {
    return 'Fora do horário de envio configurado para este grupo/canal no Anti-banimento.'
  }
  if (reason === 'health_paused') {
    return 'O bot pausou os envios para este grupo/canal por segurança. Deve voltar sozinho em breve.'
  }
  if (reason === DESTINATION_SPACING_REASON) {
    return 'Esperando o intervalo entre destinos que você definiu no Anti-banimento.'
  }
  return 'Aguardando a vez certa de enviar para este grupo/canal (Anti-banimento).'
}

async function deferSendJob(job, gate) {
  const deferUntil = gate?.deferUntil ?? Date.now()
  sendMetrics.deferredTotal++
  await db.messageLog.update({
    where: { id: job.logId },
    data: { status: 'queued', errorMsg: deferReasonMessage(gate?.reason) },
  }).catch(() => {})
  logger.info(
    { destJid: job.destJid, reason: gate?.reason, deferUntil, logId: job.logId },
    'Defer longo: re-enfileirando job com notBefore (não congela a fila serial)',
  )
  const accepted = await sendBackend.enqueue({ ...job, notBefore: deferUntil })
  if (!accepted) {
    await db.messageLog.update({
      where: { id: job.logId },
      data: { status: 'error', errorMsg: classifyError(null, { kind: 'queue_full' }), sentAt: new Date() },
    }).catch(() => {})
    await finishSendJob(job, { ok: false, error: 'queue_full_on_defer' })
  }
}

// Plano B: preset default de preservação da conta (fallback para destinos sem
// preset/override). Cache curto para não consultar o banco a cada envio. value
// undefined = ainda não carregado; null = carregado e não existe.
let defaultPresetCache = { value: undefined, at: 0 }
const DEFAULT_PRESET_TTL_MS = 30_000
async function getDefaultPreservationPreset() {
  const now = Date.now()
  if (defaultPresetCache.value !== undefined && now - defaultPresetCache.at < DEFAULT_PRESET_TTL_MS) {
    return defaultPresetCache.value
  }
  const preset = await db.preservationPreset.findFirst({ where: { userId, isDefault: true } }).catch(() => null)
  defaultPresetCache = { value: preset ?? null, at: now }
  return defaultPresetCache.value
}

// specs/017-client-coupon-catalog (Trava #2 — convergência única do token):
// mesmo applyCouponToken (src/core/clientCouponPolicy.js) para os campos de
// texto conhecidos do payload de envio. Mutação in-place: nunca clona Buffer
// de mídia, só troca string quando ela de fato contém `{cupom}`.
function resolveCouponTextField(value, couponText) {
  return (typeof value === 'string' && value.includes('{cupom}')) ? applyCouponToken(value, couponText) : value
}

function applyCouponTokenToPayload(payload, couponText) {
  if (!payload || typeof payload !== 'object') return payload
  if (payload.text !== undefined) payload.text = resolveCouponTextField(payload.text, couponText)
  if (payload.caption !== undefined) payload.caption = resolveCouponTextField(payload.caption, couponText)
  if (payload.primary) {
    if (payload.primary.text !== undefined) payload.primary.text = resolveCouponTextField(payload.primary.text, couponText)
    if (payload.primary.caption !== undefined) payload.primary.caption = resolveCouponTextField(payload.primary.caption, couponText)
  }
  if (Array.isArray(payload.fallbacks)) {
    for (const fb of payload.fallbacks) {
      if (!fb) continue
      if (fb.text !== undefined) fb.text = resolveCouponTextField(fb.text, couponText)
      if (fb.caption !== undefined) fb.caption = resolveCouponTextField(fb.caption, couponText)
    }
  }
  // Caminho relay (escape hatch IMAGE_ORIGINAL_STRATEGY=relay): o proto já
  // decodificado do WhatsApp carrega a legenda em campos próprios.
  if (payload.relay?.proto) {
    const proto = payload.relay.proto
    if (proto.imageMessage?.caption !== undefined) proto.imageMessage.caption = resolveCouponTextField(proto.imageMessage.caption, couponText)
    if (proto.videoMessage?.caption !== undefined) proto.videoMessage.caption = resolveCouponTextField(proto.videoMessage.caption, couponText)
    if (proto.extendedTextMessage?.text !== undefined) proto.extendedTextMessage.text = resolveCouponTextField(proto.extendedTextMessage.text, couponText)
  }
  return payload
}

// Resolve o texto final do cupom (ou '' quando não há cupom aplicável) a
// partir dos cupons já carregados em getConfig() (D1 da pesquisa: zero
// consulta nova ao banco neste caminho) e do couponContext carregado pelo
// job. NUNCA lança — best-effort absoluto (FR-028b).
// Envios do painel (Enviar agora, Agendar, Inserir na fila): a loja sai do
// primeiro link do texto — mesmo detector do espelhamento (src/detector.js).
// Preço desconhecido: cai na ordem fixa e previsível do FR-011 em chooseCoupon.
// Fonte ÚNICA para os dois caminhos, para agendado e imediato nunca divergirem.
// `priceCents` é o preço que a tela do Criar oferta leu da loja: com ele sai o
// "de X por Y com o cupom" também no envio. Sem ele, preço desconhecido.
function couponContextFromText(text, priceCents = null) {
  const platform = detectLinks(text || '')[0]?.platform ?? null
  return platform ? { platform, priceCents: sanitizePriceCents(priceCents) } : null
}

async function resolveCouponTextForJob(job) {
  try {
    const ctx = job?.couponContext
    if (!ctx || !ctx.platform) return ''
    const cfg = await getConfig().catch(() => null)
    const coupons = cfg?.coupons ?? []
    const choice = chooseCoupon({ coupons, platform: ctx.platform, priceCents: ctx.priceCents, now: Date.now() })
    if (!choice) return ''
    return renderCouponText({ coupon: choice.coupon, priceCents: ctx.priceCents, finalPriceCents: choice.finalPriceCents })
  } catch {
    return ''
  }
}

async function processSendJob(job) {
  const startedAt = Date.now()
  let payload = null
  // Escopo de função (não do try): o catch abaixo também lê este id para
  // registrar ChannelHealth no fracasso. `let` dentro do try não enxergaria
  // no catch (blocos separados) e dispararia ReferenceError no caminho de erro.
  let destGroupId = null

  try {
    await db.messageLog.update({
      where: { id: job.logId },
      // sentAt estampado ao ENTRAR em 'sending' para o watchdog de envios presos
      // (recoverStuckSendLogs) medir tempo-em-sending, não tempo desde a criação
      // (a linha pode ter sido criada/adiada horas antes).
      data: { status: 'sending', errorMsg: null, sentAt: new Date() },
    })
    sendMetrics.sendingTotal++

    // PR-5.C.1 + 5.B.1: lookup do groupId do destino-post (uma vez por job)
    // para alimentar ChannelHealth e passar pelo velocity scheduler.
    //
    // O gate vale para QUALQUER destino-post — canal (@newsletter) E grupo
    // espelhado (@g.us). Historicamente o lookup filtrava `kind: 'channel'`,
    // então grupos espelhados NUNCA passavam pelo horário nem pelo intervalo
    // mínimo da preservação — por isso enviavam de madrugada e sem respeitar o
    // espaçamento. A decisão (checkAndReserve → decideDestination) já é agnóstica
    // de kind; só o call site limitava.
    //
    // RCA 2026-07: a resolução da preservação subiu para ANTES de qualquer
    // espera. Ela decide também o descarte por idade (queueMaxAgeMin) — não faz
    // sentido dormir 60s de freio para só então jogar a mensagem fora.
    let destPreservation = null
    let destGroupRow = null
    try {
      destGroupRow = await db.group.findFirst({
        where: { userId, waJid: job.destJid, role: 'post' },
        select: {
          id: true,
          // Plano B: config de preservação por destino (Fase 1b).
          preservationPresetId: true, operatingHoursEnabled: true, operatingHoursJson: true,
          throttleEnabled: true, minIntervalSec: true,
          dailyCap: true, queueMaxAgeMin: true, preservationPreset: true,
        },
      })
      destGroupId = destGroupRow?.id ?? null
      if (destGroupId) {
        // Plano B / Fase 3: a config POR DESTINO é a ÚNICA fonte de verdade do
        // gate. resolveDestinationPreservation cai no preset default da conta e,
        // na ausência dele, no HARD_DEFAULT — então NUNCA fica sem proteção
        // anti-ban. O fallback para a global do BotConfig foi aposentado aqui.
        const defaultPreset = await getDefaultPreservationPreset()
        destPreservation = resolveDestinationPreservation(destGroupRow, { preset: destGroupRow.preservationPreset, defaultPreset })
      }
    } catch (err) {
      logger.warn({ err: err?.message, destJid: job.destJid }, 'Preservação do destino não pôde ser lida; seguindo sem pausa')
    }

    // B) Revalidação do destino (RCA 2026-08-26). Os destinos são calculados
    // quando a mensagem CHEGA; o job só sai no dequeue, que pode ser muito
    // depois (preservação do destino, freio de fila). Se a cliente desvinculou
    // ou apagou o destino nesse meio-tempo, a alteração valia só para mensagens
    // futuras e o job já materializado seguia entregando — foi assim que uma
    // oferta saiu 1,5s DEPOIS de o destino ser apagado no painel. Só vale para
    // envio espelhado (`converted`, que carrega `sourceJid`); broadcast, oferta
    // automática e agendamento têm destino escolhido na hora e não passam aqui.
    if (job.type === 'converted' && job.sourceJid) {
      const unlinked = await (async () => {
        try {
          const cfg = await getConfig()
          const monitorGroup = cfg.groups.monitor.find(g => g.waJid === job.sourceJid)
          if (!monitorGroup) {
            // A origem sumiu da config: não há mais espelhamento dela.
            return { drop: true, reason: 'source_unlinked' }
          }
          const current = resolveMonitorDestinations({
            targetsMode: monitorGroup.targetsMode,
            targetPostJids: monitorGroup.targetPostJids,
            allPostJids: cfg.groups.post,
          })
          // 'status@broadcast' é destino sintético (postToStatus), não vive em
          // Group — nunca deve ser descartado por esta checagem.
          if (job.destJid === 'status@broadcast') return { drop: false, reason: 'status' }
          return shouldDropUnlinkedDestination({ destJid: job.destJid, currentDestinations: current.destinations })
        } catch (err) {
          // Fail-safe: sem foto confiável da config, envia (descartar por
          // dúvida perderia oferta legítima).
          logger.warn({ err: err?.message, destJid: job.destJid }, 'Revalidação do destino falhou; seguindo com o envio')
          return { drop: false, reason: 'unknown_config' }
        }
      })()
      if (unlinked.drop) {
        await db.messageLog.update({
          where: { id: job.logId },
          data: { status: 'skipped', errorMsg: `skip:${unlinked.reason}`, sentAt: new Date() },
        }).catch(() => {})
        logger.warn({ destJid: job.destJid, sourceJid: job.sourceJid, logId: job.logId, reason: unlinked.reason }, 'Envio descartado: destino não está mais vinculado à origem')
        try { recordOperationalSignal('send_dest_unlinked', { userId, destJid: job.destJid, sourceJid: job.sourceJid, reason: unlinked.reason }) } catch {}
        await finishSendJob(job, { ok: false, error: unlinked.reason })
        return
      }
    }

    // C) Descarte por idade na fila (configurável por destino na Preservação).
    // Oferta que ficou esperando mais que o teto não serve mais — e fila
    // infinita é o que liga o freio progressivo e derruba a vazão de todos os
    // destinos. Não é erro de envio: é decisão, com motivo próprio no painel.
    const queueExpiry = shouldDropExpiredQueueJob({
      enqueuedAt: job.enqueuedAt,
      queueMaxAgeMin: destPreservation?.queueMaxAgeMin,
    })
    if (queueExpiry.drop) {
      const reason = buildQueueExpiredReason(queueExpiry)
      sendMetrics.queueExpiredTotal++
      await db.messageLog.update({
        where: { id: job.logId },
        data: { status: 'skipped', errorMsg: reason, sentAt: new Date() },
      }).catch(() => {})
      logger.warn({ destJid: job.destJid, logId: job.logId, ageMs: queueExpiry.ageMs, maxAgeMs: queueExpiry.maxAgeMs, type: job.type }, 'Envio descartado: esperou na fila além do teto do destino')
      await finishSendJob(job, { ok: false, error: 'queue_expired' })
      return
    }

    // C2) Fora do horário de envio E sem chance de sair antes do limite de
    // espera → descarta AGORA (RCA 2026-09-24, decisão A da dona do produto).
    // Antes a oferta da noite ficava adiada até as 8h só para ser descartada
    // pelo bloco C acima, horas depois, sem a cliente saber o porquê. Mesmo
    // lugar da ordem canônica (antes do smart delay), motivo próprio no
    // painel. Fila com horário próprio (ignoreGlobalQuietHours) e limite de
    // espera desligado NÃO passam por aqui (ver src/core/sendWindow.js).
    const windowDrop = shouldDropOutsideSendWindow({
      now: Date.now(),
      enqueuedAt: job.enqueuedAt,
      preservation: destPreservation,
      ignoreOperatingHours: job.ignoreGlobalQuietHours === true,
    })
    if (windowDrop.drop) {
      const reason = buildOutsideSendWindowReason(windowDrop)
      sendMetrics.outsideSendWindowTotal++
      await db.messageLog.update({
        where: { id: job.logId },
        data: { status: 'skipped', errorMsg: reason, sentAt: new Date() },
      }).catch(() => {})
      logger.warn({ destJid: job.destJid, logId: job.logId, ageMs: windowDrop.ageMs, waitMs: windowDrop.waitMs, maxAgeMs: windowDrop.maxAgeMs, window: windowDrop.window, type: job.type }, 'Envio descartado: fora do horário de envio do destino e não sairia antes do limite de espera')
      await finishSendJob(job, { ok: false, error: 'outside_send_window' })
      return
    }

    const restDelayMs = calculateRestWindowDelayMs({
      sentCount: sendMetrics.successTotal,
      every: SMART_DELAY_REST_EVERY,
      durationMs: SMART_DELAY_REST_MS,
    })
    // B) Freio progressivo medido POR DESTINO (ver getSendBackendQueueSizeForDest):
    // recalculado agora, no dequeue, em vez de congelado no enqueue com o
    // tamanho da fila GLOBAL — que fazia um destino lento penalizar todos.
    // O antigo sorteio congelado no enqueue foi aposentado: o intervalo entre
    // destinos é decidido/adiado mais abaixo, por core/destinationSpacing.js,
    // nunca somado aqui dentro do smart delay.
    const destQueueSize = getSendBackendQueueSizeForDest(job.destJid)
    const pressureDelayMs = buildQueuePressureDelayMs(destQueueSize)
    const totalDelayMs = pressureDelayMs + restDelayMs
    if (totalDelayMs > 0) {
      logger.info({ destJid: job.destJid, delayMs: totalDelayMs, pressureDelayMs, destQueueSize, restDelayMs, type: job.type }, 'Smart delay antes do envio')
      await sleep(totalDelayMs)
    }

    try {
      // "Intervalo entre destinos" (core/destinationSpacing.js): vale para
      // QUALQUER destino da conta (grupo, canal, status@broadcast, com ou sem
      // Group cadastrado) — não só canal, e não só quem tem preservação por
      // destino configurada (FR-022/FR-023). Por isso o gate roda mesmo sem
      // `destGroupId`; nesse caso só o espaçamento decide.
      const cfgFull = await getConfig().catch(() => null)
      const cfg = cfgFull?.botConfig ?? {}
      const spacingEnabled = isDestinationSpacingEnabled()
      const spacingIntervalMs = toDestinationIntervalMs(cfg)
      const gateOpts = destPreservation ? {
        // A-2: fila com horário próprio sobrepõe a janela do destino (a fila já
        // checou seu horário antes de despachar) → ignoreOperatingHours.
        ignoreGlobalQuietHours: job.ignoreGlobalQuietHours === true,
        // Plano B / Fase 3: destPreservation (preset/override → preset default →
        // HARD_DEFAULT) é a ÚNICA fonte de verdade do gate. Anti-ban sempre
        // ativo por destino; o master global e o legado decide() foram removidos.
        destPreservation,
      } : null

      let throttleCycles = 0
      while (!shuttingDown) {
        const spacing = decideDestinationSpacing({
          now: Date.now(),
          destJid: job.destJid,
          intervalMs: spacingIntervalMs,
          state: destinationSpacingState,
          enabled: spacingEnabled,
        })
        // Peek: NÃO reserva rajada/limite diário ainda — só depois de saber
        // que o gate COMBINADO libera (destino + espaçamento), senão um job
        // adiado pelo espaçamento queimaria rajada/limite diário à toa
        // (research R11, item 2).
        const dest = (destGroupId && gateOpts)
          ? await peekDestinationDecision(destGroupId, gateOpts)
          : { allow: true }
        const gate = combineGateDecisions(dest, spacing)

        if (gate.allow) {
          if (destGroupId && gateOpts) {
            await reserveDestinationSlot(destGroupId, gateOpts)
          }
          destinationSpacingState = reserveSpacingSlot(destinationSpacingState, {
            now: Date.now(),
            destJid: job.destJid,
            intervalMs: spacingIntervalMs,
          })
          break
        }

        if (gate.source === 'spacing' || gate.source === 'both') {
          // FR-024: o intervalo entre destinos NUNCA espera dentro da fila
          // serial, mesmo quando a espera é curta — ele trava TODOS os envios
          // da conta (não só este destino), diferente do defer curto abaixo,
          // que é só do gate DESTE destino.
          destinationSpacingState = reserveSpacingSlot(destinationSpacingState, {
            now: Date.now(),
            destJid: job.destJid,
            intervalMs: spacingIntervalMs,
            deferredUntil: gate.deferUntil,
          })
          logger.info({ destJid: job.destJid, deferUntil: gate.deferUntil }, 'Adiado pelo intervalo entre destinos')
          await deferSendJob(job, gate)
          return
        }

        // gate.source === 'destination': comportamento histórico preservado.
        // Defer LONGO (quiet_hours/burst_cap/daily_cap/health_paused) não pode
        // segurar o consumidor serial: ele congelaria TODOS os envios do
        // usuário — inclusive para destinos liberados e outras fontes. Em vez
        // de `await sleep`, re-enfileira o job com notBefore e retorna,
        // liberando a fila para os próximos jobs. Defer CURTO (min_interval)
        // continua sendo esperado inline (barato e preserva ordem).
        const waitMs = Math.max(0, (gate.deferUntil ?? Date.now()) - Date.now())
        if (waitMs > THROTTLE_INLINE_WAIT_MAX_MS) {
          await deferSendJob(job, gate)
          return
        }
        throttleCycles++
        logger.info({ destJid: job.destJid, reason: gate.reason, waitMs, throttleCycles }, 'Velocity scheduler: aguardando janela curta de throttle do destino')
        await sleep(waitMs)
      }
      if (shuttingDown) throw new Error('Worker encerrando durante espera de throttle do destino')
    } catch (err) {
      logger.warn({ err: err?.message, destJid: job.destJid }, 'channelHealth/throttle lookup falhou; seguindo sem pausa')
    }

    let couponTokenResolved = false
    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {
      try {
        const sockForAttempt = activeSock
        if (!sockForAttempt) throw new Error('Bot não conectado')
        if (payload === null) {
          if (typeof job.buildPayload === 'function') payload = await job.buildPayload()
          else if (job.payloadRecipe) payload = await buildPayloadFromRecipe(job.payloadRecipe, { destJid: job.destJid })
          else payload = job.payload
        }
        if (payload === undefined) throw new Error('Invalid send job: payload/buildPayload ausente')
        // specs/017-client-coupon-catalog (D1/D3 da pesquisa, Trava #2): resolvido
        // no ÚLTIMO instante possível — direto no dequeue —, para que FR-014
        // (cupom desligado/vencido depois de enfileirado não sai) valha mesmo
        // para item que ficou horas esperando na fila. Roda uma única vez (não
        // a cada retry) e NUNCA aborta o envio (FR-028b, best-effort absoluto).
        if (!couponTokenResolved) {
          couponTokenResolved = true
          try {
            const couponText = await resolveCouponTextForJob(job)
            payload = applyCouponTokenToPayload(payload, couponText)
          } catch (err) {
            logger.warn({ err: err?.message, destJid: job.destJid }, 'Falha ao resolver cupom no envio; oferta segue sem cupom')
          }
        }
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

        if (destGroupId) {
          recordChannelSendResult(destGroupId, { ok: true, latencyMs: finishedAt - startedAt }, { now: finishedAt })
            .catch(err => logger.warn({ err: err?.message }, 'recordChannelSendResult(ok) falhou'))
        }

        // Registra COMO a oferta saiu (visão admin de qualidade de entrega).
        // `deliveryInfo` é preenchido por buildPayload, que já rodou acima neste
        // mesmo dequeue. Campos ausentes ficam NULL: "não sabemos" é uma
        // resposta honesta e não polui a contagem do painel.
        const entrega = job.deliveryInfo || {}
        await db.messageLog.update({
          where: { id: job.logId },
          data: {
            status: 'success',
            errorMsg: null,
            sentAt: new Date(),
            ...(entrega.kind ? { deliveryKind: entrega.kind } : {}),
            ...(Number.isFinite(entrega.originImageBytes) ? { originImageBytes: entrega.originImageBytes } : {}),
            // Feature 017 (arquitetura multicanal de entrega), T023: este é o
            // caminho de envio de WhatsApp — toda linha nova sai marcada
            // 'whatsapp', sem reduções (FR-027/SC-003). Sem backfill: linha
            // anterior a esta feature já lê como WhatsApp por resolver
            // null como whatsapp em toda leitura.
            deliveryNetwork: DELIVERY_NETWORK.WHATSAPP,
            deliveryReductions: null,
          },
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
    if (destGroupId) {
      const errorCode = isChannelForbiddenError(err)
        ? '403'
        : (err?.output?.statusCode ? String(err.output.statusCode) : (err?.code ?? null))
      recordChannelSendResult(destGroupId, { ok: false, errorCode, errorMsg: err.message })
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

// Reenfileira automaticamente, a cada boot, as ofertas perdidas por restart
// do worker (deploy, crash, cutover) — markInterruptedSendLogs() acima marca
// como `error:worker_restart` tudo que estava `queued`/`sending` quando o
// processo anterior morreu, e sem isso a oferta some da fila sem nunca ter
// sido reenviada (cliente reclamou: "O bot reiniciou enquanto essa mensagem
// estava esperando para ser enviada").
//
// Remonta o MESMO card manual do envio ao vivo (buildManualLinkPreview: foto
// raspada da loja + marca d'água do destino) a partir só do que sobrevive no
// MessageLog (platform/originalUrl/convertedUrl/messageText) — a mensagem
// original do WhatsApp e a imagem já processada morreram com o processo
// antigo, então a foto é raspada de novo da loja, não reaproveitada. Sem
// `couponTextSignal` real (não temos o texto/warning da mensagem original),
// o banner de marca de cupom (feature opt-in, default OFF) nunca dispara
// aqui — na dúvida, sai foto de produto, não banner.
//
// A montagem do card roda DENTRO do `buildPayload` do job (lazy, no dequeue),
// não aqui no boot: raspar imagem/fazer upload é I/O lento, e fazer isso
// para dezenas de ofertas ANTES de abrir o socket do WhatsApp atrasaria a
// reconexão. `uploadToServer` (activeSock?.waUploadToServer) só existe depois
// que o socket conecta — outro motivo para ser lazy.
//
// Só olha os últimos WORKER_RESTART_REPROCESS_WINDOW_MS: protege contra
// reprocessar erro antigo de uma sessão anterior (bot ficou dias offline).
// Escape hatch: WORKER_RESTART_REPROCESS_ENABLED=false desliga sem deploy.
const WORKER_RESTART_REPROCESS_ENABLED = process.env.WORKER_RESTART_REPROCESS_ENABLED !== 'false'
const WORKER_RESTART_REPROCESS_WINDOW_MS = Math.max(60_000, Number(process.env.WORKER_RESTART_REPROCESS_WINDOW_MS) || 30 * 60_000)

async function reprocessRestartFailures() {
  if (!WORKER_RESTART_REPROCESS_ENABLED) return
  const cutoff = new Date(Date.now() - WORKER_RESTART_REPROCESS_WINDOW_MS)
  const stuck = await db.messageLog.findMany({
    where: {
      userId,
      status: 'error',
      errorMsg: 'error:worker_restart',
      platform: { not: 'scheduled' },
      sentAt: { gte: cutoff },
    },
    take: 200,
  })
  if (stuck.length === 0) return

  const cfg = await getConfig().catch(() => null)
  let requeued = 0
  for (const row of stuck) {
    try {
      // Claim atômico: evita reprocessar a mesma linha duas vezes se esta
      // função for chamada mais de uma vez (defesa em profundidade).
      const claimed = await db.messageLog.updateMany({
        where: { id: row.id, errorMsg: 'error:worker_restart' },
        data: { errorMsg: 'error:worker_restart:requeued' },
      })
      if (claimed.count !== 1) continue
      if (!row.destGroup || !row.messageText || !cfg) continue

      const log = await db.messageLog.create({
        data: {
          userId,
          platform: row.platform,
          sourceGroup: row.sourceGroup,
          destGroup: row.destGroup,
          originalUrl: row.originalUrl,
          convertedUrl: row.convertedUrl,
          messageText: row.messageText,
          status: 'queued',
        },
      })
      const postDetail = cfg.groups.postDetails.find(g => g.waJid === row.destGroup)
      const channelForward = resolveChannelForward(postDetail)
      // Mesma resolução de marca d'água do envio ao vivo (ver linhas próximas
      // a `destinationImageUsesWatermark` no handler de messages.upsert):
      // config é por destino, então precisa ser recalculada aqui, não herdada
      // da oferta original.
      const destinationImageMode = effectiveDestinationImageMode(postDetail?.imageMode, { hasChannelButton: !!channelForward })
      const watermarkText = String(postDetail?.watermarkText ?? '').trim()
      const watermarkColor = postDetail?.watermarkColor ?? undefined
      const watermarkSize = postDetail?.watermarkSize ?? undefined
      const watermarkPosition = postDetail?.watermarkPosition ?? undefined
      const useDestinationWatermark = destinationImageUsesWatermark(destinationImageMode) && Boolean(watermarkText)
      const primary = { platform: row.platform, url: row.originalUrl, converted: row.convertedUrl }

      const accepted = await enqueueSendJob({
        type: 'converted',
        logId: log.id,
        destJid: row.destGroup,
        sourceJid: row.sourceGroup,
        platforms: row.platform,
        plan: cfg.plan,
        delayMs: 0,
        typingDelayMs: calculateTypingDelayMs({ text: row.messageText, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
        channelForward,
        couponContext: couponContextFromText(row.messageText),
        buildPayload: async () => {
          const linkPreview = await buildManualLinkPreview({
            text: row.messageText,
            primary,
            credentialsMap: cfg.credentials,
            uploadToServer: activeSock?.waUploadToServer,
            destJid: row.destGroup,
            couponTextSignal: false,
            watermark: useDestinationWatermark ? { text: watermarkText, color: watermarkColor, size: watermarkSize, position: watermarkPosition } : null,
          }).catch(err => {
            logger.warn({ err: err?.message, destJid: row.destGroup, logId: log.id }, 'Reprocessamento pós-restart: card de preview falhou; oferta sai como texto')
            return null
          })
          return buildMonitoredMessagePayload({
            finalText: row.messageText,
            image: null,
            useLinkPreview: true,
            linkPreview,
          })
        },
      })
      if (!accepted) {
        await db.messageLog.update({
          where: { id: log.id },
          data: { status: 'error', errorMsg: classifyError(null, { kind: 'queue_full' }), sentAt: new Date() },
        }).catch(() => {})
        continue
      }
      requeued++
    } catch (err) {
      logger.warn({ err: err?.message, logId: row.id }, 'Reprocessamento pós-restart falhou para esta oferta')
    }
  }
  if (requeued > 0) {
    logger.info({ found: stuck.length, requeued }, 'Ofertas perdidas por restart do worker reenfileiradas automaticamente')
  }
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
        // P1-2: roteamento por serializabilidade (backend híbrido).
        //  - Job com recipe/payload puro (broadcast, oferta automática,
        //    agendado) → BullMQ: PERSISTE e sobrevive a restart do worker
        //    (no dequeue, processSendJob reconstrói via payloadRecipe e
        //    atualiza o MessageLog sozinho).
        //  - Job com relay proto, buffer de mídia "original" ou closure
        //    buildPayload → fila em MEMÓRIA: não dá para serializar sem
        //    corromper a mídia (Buffer vira {type:'Buffer'} e a oferta sai
        //    sem foto). Decisão consciente ("relay memory-only"), não erro.
        //    Ver AGENTS.md seção "Fila de envio (BullMQ + DLQ)".
        const offender = findUnserializableField(job)
        if (offender) {
          logger.debug({ logId: job?.logId, path: offender.path, kind: offender.kind }, 'Job de envio não-serializável — roteado para fila em memória (relay/original-media)')
          return Promise.resolve(memoryFallback.enqueue(job))
        }
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
let reconnectAttempts = 0
// Timestamps de eventos connectionReplaced (440) na janela deslizante. NÃO é
// zerado num `open` curto — é justamente quando o ping-pong reabre a cada ciclo.
let replacedTimestamps = []
// Timestamps de closes genéricos (flap) e de badSession (500) nas janelas
// deslizantes. Mesma lógica do replaced: imunes a `open` curto.
let closeTimestamps = []
let badSessionTimestamps = []
let stableCloseTimestamps = []
// Momento (ms) em que o socket atingiu `connection: 'open'` nesta tentativa.
// Usado no close para medir se a sessão foi estável antes de cair.
let connectionOpenedAt = null
// Marca se esta sessão JÁ ficou estável (open >= RECONNECT_STABLE_MS) alguma vez
// na vida deste worker. Persiste entre reconexões (escopo de módulo, fora de
// startBot). Serve à política de badSession: uma credencial que já produziu uma
// conexão estável é válida por definição — rajadas de 500 posteriores são
// transitórias, não corrupção que justifique apagar auth. Ver
// shouldResetAuthForBadSession(keepEstablishedAuth).
let everHadStableOpen = false
// RCA 2026-08-28: teto de tentativas sem sucesso. `everOpened` é mais frouxo
// que `everHadStableOpen` de propósito — para a PARADA definitiva só vale
// "nunca chegou a abrir nenhuma vez", não "abriu mas não ficou estável".
// Escopo de módulo: precisa sobreviver às reconexões do mesmo worker.
let everOpened = false
let consecutiveFailedReconnects = 0
const RETRY_GIVEUP_ATTEMPTS = Math.max(0, Number(process.env.WA_RETRY_GIVEUP_ATTEMPTS ?? DEFAULT_GIVEUP_ATTEMPTS))
const RETRY_SLOW_INTERVAL_MS = Math.max(0, Number(process.env.WA_RETRY_SLOW_INTERVAL_MS ?? DEFAULT_SLOW_INTERVAL_MS))
const RETRY_NEVER_CONNECTED_MAX = Math.max(0, Number(process.env.WA_RETRY_NEVER_CONNECTED_MAX ?? DEFAULT_NEVER_CONNECTED_MAX))

function calcReconnectDelayMs() {
  return calcBackoffDelayMs(reconnectAttempts, { baseMs: RECONNECT_BASE_MS, maxMs: RECONNECT_MAX_MS })
}

// Busca o registro público de versões REAIS do WA Web com o mesmo teto de
// tempo do fetch do Baileys — a resolução de versão nunca pode segurar o boot
// do socket.
async function fetchWaVersionRegistry(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_WA_VERSION_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchVersionCached() {
  const { version, source } = await resolveWaWebVersion({
    envValue: process.env.WA_WEB_VERSION,
    registryUrl: process.env.WA_VERSION_REGISTRY_URL ?? WA_VERSION_REGISTRY_URL_DEFAULT,
    fetchRegistry: fetchWaVersionRegistry,
    fetchBaileysVersion: () => Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('fetchLatestBaileysVersion timeout')), FETCH_WA_VERSION_TIMEOUT_MS).unref()
      ),
    ]),
    cached: cachedBaileysVersion,
    logger,
  })
  // A versão anunciada é a causa raiz do 405 em massa de 2026-07-28: sem esta
  // linha no log é impossível saber, olhando um incidente, QUAL versão foi
  // usada e de qual fonte ela veio.
  if (!cachedBaileysVersion || cachedBaileysVersion.join('.') !== version.join('.')) {
    logger.info({ waVersion: version.join('.'), source }, 'Versão do WhatsApp Web resolvida para o handshake')
  }
  cachedBaileysVersion = version
  return version
}

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
  } catch (err) {
    // Se startBotInner lançou ANTES de criar o socket (ex: fetchVersionCached
    // falhou sem cache), o connection.update nunca dispara e ninguém reagenda
    // a próxima tentativa. Fazemos isso aqui, mas só se não há socket vivo.
    if (!pendingSock && !activeSock && !shuttingDown) {
      const delayMs = calcReconnectDelayMs()
      reconnectAttempts++
      logger.error({ err: err?.message, attempt: reconnectAttempts, delayMs }, 'startBotInner falhou antes de criar socket; reagendando reconexão')
      scheduleReconnect(delayMs)
    }
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
    await reprocessRestartFailures().catch(err => {
      logger.error({ err: err?.message }, 'Reprocessamento automático pós-restart falhou')
    })
  }

  // Duas janelas: msgIds (curta) protege contra redelivery do WhatsApp do
  // mesmo msg.key.id; links (longa) protege contra a MESMA oferta cair no
  // mesmo destino mais de uma vez dentro da janela. Caso real: várias
  // automações (canais-fonte diferentes) apontando pro mesmo grupo republicam
  // a mesma URL — sem essa janela a oferta saía repetida. A chave de dedup é
  // `destJid:convertedUrl` (independe da fonte), então duas automações com o
  // mesmo produto pro mesmo grupo colidem e só a 1ª passa.
  // Default 120min; override via DEDUP_LINK_WINDOW_MS.
  //
  // RCA 2026-07 (mensagem espelhada 5x): a janela de msgIds fica em 5min DE
  // PROPÓSITO — ela é só a rede contra re-emissão imediata do mesmo id; não é
  // (e não deve virar) a barreira contra reoferta horas depois. A causa da
  // reoferta é atacada na origem, no filtro de frescor do upsert
  // (shouldProcessIncomingMessage / src/core/incomingFreshness.js): mensagem
  // reentregue pelo WhatsApp (`type: 'append'`, node com `offline`) não entra
  // no pipeline. Esticar esta janela mascararia o sintoma e ainda mexeria na
  // semântica de cupom, que depende de janelas curtas.
  const dedupeWindowMs = Math.max(1_000, Number(process.env.DEDUP_MSGID_WINDOW_MS) || 300_000)
  // Janela de link INDEPENDENTE da de msgIds (era `Math.max(dedupeWindowMs,
  // ...)`): com defaults atuais dá no mesmo, mas amarrar as duas fazia qualquer
  // aumento em msgIds arrastar a janela de link junto e prender repost legítimo.
  const linkDedupWindowMs = Math.max(1_000, Number(process.env.DEDUP_LINK_WINDOW_MS) || 120 * 60_000)
  // Cupom/campanha (primary.linkKind === 'coupon') usa janela CURTA própria:
  // é comum a MESMA URL de cupom (ex.: página fixa de campanha) ser repostada
  // várias vezes ao dia com códigos/textos diferentes — a janela longa
  // (linkDedupWindowMs) bloqueava esses reenvios legítimos por tempo
  // demais. Default 5min; override via COUPON_DEDUP_WINDOW_MS.
  const couponDedupWindowMs = Math.max(1_000, Number(process.env.COUPON_DEDUP_WINDOW_MS) || 5 * 60_000)
  // Janela tardia do portão de entrada (RCA 2026-09-24): mensagem de origem
  // monitorada com até INCOMING_LATE_MAX_AGE_MS passa se o id nunca foi visto.
  // `INCOMING_LATE_MAX_AGE_MS=0` no .env desliga (volta aos 5min puros). A
  // janela dos ids vistos é SEMPRE maior que a tardia (2×, mínimo 2h): um id
  // aceito há 50min precisa continuar "visto" quando a reentrega chega aos 59.
  const incomingLateMaxAgeMs = (() => {
    const raw = process.env.INCOMING_LATE_MAX_AGE_MS
    if (raw === undefined || raw === '') return INCOMING_LATE_MAX_AGE_MS
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : INCOMING_LATE_MAX_AGE_MS
  })()
  const seenIncomingIdWindowMs = Math.max(2 * 60 * 60_000, 2 * incomingLateMaxAgeMs)
  const dedup = pruneDedupStore(
    loadDedup(),
    Date.now(),
    { msgIds: dedupeWindowMs, links: linkDedupWindowMs, seenIds: seenIncomingIdWindowMs },
  )
  scheduleDedupSave(dedup)

  setLifecycleState(WA_LIFECYCLE.INITIALIZING, { reason: 'start_bot' })
  // Pareamento que derrubou o processo deixa a credencial boa num backup que
  // ninguém mais olha — e o próximo pareamento a apagaria. `recoverOrphan` só
  // age quando NÃO há credencial no lugar e HÁ uma no backup; qualquer dúvida
  // não mexe em nada (RCA 2026-09-14). Durante um pareamento em andamento
  // NESTE processo o backup é legítimo e quem manda nele é o próprio fluxo.
  if (!pairingAuthBackup.hasBackup()) {
    await pairingAuthBackup.recoverOrphan().catch(() => false)
  }
  mkdirSync(AUTH_DIR, { recursive: true })
  await clearAppStateSyncKeys()
  startHeartbeatIpc()

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const version = await fetchVersionCached()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    // Não anunciar presença "online" a cada conexão: é um bot de
    // encaminhamento, não precisa aparecer online, e isso reduz churn de
    // sinal com o celular (e a chance de re-sync visível). Recebimento/envio
    // de mensagens independem de presença.
    markOnlineOnConnect: false,
    // Explicitamente sem sync de histórico completo (já é o default): mantém o
    // companion leve. O `messaging-history.set` de chats recentes continua
    // chegando — é o que alimenta "Canais que sigo".
    syncFullHistory: false,
    // Ping periódico para detectar socket morto cedo, em vez de descobrir tarde
    // e reconectar (cada reconexão = nova notificação de sincronização no app).
    keepAliveIntervalMs: WA_KEEPALIVE_INTERVAL_MS,
    // Necessário para o Baileys montar previews grandes de URL. Sem isso,
    // mensagens textuais com link podem sair como texto puro mesmo quando
    // buildMonitoredMessagePayload pede linkPreview. A largura maior ajuda
    // quando o fallback for o preview padrão do Baileys/WhatsApp.
    generateHighQualityLinkPreview: true,
    linkPreviewImageThumbnailWidth: Number(process.env.WA_LINK_PREVIEW_THUMBNAIL_WIDTH || 800),
    logger: instrumentBaileysLoggerForHealth(logger.child({ name: 'baileys' })),
    // Sobrevive a reconexões dentro do mesmo processo — ver comentário na
    // declaração acima (RCA 2026-07: loop infinito de retry-receipt).
    msgRetryCounterCache,
    placeholderResendCache,
    maxMsgRetryCount: WA_MAX_MSG_RETRY_COUNT,
    // Fix de causa raiz: grupo @g.us não-monitorado e dessincronizado que
    // derrubava a sessão via retry-receipt agora é ACKado e descartado antes do
    // decrypt (ver src/core/ignoredJidPolicy.js). Default OFF; ready-guard evita
    // ignorar mensagem legítima enquanto a config ainda não carregou.
    shouldIgnoreJid: (jid) => {
      // Camada 3-B: canal específico que provou estar com a sessão
      // dessincronizada (ver handleGroupDecryptSignal). Checada primeiro —
      // reage rápido, independe do modo de chat-scope.
      if (isChannelDesyncQuarantined(jid)) return true
      // Regra nova (Fase 2): olhar só o que foi escolhido. Com o modo `off`
      // ela não decide nada e a regra antiga (lista de exceções) segue valendo
      // para quem já ligou WA_IGNORE_UNMONITORED_GROUPS.
      const scope = shouldIgnoreByChatScope(jid, {
        mode: CHAT_SCOPE_MODE,
        allowedJids: allowedChatJids,
        ready: allowedChatJidsReady,
        selfJids: selfChatJids,
        disabled: chatScopeDisabled,
      })
      if (scope.ignore) {
        recordChatScopeIgnored(scope.type, normalizeChatScopeJid(jid))
        return true
      }
      return shouldIgnoreChatJid(jid, {
        allowedJids: allowedChatJids,
        enabled: IGNORE_UNMONITORED_GROUPS,
        ready: allowedChatJidsReady,
      })
    },
  })

  pendingSock = sock

  // Aquece o allowlist antes de qualquer mensagem chegar (o shouldIgnoreJid é
  // síncrono; sem isso o 1º lote de mensagens passaria com ready=false). Best
  // effort — se falhar, o ready-guard mantém o comportamento seguro (não ignora).
  if (IGNORE_UNMONITORED_GROUPS || CHAT_SCOPE_MODE !== CHAT_SCOPE_MODES.OFF) void getConfig().catch(() => {})

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
        if (sendIpc) sendIpc({ type: 'pairingCode', requestId, code })
      } catch (err) {
        if (!pairingState.ownsRequest(requestId)) return
        logger.error({ err: err.message, stack: err.stack, requestId }, 'Falha ao solicitar pairing code no socket WA')
        pairingState.clear()
        // O código nunca chegou ao usuário: nada foi trocado no WhatsApp, então
        // a credencial antiga continua válida e volta ao lugar.
        await pairingAuthBackup.restore()
        if (sendIpc) sendIpc({ type: 'pairingCode', requestId, error: err.message })
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
      if (!pairingState.suppressQrEmission() && sendIpc) sendIpc({ type: 'qr', data: qr })
await persistSessionPatch({ status: 'connecting', lifecycle: 'authenticating', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date() })
    }

    if (connection === 'open') {
      setLifecycleState(WA_LIFECYCLE.READY, { reason: 'connection_open' })
      // NÃO zeramos reconnectAttempts aqui: um `open` curto seguido de novo close
      // (flap) zerava o backoff a cada ciclo, então ele nunca escalava e o chip
      // reanunciava 'open' a cada poucos segundos — spam de "sincronização
      // concluída". O reset agora é decidido no close, só se a sessão foi estável
      // (shouldResetBackoff). Aqui só marcamos quando ela abriu.
      connectionOpenedAt = Date.now()
      // Conectou: o orçamento de tentativas volta ao zero.
      everOpened = true
      consecutiveFailedReconnects = 0
      const wasReconnecting = disconnectedSinceMs != null
      activeSock = sock
      pendingSock = null
      disconnectedSinceMs = null
      pairingState.clear()
      const phone = sock.user?.id?.split(':')[0] ?? null
      // Identidades da própria conta (número e `@lid`), para a regra de escopo
      // nunca ignorar o que chega pela própria conta — é por aí que vêm o
      // histórico e as notificações que alimentam "Canais que sigo".
      selfChatJids = buildAllowedJidSet([sock.user?.id, sock.user?.lid, phone ? `${phone}@s.whatsapp.net` : null].filter(Boolean))
      if (sendIpc) sendIpc({ type: 'status', data: 'connected', phone })
      // Lido ANTES do persistSessionPatch sobrescrever `phone` — é o sinal
      // durável de "esta conta já conectou alguma vez" (mesmo usado por
      // `waEverConnected` nos gatilhos de e-mail). Precisa vir antes, senão a
      // mensagem de boas-vindas do piloto reenviaria em toda reconexão.
      const hadPhoneBeforeThisOpen = Boolean(
        (await db.waSession.findUnique({ where: { userId }, select: { phone: true } }).catch(() => null))?.phone,
      )
await persistSessionPatch({ status: 'connected', phone, lifecycle: 'ready', ownerInstance: OWNER_INSTANCE, lastHeartbeatAt: new Date(), lastDisconnectCode: null, blockNotice: null })
      // Este número já fez o teste em outra conta? O número só é conhecido
      // DEPOIS do open — é por isso que a checagem mora aqui e não na rota de
      // conectar. Best-effort e fail-safe: qualquer falha deixa conectar.
      handlePhoneOwnership({ phone, sock }).catch(err => {
        logger.warn({ err: String(err?.message ?? err) }, 'Falha ao conferir número já usado (best-effort)')
      })
      recordWaConnectionEventSafe({
        userId,
        type: wasReconnecting ? 'reconnect_success' : 'connected',
        lifecycle: 'ready',
        ownerInstance: OWNER_INSTANCE,
        metadata: { reconnectAttempts, hadStableOpen: everHadStableOpen },
      })
      trackAnalyticsEventSafe({ userId, event: 'whatsapp_connected' })
      ensureChannelSubscriptions().catch(err => logger.error({ err: err?.message }, 'channels: erro ao inscrever no boot'))
      maybeSendSelfWelcomeMessage({ phone, sock, hadPhoneBefore: hadPhoneBeforeThisOpen }).catch(() => {})
    }

    if (connection === 'close') {
      setLifecycleState(WA_LIFECYCLE.DISCONNECTED, { reason: 'connection_close' })
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      const isLoggedOut = code === DisconnectReason.loggedOut
      const isRestartRequired = code === DisconnectReason.restartRequired
      const isConnectionReplaced = code === DisconnectReason.connectionReplaced
      const isForbidden = code === DisconnectReason.forbidden
      const isBadSession = code === DisconnectReason.badSession // 500
      // 405 não existe no DisconnectReason do Baileys: vem cru do
      // `<failure reason="405">` do servidor (ws.on('CB:failure')). Na prática
      // significa "recusei seu login" e a causa observada em campo é a versão
      // do WA Web anunciada no handshake ter sido cortada (RCA 2026-07-28).
      const isVersionRejected = code === WA_FAILURE_VERSION_REJECTED
      const wasPairing = pairingState.suppressAutoRestart()
      // Mede a estabilidade desta sessão (quanto tempo ficou em 'open') ANTES de
      // limpar o marcador. Um `open` longo = sessão saudável que caiu; curto = flap.
      const now = Date.now()
      const wasStable = shouldResetBackoff(connectionOpenedAt, now, RECONNECT_STABLE_MS)
      // Uma vez estável, sempre "já estável": marca que esta credencial produziu
      // ao menos uma conexão saudável na vida deste worker (persiste entre
      // reconexões). Base da política keepEstablishedAuth em badSession.
      if (wasStable) {
        everHadStableOpen = true
        // Queda de sessão ESTÁVEL sem nada ter sido aceito desde a última vez é
        // a segunda evidência de cegueira (a conta do RCA caiu 29× em 24h, todas
        // com `hadStableOpen`, sem aceitar uma única mensagem no meio).
        stableDropsSinceLastAccepted += 1
      }
      // Node bruto do stream:error (quando existir) — só ele revela se o close
      // foi causado por uma mensagem específica travada em loop de reentrega
      // (ver AGENTS.md "Loop de retry-receipt travado"). `code` sozinho não
      // distingue isso de qualquer outro close genérico.
      const stuckMsgId = extractAckMessageIdFromStreamErrorNode(lastDisconnect?.error?.data)
      if (stuckMsgId) {
        const stuckResult = registerStuckMessageAndDecide(stuckMessageTimestamps, stuckMsgId, now, {
          windowMs: STUCK_MSG_WINDOW_MS,
          threshold: STUCK_MSG_THRESHOLD,
        })
        stuckMessageTimestamps = stuckResult.state
        if (stuckResult.stuck) {
          const newlyQuarantined = msgRetryCounterCache.quarantine(stuckMsgId)
          logger.error(
            { msgId: stuckMsgId, count: stuckResult.count, windowMs: STUCK_MSG_WINDOW_MS, quarantined: true, newlyQuarantined },
            'Mensagem travada em loop de retry-receipt colocada em quarentena durável; a próxima conexão não pedirá novo retry'
          )
          try { recordOperationalSignal('wa_stuck_message_retry', { userId, msgId: stuckMsgId, count: stuckResult.count }) } catch {}
        }
      }
      connectionOpenedAt = null
      activeSock = null
      pendingSock = null
      // Só marca o início do episódio de queda na 1ª vez (não reseta a cada
      // retry) — é o que dá ao heartbeat a duração REAL do loop de reconexão,
      // mesmo que cada tentativa individual pareça "nova".
      if (disconnectedSinceMs == null) disconnectedSinceMs = now
      if (sendIpc) sendIpc({ type: 'status', data: 'disconnected' })
      await persistSessionPatch(buildCloseSessionPatch({
        code,
        terminal: isLoggedOut,
        ownerInstance: OWNER_INSTANCE,
        now: new Date(),
      })).catch(() => {})
      recordWaConnectionEventSafe({
        userId,
        type: isLoggedOut ? 'disconnect_terminal' : 'disconnect',
        code,
        lifecycle: isLoggedOut ? 'disconnected' : 'reconnecting',
        ownerInstance: OWNER_INSTANCE,
        metadata: {
          wasStable,
          restartRequired: isRestartRequired,
          connectionReplaced: isConnectionReplaced,
          forbidden: isForbidden,
          badSession: isBadSession,
          pairing: wasPairing,
          stuckMsg: Boolean(stuckMsgId),
          versionRejected: isVersionRejected,
        },
      })
      if (isVersionRejected) {
        // `error.data` carrega os atributos crus do nó de failure — a única
        // fonte do motivo real. Antes deste fix ele era descartado e o
        // incidente aparecia no log como um `code: 405` mudo, indistinguível
        // de queda de rede.
        logger.error(
          {
            code,
            failure: lastDisconnect?.error?.data,
            waVersion: Array.isArray(cachedBaileysVersion) ? cachedBaileysVersion.join('.') : null,
            userId,
          },
          'WhatsApp RECUSOU a conexão (failure 405) — quase sempre é a versão do WA Web anunciada no handshake sendo rejeitada pelo servidor, e atinge TODAS as sessões ao mesmo tempo. Fixe uma versão válida em WA_WEB_VERSION e reinicie. Ver AGENTS.md "405".'
        )
        try {
          recordOperationalSignal('wa_version_rejected', {
            userId,
            code,
            waVersion: Array.isArray(cachedBaileysVersion) ? cachedBaileysVersion.join('.') : null,
          })
        } catch {}
      }
      if (isForbidden) {
        // 403/forbidden: o WhatsApp recusou a sessão — chip possivelmente
        // restringido/banido (costuma vir após flapping prolongado). Sinal
        // durável por chip para vigiar e agir antes do ban definitivo. Só
        // observabilidade: NÃO altera o fluxo de reconexão abaixo.
        logger.error({ code, userId }, 'WA recusou a sessão (403/forbidden) — chip sob risco de restrição/ban')
        recordWaConnectionEventSafe({ userId, type: 'forbidden', code, lifecycle: 'disconnected', ownerInstance: OWNER_INSTANCE })
        try { recordOperationalSignal('wa_forbidden', { userId, code }) } catch {}
      }
      if (isLoggedOut) {
        // Sessão revogada/expirada — limpar auth para que próximo start gere QR limpo.
        // O backup de pareamento vai junto: credencial revogada não pode ser
        // devolvida ao lugar por `recoverOrphan` no próximo boot.
        await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {})
        await rm(pairingAuthBackup.backupDir, { recursive: true, force: true }).catch(() => {})
        logger.info('Sessão encerrada pelo servidor WA — auth_info limpo automaticamente')
      } else if (wasPairing && isRestartRequired) {
        // Pairing aceito pelo WA: o servidor manda close com code 515 esperando
        // que a gente reconecte com as novas creds salvas via saveCreds. Esse é
        // o caminho FELIZ do pairing — limpa o estado e dispara startBot pra
        // completar o handshake pós-pairing e chegar em connection: 'open'.
        logger.info({ code }, 'Pairing aceito pelo WA (restartRequired 515) — reiniciando com creds novas')
        pairingState.clear()
        // Pareamento aceito: a credencial nova é a boa, a antiga não serve mais.
        await pairingAuthBackup.discard()
        scheduleReconnect(500, { code, reason: 'pairing_restart_required' })
      } else if (wasPairing) {
        // Diferencia dois sub-casos:
        //   a) código ainda não chegou ao usuário (pairingState.code == null):
        //      NÃO reiniciar — o socket WA fechou antes do usuário receber o
        //      código. A UI detecta o erro e exige nova tentativa.
        //   b) código já foi entregue ao usuário (pairingState.code != null):
        //      o usuário já digitou (ou está digitando) no app e WA enviou um
        //      close não-515 (falha de rede, erro de servidor, etc.). As creds
        //      provavelmente já foram salvas via creds.update antes do close.
        //      Reiniciar com backoff é a resposta certa — sem isso o celular
        //      fica travado em "Conectando..." para sempre.
        const codeAlreadyDelivered = Boolean(pairingState.snapshot().code)
        if (codeAlreadyDelivered) {
          logger.warn({ code }, 'WA close não-515 após código entregue ao usuário — reiniciando para completar handshake de pairing')
          pairingState.clear()
          const delayMs = calcReconnectDelayMs()
          reconnectAttempts++
          scheduleReconnect(delayMs, { code, reason: 'pairing_after_code' })
        } else {
          // Código ainda não foi mostrado: o pareamento não chegou a acontecer.
          // Devolve a credencial anterior (se havia) e volta a reconectar
          // sozinho com ela — antes deste fix a sessão ficava sem credencial E
          // sem reconexão, travada até intervenção manual (RCA 2026-07-28).
          const restored = await pairingAuthBackup.restore()
          if (restored) {
            const delayMs = calcReconnectDelayMs()
            reconnectAttempts++
            logger.warn({ code, delayMs }, 'WA close durante pairing pré-código — credencial anterior restaurada, retomando reconexão automática')
            scheduleReconnect(delayMs, { code, reason: 'pairing_failed_auth_restored' })
          } else {
            // Sem credencial anterior (primeiro pareamento): não há o que
            // reconectar. A UI detecta o erro e pede nova tentativa.
            logger.warn({ code }, 'WA close durante pairing pré-código (não-515) — sem credencial anterior, não reiniciando automaticamente')
          }
        }
      } else if (isConnectionReplaced) {
        // Outro socket assumiu a MESMA credencial (worker duplicado /
        // double-possession — vide AGENTS.md "WhatsApp caindo toda hora").
        // Reconectar em 5s só nos faz substituir o outro socket de volta: cada
        // ciclo dispara um `open` novo e a notificação "sincronização concluída"
        // no celular — spam a cada poucos segundos. Em vez disso usamos um
        // cooldown LONGO (não some, mas recupera sozinho se o duplicado morrer)
        // e, em surto, escalamos o log + sinal operacional para diagnóstico.
        const r = registerReplacedAndDecide(replacedTimestamps, now, {
          windowMs: RECONNECT_REPLACED_WINDOW_MS,
          giveUpThreshold: RECONNECT_REPLACED_GIVEUP_THRESHOLD,
        })
        replacedTimestamps = r.timestamps
        // `open` curto não zera reconnectAttempts a nosso favor aqui; usamos um
        // delay fixo longo, independente do backoff de closes genéricos.
        const delayMs = RECONNECT_REPLACED_DELAY_MS
        if (r.escalate) {
          logger.error(
            { code, replacedCount: r.count, windowMs: RECONNECT_REPLACED_WINDOW_MS, delayMs },
            'Sessão WA substituída repetidamente por outro socket na mesma credencial — provável worker duplicado/double-possession. Verifique BOT_SUPERVISOR_MODE e workers órfãos. Reconectando com cooldown longo.'
          )
          try { recordOperationalSignal('wa_connection_replaced', { userId, replacedCount: r.count }) } catch {}
        } else {
          logger.warn({ code, replacedCount: r.count, delayMs }, 'WA conexão substituída (replaced/440) — cooldown longo para evitar ping-pong')
        }
        recordWaConnectionEventSafe({ userId, type: 'replaced', code, lifecycle: 'reconnecting', ownerInstance: OWNER_INSTANCE, metadata: { replacedCount: r.count, escalated: r.escalate } })
        scheduleReconnect(delayMs, { code, reason: 'connection_replaced' })
      } else {
        // Close genérico (500 badSession, 428, 408, 515 fora de pairing, ...).
        // Dois males históricos tratados aqui:
        //
        // (a) badSession (500) com credencial Signal corrompida: reconectar com
        //     a MESMA cred dá 500 de novo, eterno. Se o 500 repete E a sessão não
        //     fica estável (nunca recupera), limpamos o auth → próximo start gera
        //     QR limpo (re-pareamento), igual ao loggedOut. A guarda `wasStable`
        //     evita apagar a cred de um chip que cai e SE recupera (500 transitório).
        //
        // (b) flapping: antes, um `open` curto zerava reconnectAttempts (no
        //     handler de 'open'), então o backoff nunca escalava e um chip caindo
        //     a cada poucos minutos reanunciava 'open' → spam de "A sincronização
        //     foi concluída". Agora o reset do backoff é gated por estabilidade
        //     (wasStable) e, se detectamos flap (muitos closes na janela),
        //     aplicamos um cooldown curto em vez do backoff imediato.
        // Um 500 que carrega stuckMsgId é o fallback do Baileys para uma mensagem
        // travada (RCA "Loop de retry-receipt travado"), NÃO corrupção de
        // credencial — nem sequer entra na contagem de badSession para não
        // envenenar o tally e acabar apagando auth de uma sessão viva.
        if (isBadSession && RECONNECT_BADSESSION_RESET_THRESHOLD > 0 && !stuckMsgId) {
          const b = registerBadSessionAndDecide(badSessionTimestamps, now, {
            windowMs: RECONNECT_BADSESSION_WINDOW_MS,
            resetThreshold: RECONNECT_BADSESSION_RESET_THRESHOLD,
            hadStableOpen: wasStable,
          })
          badSessionTimestamps = b.timestamps
          const shouldResetAuth = shouldResetAuthForBadSession({
            count: b.count,
            resetThreshold: RECONNECT_BADSESSION_RESET_THRESHOLD,
            hadStableOpen: wasStable,
            everHadStableOpen,
            stuckMsgId,
            keepEstablishedAuth: RECONNECT_BADSESSION_KEEP_ESTABLISHED_AUTH,
          })
          if (shouldResetAuth) {
            logger.error(
              { code, badSessionCount: b.count, userId },
              'badSession (500) repetido sem conexão estável — credencial Signal corrompida. Limpando auth_info para re-pareamento (QR limpo no próximo start). Sessão fica offline até novo pareamento.'
            )
            try { recordOperationalSignal('wa_bad_session_reset', { userId, count: b.count }) } catch {}
            recordWaConnectionEventSafe({ userId, type: 'auth_reset', code, lifecycle: 'auth_reset_required', ownerInstance: OWNER_INSTANCE, metadata: { badSessionCount: b.count } })
            await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {})
            // Backup junto: a credencial guardada é da MESMA sessão corrompida.
            await rm(pairingAuthBackup.backupDir, { recursive: true, force: true }).catch(() => {})
            await persistSessionPatch(buildAuthResetSessionPatch({ code, ownerInstance: OWNER_INSTANCE, now: new Date() })).catch(() => {})
            badSessionTimestamps = []
            reconnectAttempts = 0
            // NÃO reconecta sozinho (igual loggedOut): sem auth, reconectar só
            // geraria erro. O usuário re-pareia pelo painel.
            return
          }
        }

        // Só zera o backoff se a sessão que caiu foi estável; senão deixa escalar.
        if (wasStable) reconnectAttempts = 0

        const f = registerCloseAndDecide(closeTimestamps, now, {
          windowMs: RECONNECT_FLAP_WINDOW_MS,
          flapThreshold: RECONNECT_FLAP_THRESHOLD,
        })
        closeTimestamps = f.timestamps

        let delayMs
        if (f.flapping) {
          delayMs = RECONNECT_FLAP_COOLDOWN_MS
          logger.warn(
            { code, closeCount: f.count, windowMs: RECONNECT_FLAP_WINDOW_MS, delayMs },
            'Flapping detectado (closes repetidos na janela) — cooldown curto para conter o spam de "sincronização concluída" sem sacrificar disponibilidade. Recupera sozinho quando o chip estabilizar.'
          )
          try { recordOperationalSignal('wa_flap_cooldown', { userId, code, count: f.count }) } catch {}
          recordWaConnectionEventSafe({ userId, type: 'flap_cooldown', code, lifecycle: 'reconnecting', ownerInstance: OWNER_INSTANCE, metadata: { closeCount: f.count, delayMs } })
        } else if (shouldConsiderStableCloseCooldown({
          hadStableOpen: wasStable,
          code,
          stuckMsgId,
          eligibleCodes: [DisconnectReason.badSession, DisconnectReason.connectionClosed, DisconnectReason.timedOut],
        })) {
          const s = registerStableCloseAndDecide(stableCloseTimestamps, now, {
            windowMs: RECONNECT_STABLE_CLOSE_WINDOW_MS,
            cooldownThreshold: RECONNECT_STABLE_CLOSE_THRESHOLD,
            hadStableOpen: wasStable,
          })
          stableCloseTimestamps = s.timestamps
          if (s.shouldCooldown) {
            delayMs = RECONNECT_STABLE_CLOSE_COOLDOWN_MS
            logger.warn(
              { code, stableCloseCount: s.count, windowMs: RECONNECT_STABLE_CLOSE_WINDOW_MS, delayMs },
              'Quedas periódicas de sessão WA estável detectadas — cooldown curto para reduzir re-sync/push notification sem sacrificar disponibilidade.'
            )
            try { recordOperationalSignal('wa_stable_close_cooldown', { userId, code, count: s.count }) } catch {}
            recordWaConnectionEventSafe({ userId, type: 'stable_close_cooldown', code, lifecycle: 'reconnecting', ownerInstance: OWNER_INSTANCE, metadata: { stableCloseCount: s.count, delayMs } })
          } else {
            delayMs = calcReconnectDelayMs()
            reconnectAttempts++
            logger.warn({ code, attempt: reconnectAttempts, delayMs, stableCloseCount: s.count }, 'WA conexão estável fechada, agendando restart automático')
          }
        } else {
          delayMs = calcReconnectDelayMs()
          reconnectAttempts++
          logger.warn({ code, attempt: reconnectAttempts, delayMs, stuckMsgId: stuckMsgId || undefined }, 'WA conexão fechada, agendando restart automático')
        }
        // Teto de tentativas sem sucesso (RCA 2026-08-28). Só vale para o close
        // genérico: pareamento e `replaced` têm caminhos próprios. Conexão que
        // abre zera o contador, então a frota saudável nunca chega aqui.
        consecutiveFailedReconnects++
        const ritmo = decideRetryPace({
          consecutiveFailures: consecutiveFailedReconnects,
          everConnected: everOpened,
          baseDelayMs: delayMs,
          giveupAttempts: RETRY_GIVEUP_ATTEMPTS,
          slowIntervalMs: RETRY_SLOW_INTERVAL_MS,
          neverConnectedMax: RETRY_NEVER_CONNECTED_MAX,
        })
        if (ritmo.action === RETRY_ACTION.STOP) {
          // Nunca abriu nenhuma vez: sem credencial válida o WhatsApp não vai
          // aceitar, e insistir é só exposição (reconexão repetida é o padrão
          // associado a chip restringido). Quem resolve é a cliente lendo o QR.
          logger.error(
            { code, tentativas: consecutiveFailedReconnects, motivo: ritmo.reason },
            'Sessão nunca conectou e esgotou as tentativas — parando de tentar. Só volta com um novo pareamento (QR) pela cliente.'
          )
          try { recordOperationalSignal('wa_retry_giveup', { userId, code, tentativas: consecutiveFailedReconnects }) } catch {}
          recordWaConnectionEventSafe({ userId, type: 'retry_giveup', code, lifecycle: 'disconnected', ownerInstance: OWNER_INSTANCE, metadata: { tentativas: consecutiveFailedReconnects } })
          await persistSessionPatch({ status: 'disconnected', lifecycle: 'disconnected' }).catch(() => {})
          return
        }
        if (ritmo.action === RETRY_ACTION.SLOW && ritmo.delayMs > delayMs) {
          logger.warn(
            { code, tentativas: consecutiveFailedReconnects, delayMs: ritmo.delayMs },
            'Muitas tentativas seguidas sem conectar — desacelerando a reconexão (continua tentando sozinho, só mais espaçado)'
          )
          try { recordOperationalSignal('wa_retry_slowed', { userId, code, tentativas: consecutiveFailedReconnects }) } catch {}
          delayMs = ritmo.delayMs
        }
        scheduleReconnect(delayMs, { code, reason: f.flapping ? 'flap_cooldown' : wasStable ? 'stable_close' : 'close' })
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
      logger.info({ jid, monitorGroups: cfg.groups.monitor }, 'mensagem recebida')
      const monitorGroup = cfg.groups.monitor.find(m => normalizeJidForMatch(m.waJid) === normalizedJid)
      const shouldTrackSkipped = Boolean(monitorGroup)
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

      // Quando uma URL já enviada é vista de novo dentro da janela, em vez de
      // criar mais uma linha 'skip:dedup_recent_link' (gerando N rows iguais
      // que poluem o painel), incrementamos um contador na linha existente
      // mais recente do mesmo (userId, destJid, convertedUrl). Janela de busca
      // = dedupWindowMs (linkDedupWindowMs por padrão; cupom passa
      // couponDedupWindowMs — ver chamadas no loop de destinos). Se não houver
      // linha recente (estado dessincronizado após restart, por exemplo), cria
      // uma nova como fallback para não perder visibilidade do evento.
      async function registerDedupBlock({ reason, platform, destJid, originalUrl: incomingUrl, convertedUrl: outgoingUrl, messageText, dedupWindowMs = linkDedupWindowMs, ageMs = null }) {
        if (!shouldTrackSkipped) return
        // Diagnóstico (RCA de cupom preso em dedup, 3ª rodada de reports):
        // grava HÁ QUANTO TEMPO o bloqueio anterior aconteceu, direto no
        // errorMsg (prefixo skip:dedup* preservado — categorizeErrorMsg
        // continua batendo por startsWith). Sem isso, tanto o painel quanto
        // o log só diziam "bloqueado", sem dar pra confirmar se o bloqueio
        // estava mesmo dentro da janela configurada ou se era outro bug —
        // cada report virava suposição nova em vez de diagnóstico conclusivo.
        const ageSuffix = Number.isFinite(ageMs) ? `:age=${Math.round(ageMs / 1000)}s:window=${Math.round(dedupWindowMs / 1000)}s` : ''
        const reasonWithAge = `${reason}${ageSuffix}`
        const since = new Date(Date.now() - dedupWindowMs)
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
            errorMsg: reasonWithAge,
            dedupHits: 0,
          },
        }).catch(() => {})
      }

      if (!monitorGroup) {
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

      const { text: textoParaEspelhar, failures: falhasDeDominioProprio } =
        await unwrapCustomDomainOfferLinks(text, { userId, jid, msgId: msg.key.id })
      const sanitizedText = textoParaEspelhar ? sanitizeInviteLinks(textoParaEspelhar) : ''
      if (text && !sanitizedText) {
        logMonitoredSourceDrop(jid, 'texto_virou_vazio', { msgId: msg.key.id, textLength: text.length })
        return
      }

      const isCouponMsg = isCouponAnnouncement(sanitizedText)

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
        // Mensagens sem conteúdo de usuário (protocolMessage, senderKey
        // distribution, reações, poll updates, etc.) chegam como kind 'other'
        // sem texto e sem link — NÃO são ofertas que o usuário esperava espelhar
        // e não devem virar linha "ignorado" no painel. Ignorar em silêncio.
        // Sem isso, um reconnect (que dispara rajada de senderKeyDistribution)
        // polui o log com dezenas de 'nolink' mesmo o grupo não tendo recebido
        // nenhuma mensagem real (incidente 2026-06).
        if (messageKind === 'other' && links.length === 0 && !hasGenericUrl) {
          // `contentKeys` é o campo que separa as três causas possíveis, todas
          // indistinguíveis para a cliente ("não apareceu nada"):
          //   - vazio            → a mensagem não pôde ser DECIFRADA (sessão
          //                        Signal dessincronizada). O robô recebeu o
          //                        envelope e não o conteúdo.
          //   - protocolMessage/senderKeyDistributionMessage/reactionMessage
          //                      → ruído de protocolo, descarte correto.
          //   - conversation/extendedTextMessage/imageMessage
          //                      → havia conteúdo de verdade e a extração de
          //                        texto falhou: aí é bug nosso.
          logMonitoredSourceDrop(jid, 'sem_link_e_sem_texto', {
            msgId: msg.key.id,
            messageKind,
            textLength: sanitizedText.length,
            hasMessageContent: Boolean(msg.message),
            contentKeys: Object.keys(innerMessage || msg.message || {}),
          })
          return
        }
        // `hasGenericUrl` lê o texto JÁ SANITIZADO, e o sanitizador REMOVE toda
        // URL que não é de loja suportada. Ou seja: exatamente a mensagem que
        // deveria ganhar o sufixo — a que só trazia link de loja desconhecida ou
        // do site próprio do grupo de origem — chegava aqui sem URL nenhuma,
        // ficava sem sufixo e a cliente lia "fora das regras de encaminhamento
        // que VOCÊ configurou". Isso culpa a configuração dela por um problema
        // que é de cobertura de loja, e manda mexer no lugar errado (foi o que
        // aconteceu em 13/09/2026). O texto de ANTES do sanitizador é quem sabe
        // a verdade; `findCandidateLinks` é a mesma regra do desembrulho de
        // domínio próprio (ignora convite de grupo e rede social), então as duas
        // pontas nunca discordam sobre o que é "link de loja desconhecida".
        const hadUnsupportedStoreUrl = findCandidateLinks(textoParaEspelhar).length > 0
        // "A oferta acabou" e "não apoiamos essa loja" são causas DIFERENTES com
        // ações opostas, e até 19/09/2026 as duas saíam com a mesma frase — a
        // cliente lia que a Amazon não é convertida, o que é falso. Quando TODOS
        // os links do site de origem caíram na página de promoção encerrada, o
        // painel passa a dizer isso.
        const ofertaEncerradaNaOrigem = allCandidatesFailedBecauseOfferEnded(falhasDeDominioProprio)
        const unsupportedStoreSuffix =
          links.length === 0 && ofertaEncerradaNaOrigem
            ? ':offer_ended_at_source'
            : links.length === 0 && (hasGenericUrl || hadUnsupportedStoreUrl)
              ? ':unsupported_store'
              : ''
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

        // 3) Link preview HQ hospedado pelo próprio WhatsApp. O proto traz um
        // placeholder inline minúsculo E, quando o remetente gerou preview HQ,
        // thumbnailDirectPath/mediaKey. Baixar a segunda evita publicar os
        // 545–1999 bytes medidos nas ofertas Magalu como se fossem a foto.
        const hqLinkPreview = await downloadHighQualityLinkPreview({
          message: msg,
          extendedTextMessage: ext,
          downloadMediaMessage,
          logger,
          reuploadRequest: sock.updateMediaMessage,
        })
        if (hqLinkPreview) {
          logger.info({ msgId: msg.key.id, size: hqLinkPreview.length, source: 'linkPreviewHq' }, 'Imagem original baixada')
          return { buffer: hqLinkPreview, mimetype: 'image/jpeg' }
        }

        // 4) Último recurso: jpegThumbnail embutido. Baixa qualidade, mas não
        // exige rede — os bytes já vêm decifrados.
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
      // configuração de imagem recebida do destino.
      // Estratégia de imagem para mensagens de cupom. Atribuído UMA vez logo após
      // o guard de title_mismatch (que já raspa o og:title do produto), e lido
      // por getImage() no dequeue. Default false = ofertas normais sempre buscam
      // hi-res. Ver decideSkipActiveFetchForCoupon() para a lógica completa.
      let couponSkipActiveFetch = false
      // Trocar a foto da MENSAGEM DE ORIGEM pela foto oficial da loja quando o
      // link aponta para um produto identificado. Atribuído junto com
      // couponSkipActiveFetch (depois do guard de title_mismatch, que é quem
      // calcula o titleOverlap) e lido por getImage() no dequeue. Sem isso, a
      // origem que anexa foto própria republica a marca d'água do concorrente
      // — RCA 2026-08-27, ver core/storePhotoPreference.js.
      let preferStorePhoto = false

      // Eleição canônica do link principal entre múltiplas URLs da mesma
      // mensagem. A mesma escolha precisa governar:
      //   1) imagem/dados principais da oferta espelhada;
      //   2) link usado pelo template de um produto só;
      //   3) dedup/logs abaixo.
      // Antes getImage() lia `imageLinkTarget` (campo legado sem UI atual),
      // então selecionar "Último link" em primaryLinkTarget ainda buscava a
      // imagem do primeiro link.
      const effectiveLinkTarget = monitorGroup?.primaryLinkTarget
        || cfg.botConfig?.primaryLinkTargetDefault
        || 'first'

      // `forceOriginalForChannelButton`: o botão nativo "Ver canal"
      // (contextInfo.forwardedNewsletterMessageInfo, injetado por
      // injectChannelForwardIntoPayload em src/core/channelSend.js) só é aceito
      // pelo WhatsApp em corpos de MÍDIA (image/video) — texto puro com o botão
      // é derrubado silenciosamente. Quando o destino usa 'preview' e também
      // tem `channelForward` configurado (Group.channelButtonJid), buscamos a
      // imagem mesmo assim — reaproveita o MESMO caminho (resolveMonitoredImage,
      // mode 'original') que já é usado pelas ofertas comuns, só que escopado ao
      // destino que pediu o botão.
      // Memo da foto da mensagem de origem, no mesmo espírito do cache de
      // getImage() logo abaixo: `buildPayload` roda UMA VEZ POR DESTINO, então
      // sem isso uma mensagem espelhada para N grupos baixaria e decifraria a
      // MESMA mídia N vezes. `downloadOriginalImage` é a parte cara do caminho
      // (download + decrypt via Baileys).
      let originPhotoFetched = false
      let cachedOriginPhoto = null
      async function getOriginalPhotoOnce() {
        if (originPhotoFetched) return cachedOriginPhoto
        originPhotoFetched = true
        cachedOriginPhoto = await downloadOriginalImage()
        return cachedOriginPhoto
      }

      // 2026-08-28: o modo de imagem passou a ser escolhido POR DESTINO (antes
      // era único por mensagem, herdado do grupo monitorado). A mesma oferta
      // pode pedir 'original' num destino e 'preview' noutro — por isso o cache
      // não pode mais ser uma única variável (`imageFetched`/`cachedImage`):
      // isso foi a causa suspeita da divergência de 22/08 ("painel mostrava um
      // formato, o grupo recebia outro"), quando a escolha por grupo existiu
      // por um dia. `cachedImages` é um Map chaveado pelo MODO-BASE efetivo
      // ('original'/'preview'), então dois destinos que pedem o mesmo modo-base
      // reaproveitam o fetch (mantém a economia de rede/CPU original), e dois
      // destinos com modos-base diferentes resolvem e cacheiam
      // independentemente — nunca um pisa no resultado do outro. Ver
      // test/destination-watermark-worker.test.js.
      const cachedImages = new Map()
      async function getImage({ forceOriginalForChannelButton = false, imageMode = 'original' } = {}) {
        const baseMode = destinationImageBaseMode(imageMode)
        const effectiveMode = forceOriginalForChannelButton && baseMode === 'preview' ? 'original' : baseMode
        if (cachedImages.has(effectiveMode)) return cachedImages.get(effectiveMode)
        const skipFetch = !forceOriginalForChannelButton && baseMode === 'preview'
        if (skipFetch) return null

        const enabled = links.filter(l => enabledPlatforms.has(l.platform))
        const target = effectiveLinkTarget === 'last' ? enabled[enabled.length - 1] : enabled[0]
        const platform = target?.platform || 'unknown'
        logger.info({ msgId: msg.key.id, imageMode: effectiveMode, linkTarget: effectiveLinkTarget, platform, couponSkipActiveFetch, forceOriginalForChannelButton }, 'getImage: iniciando resolução de imagem')

        // skipActiveFetch NÃO depende mais de "é cupom?" (isso borrava ofertas
        // de produto com código de cupom — regressão image-upload-bug-fix). Só
        // pula o fetch ativo quando a mensagem é um cupom GENÉRICO cujo link
        // resolve para produto não relacionado (caso A em
        // decideSkipActiveFetchForCoupon). Produto+cupom busca hi-res normalmente.
        const resolved = await resolveMonitoredImage({
          mode: effectiveMode,
          target,
          credentials: cfg.credentials,
          downloadOriginalImage,
          fetchProductImage,
          fetchImageBuffer,
          fallbackToOriginal: monitorGroup.fallbackToOriginal !== false,
          skipActiveFetch: couponSkipActiveFetch,
          preferStorePhoto,
          onStorePhotoPreferred: info => {
            try { recordOperationalSignal('store_photo_over_origin', { userId, msgId: msg.key.id, ...info }) } catch {}
          },
          logger,
          // Miniatura pequena demais para publicar: a oferta sai SEM imagem
          // (card de link do WhatsApp) em vez de com borrão. Sinal durável para
          // medir quanto isso acontece por loja — ver thumbnailQualityPolicy.js.
          onThumbnailDropped: info => {
            try { recordOperationalSignal('monitored_thumbnail_dropped', { userId, msgId: msg.key.id, ...info }) } catch {}
          },
        })
        cachedImages.set(effectiveMode, resolved)
        return resolved
      }


      // `errorMsg`/`status` (opcionais): permitem que o converter pré-classifique
      // o motivo (ex.: `skip:ml_vitrine_missing`/`skipped` — feature
      // 007-ml-vitrine-fallback-expired), em vez de sempre cair no genérico
      // `error:conversion:${reason}`/`error`. Sem eles, comportamento inalterado.
      async function recordConversionIssue({ platform, url, jid, text, reason, errorMsg, status }) {
        logger.warn({ platform, url, reason, errorMsg, status }, 'Conversão ignorada com diagnóstico para o painel')
        await db.messageLog.create({
          data: {
            userId,
            platform,
            sourceGroup: jid,
            destGroup: 'conversion',
            originalUrl: url,
            convertedUrl: '',
            messageText: sanitizeMessageForLog(text),
            status: status || 'error',
            errorMsg: errorMsg || `error:conversion:${reason}`,
          },
        }).catch(err => {
          logger.warn({ err: err.message, platform }, 'Falha ao gravar diagnóstico de conversão')
        })
        trackAnalyticsEventSafe({ userId, event: 'send_error', metadata: { platform, errorType: 'conversion_diagnostic' } })
      }

      // Converter os links habilitados: LOJAS DIFERENTES em paralelo, links da
      // MESMA loja um de cada vez. Conversores fazem 4-5 chamadas HTTP
      // sequenciais cada (resolve short → API afiliado → validate), então
      // serializar tudo estouraria o teto da fila; mas dentro de uma loja os
      // conversores dividem UMA sessão de afiliado (cookie do SiteStripe e
      // `ssid` do ML são ROTACIONADOS a cada chamada), e disparar juntos só
      // troca espera por falha. Ver o porquê medido em
      // core/conversionScheduler.js — não voltar a `Promise.all` sobre a lista
      // inteira. Ordem é preservada porque a substituição no texto casa por URL
      // original, não por índice em conversions[].
      const linkResults = await convertPerPlatformSerially(links, async ({ platform, url }) => {
        if (!enabledPlatforms.has(platform)) {
          logger.info({ platform }, 'Plataforma desabilitada — pulando')
          // Devolve o MOTIVO em vez de null: sem `converted` o item continua
          // fora de `conversions`, mas a mensagem deixa de ser gravada como
          // "faltou cadastrar a loja" quando o cadastro está perfeito e a loja
          // só está desligada NESTE grupo (RCA 2026-09-09). Sem cadastro da
          // loja, é escolha da cliente não usá-la — não dizer que o cadastro
          // "está certo" (RCA 2026-09-24).
          const registered = validateCredentialData(platform, cfg.credentials[platform]).configured
          return { platform, url, failureReason: registered ? CONVERSION_FAILURE.STORE_DISABLED : CONVERSION_FAILURE.STORE_NOT_USED }
        }
        logger.info({ platform, url }, 'Link detectado')
        const credentialValidation = validateCredentialData(platform, cfg.credentials[platform])
        if (!credentialValidation.configured) {
          const issue = buildConversionIssue({ platform, credentialValidation })
          await recordConversionIssue({
            platform,
            url,
            jid,
            text,
            reason: issue.reason,
          })
          return { platform, url, failureReason: CONVERSION_FAILURE.MISSING_CREDENTIAL }
        }

        try {
          const conversionResult = await convertLink(platform, url, cfg.credentials)
          if (!conversionResult) {
            await recordConversionIssue({ platform, url, jid, text, reason: `Conversor de ${credentialValidation.label} não retornou link convertido. Confira se as credenciais estão válidas.` })
            return { platform, url, failureReason: CONVERSION_FAILURE.CONVERSION_FAILED }
          }
          logger.info({ platform, converted: conversionResult.url, warning: conversionResult.warning }, 'Link convertido')
          // amazon.js/mercadolivre.js/shopee.js já marcam linkKind no próprio
          // converter; resolveLinkKind só cai no fallback por regex quando o
          // converter não decidiu (ver converters/linkKind.js).
          const linkKind = resolveLinkKind(platform, { url, converted: conversionResult.url, linkKind: conversionResult.linkKind })
          return { platform, url, converted: conversionResult.url, warning: conversionResult.warning, linkKind }
        } catch (err) {
          if (err.stripFromMessage) {
            // Link que não virou link da cliente (cupom da Shopee recusado,
            // qualquer falha do AliExpress). NUNCA publicar o original: é o link
            // do concorrente. A mensagem inteira deixa de sair — ver
            // core/mirrorLinkGuard.js (RCA 2026-09-23, 794 envios vazados).
            logger.warn({ platform, url, err: err.message }, 'Link não convertido — oferta não será publicada com o link de origem')
            return { platform, url, failureReason: CONVERSION_FAILURE.CONVERSION_FAILED }
          }
          // Motivo pré-classificado pelo converter (feature
          // 007-ml-vitrine-fallback-expired: skip:ml_vitrine_missing) tem
          // prioridade sobre o genérico error:conversion:* — o converter já
          // sabe que é um bloqueio de configuração acionável, não uma falha
          // real de conversão.
          if (err.conversionLogErrorMsg) {
            await recordConversionIssue({
              platform,
              url,
              jid,
              text,
              reason: err.message,
              errorMsg: err.conversionLogErrorMsg,
              status: err.conversionLogStatus,
            })
            return { platform, url, failureReason: CONVERSION_FAILURE.CONVERSION_FAILED }
          }
          const classifiedIssue = buildConversionIssue({ platform, credentialValidation, error: err })
          if (classifiedIssue?.kind === 'classified_conversion') {
            await recordConversionIssue({
              platform,
              url,
              jid,
              text,
              reason: classifiedIssue.reason,
              errorMsg: classifiedIssue.errorMsg,
            })
            return { platform, url, failureReason: CONVERSION_FAILURE.CONVERSION_FAILED }
          }
          await recordConversionIssue({ platform, url, jid, text, reason: `Falha na conversão de ${credentialValidation.label}: ${err.message}` })
          return { platform, url, failureReason: CONVERSION_FAILURE.CONVERSION_FAILED }
        }
      })
      const conversions = uniqueConversionsByUrl(linkResults.filter(r => r && r.converted))

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
            // 'info', NUNCA 'skipped': isto é uma notificação sobre um envio
            // que aconteceu com sucesso em paralelo/depois (ex.: vitrine
            // cadastrada usada, SSID expirado mas oferta saiu com fallback
            // partner_id) — 'skipped' fazia o painel exibir o badge
            // "Ignorado" contradizendo o envio real (RCA 2026-07-13,
            // specs/004-ml-vitrine-fallback/research.md).
            status: 'info',
            errorMsg: `warning:${kind}`,
          },
        }).catch(err => {
          logger.warn({ err: err.message, kind }, 'Falha ao gravar aviso de conversão')
        })
      }

      // Grava a oferta que NÃO saiu porque algum link de loja não virou link
      // da cliente. Mesmo formato de sempre (`skip:no_valid_conversions:<motivo>`)
      // para o painel e o aviso de cadastro contarem a mesma história.
      async function recordUnconvertedSkip({ platform, originalUrl, errorMsg }) {
        await db.messageLog.create({
          data: {
            userId,
            platform: platform || 'unknown',
            sourceGroup: jid,
            destGroup: 'skipped',
            originalUrl: originalUrl || '',
            convertedUrl: '',
            messageText: sanitizeMessageForLog(sanitizedText || ''),
            status: 'skipped',
            errorMsg,
          },
        }).catch(() => {})
      }

      let finalText = sanitizedText
      if (links.length) {
        // No espelhamento TODO link de loja precisa virar link da cliente. Um
        // só que falhe e a mensagem não sai: publicá-la manteria o link do
        // concorrente no texto (RCA 2026-09-23 — ver core/mirrorLinkGuard.js).
        const decision = decideMirrorConversions(linkResults)
        if (!decision.publish) {
          const firstFailed = linkResults.find(r => !(r && r.converted && !r.passthrough)) || linkResults[0]
          if (conversions.length) {
            logger.warn({ msgId: msg.key.id, links: links.length, failed: decision.failedCount }, 'Oferta não publicada: parte dos links não virou link da cliente')
          }
          await recordUnconvertedSkip({
            platform: firstFailed?.platform || links[0]?.platform,
            originalUrl: firstFailed?.url || links[0]?.url,
            errorMsg: decision.errorMsg,
          })
          return
        }
        // Relay mode ("Manter texto original convertido") deve apenas trocar
        // os links upstream pelos links convertidos do usuário. Variáveis globais
        // de /painel/mensagens, como {{grupoLink}} e {{cupomLink}}, pertencem ao
        // caminho de templates e não devem ser anexadas ao texto original.
        finalText = applyConversionsAndBranding(sanitizedText, conversions)
      }
      // Rede de segurança FINAL, antes do modelo e do texto adicional da
      // cliente (que são dela): nenhum link de loja pode sobrar no texto sem ser
      // um link convertido — inclusive o escrito sem `https://`, que o detector
      // não enxerga mas o WhatsApp torna clicável.
      const leakedLinks = findUnconvertedStoreLinks(finalText, conversions)
      if (leakedLinks.length) {
        logger.warn({ msgId: msg.key.id, leaked: leakedLinks.length }, 'Oferta não publicada: link de loja de origem ainda no texto')
        await recordUnconvertedSkip({
          platform: links[0]?.platform,
          originalUrl: leakedLinks[0],
          errorMsg: buildNoValidConversionsErrorMsg([CONVERSION_FAILURE.CONVERSION_FAILED]),
        })
        return
      }
      // Eleição do link primário (oferta/dedup/log) entre as conversões válidas.
      // Decisão de produto 3.4: o grupo escolhe primeiro/último link; sem override
      // por grupo, herda o default global do BotConfig (default 'first' = histórico).
      // A constante é definida antes de getImage() para manter texto/template,
      // imagem, dedup e logs alinhados na mesma escolha.
      const orderedConversions = conversions.filter(c => c && c.platform !== 'nolink' && !c.passthrough)
      // Produto+cupom: cupom pode ser sempre o mesmo entre ofertas diferentes.
      // Portanto ele NÃO deve virar primary de dedup/template/imagem quando há
      // link de produto convertido na mesma mensagem, mesmo que a config do grupo
      // escolha o último link. O cupom continua no finalText via conversions.
      const primaryCandidates = orderedConversions.filter(c => c.linkKind !== 'coupon')
      const selectableConversions = primaryCandidates.length ? primaryCandidates : orderedConversions
      const primary = (selectableConversions.length
        ? (effectiveLinkTarget === 'last' ? selectableConversions[selectableConversions.length - 1] : selectableConversions[0])
        : conversions[0]) ?? { platform: 'nolink', url: '', converted: '' }

      // Template efetivo (decisão 3.2: por grupo, com default global). Três estados
      // de monitorGroup.templateKey: null/undefined = herda o default global;
      // '' = relay explícito (não aplica template mesmo havendo default); 'chave'
      // = template fixo do grupo.
      const groupTemplateKey = monitorGroup?.templateKey
      const effectiveTemplateKey = (groupTemplateKey === null || groupTemplateKey === undefined)
        ? (cfg.botConfig?.mirrorTemplateKeyDefault || '')
        : groupTemplateKey

      // `templateApplied` indica que o caption foi REMONTADO a partir do título/
      // preço raspados (não é mais a caption do upstream). Nesse caso o guard de
      // mismatch abaixo é (a) redundante — já raspamos a página aqui — e (b)
      // sem sentido: ele compara a caption original do upstream, que não é mais
      // o que vai sair. Quando o template cai no relay (texto inalterado), o
      // guard volta a valer normalmente.
      let templateApplied = false
      // couponContext (specs/017-client-coupon-catalog): { platform, priceCents }
      // resolvido aqui mesmo (sem leitura extra de rede), carregado no job de
      // envio e consumido em processSendJob para resolver {cupom} no último
      // instante possível (FR-014).
      let couponContext = null
      // Só montamos o template quando há um link CONVERTIDO do nosso cliente.
      // No espelhamento os links de entrada são de OUTROS afiliados; a oferta
      // precisa sair com o link do nosso cliente (primary.converted) ou não
      // sair como oferta (cai no relay). NUNCA emitir primary.url (link do
      // terceiro) — isso daria comissão ao concorrente.
      if (effectiveTemplateKey && primary.converted) {
        const templateResult = await applyMirrorTemplate(finalText, {
          botConfig: cfg.botConfig,
          templateKey: effectiveTemplateKey,
          // originalUrl = link do upstream (terceiro): usado só como alvo de
          // leitura de título/preço (é a mesma página de produto).
          originalUrl: primary.url || links[0]?.url || '',
          // convertedUrl = link de afiliado do NOSSO cliente: o único que pode
          // ser emitido na oferta. Sem fallback para o link do terceiro.
          convertedUrl: primary.converted,
          platform: primary.platform,
          credentialsMap: cfg.credentials,
          logger,
        })
        const templatedText = templateResult.text
        if (templatedText !== finalText) {
          finalText = templatedText
          templateApplied = true
          couponContext = templateResult.couponContext
        }
      }
      // O complemento pertence exclusivamente ao formato "Manter texto
      // original convertido". Dois saltos separam claramente o texto vindo da
      // origem da assinatura opcional escrita pela cliente.
      if (!effectiveTemplateKey) {
        finalText = appendRelayFooter(finalText, monitorGroup?.relayFooterText)
      }
      const originalMedia = getOriginalMediaMessage()
      if (!finalText && !originalMedia) {
        logger.warn({ msgId: msg.key.id }, 'Mensagem vazia após processamento — envio ignorado')
        return
      }

      // Guard anti-mismatch: já apareceu em produção mensagem com caption
      // de "toalhas", link de "mochila" e foto de "jaqueta" (upstream
      // republicou uma oferta errada). Como nosso pipeline relaya a imagem
      // de cima e troca só o caption, herdamos esse desalinhamento. Raspar
      // og:title do link convertido e comparar com o caption pega o caso
      // sem confiar em nada do upstream. Skip silencioso quando o scrape
      // falha — não queremos derrubar oferta legítima por timeout.
      // O scrape do og:title alimenta DUAS decisões a partir de UMA raspagem:
      //   1. Guard de title_mismatch (bloqueia ofertas NÃO-cupom desalinhadas).
      //   2. Estratégia de imagem para cupom (couponSkipActiveFetch): distingue
      //      "produto + cupom" (busca hi-res) de "cupom genérico → produto
      //      aleatório" (usa thumbnail). Por isso o scrape agora roda TAMBÉM para
      //      mensagens de cupom — antes era pulado (!isCouponMsg), o que forçava
      //      o skip cego que borrava ofertas de produto com cupom.
      // titleOverlap: 'match' | 'mismatch' | 'unknown' (scrape falhou/indisponível).
      const hasProductLink = !!(primary.url && primary.platform !== 'nolink')
      let titleOverlap = 'unknown'
      if (
        !TITLE_MISMATCH_GUARD_DISABLED &&
        !templateApplied &&
        primary.url &&
        TITLE_MISMATCH_GUARD_PLATFORMS.has(primary.platform)
      ) {
        const scrapedTitle = await scrapeProductTitle(primary.url).catch(() => null)
        if (scrapedTitle) {
          titleOverlap = hasSignificantTokenOverlap(scrapedTitle, sanitizedText) ? 'match' : 'mismatch'
        }
        // Guard bloqueia só ofertas NÃO-cupom com mismatch confirmado. Mensagens
        // de cupom não descrevem um produto específico, então nunca são bloqueadas
        // aqui — mas o mesmo sinal de overlap decide a imagem (abaixo).
        //
        // isCouponMsg (texto) exige a palavra "cupom" + um código em CAIXA
        // ALTA (isCouponAnnouncement) — não pega cupom sem código visível na
        // legenda (ex.: "Cupom Mercado Livre" apontando pra página de cupons
        // do catálogo). Nesse caso o texto NÃO parece cupom, mas o LINK
        // também não é de produto — a raspagem do og:title da página de
        // cupons nunca vai bater com a legenda, e bloquear é falso positivo
        // (bug real: "Cupom mercado livre" pra /cupons foi bloqueado com
        // "Bloqueado por segurança"). primary.linkKind === 'coupon' cobre
        // esse caso via a URL (ver converters/linkKind.js), sem depender de
        // a legenda ter um código visível.
        if (!isCouponMsg && primary.linkKind !== 'coupon' && titleOverlap === 'mismatch') {
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

      // Decide a estratégia de imagem para cupom ANTES do loop de destinos
      // (vale para todos os destinos da mensagem). getImage() lê esta flag.
      // looksGeneric só decide o caso 'unknown' (scrape indisponível): caption
      // com cara de cupom store-wide → não buscar hi-res (evita puxar produto
      // aleatório, ex: camiseta branca). Não afeta 'match'/'mismatch'.
      const couponLooksGeneric = isCouponMsg && looksLikeGenericCoupon(sanitizedText)
      couponSkipActiveFetch = decideSkipActiveFetchForCoupon({
        isCouponMsg,
        hasProductLink,
        titleOverlap,
        looksGeneric: couponLooksGeneric,
      })
      if (isCouponMsg) {
        logger.info({ msgId: msg.key.id, hasProductLink, titleOverlap, looksGeneric: couponLooksGeneric, couponSkipActiveFetch }, 'estratégia de imagem para mensagem de cupom')
      }

      preferStorePhoto = shouldPreferStorePhoto({
        linkKind: primary.linkKind,
        titleOverlap,
        isCouponMsg,
        enabled: isStorePhotoPreferenceEnabled(),
      })

      // Para onde essa mensagem vai. A decisão inteira mora em
      // core/destinationRouting.js: origem com destinos escolhidos no painel
      // ('explicit') NUNCA cai no espelhamento para todos os destinos da conta,
      // mesmo que a lista tenha ficado vazia porque a cliente apagou os grupos
      // que havia escolhido (RCA 2026-08-26).
      const routing = resolveMonitorDestinations({
        targetsMode: monitorGroup?.targetsMode,
        targetPostJids: monitorGroup?.targetPostJids,
        allPostJids: cfg.groups.post,
      })
      const baseDestinations = routing.destinations
      if (routing.reason === DESTINATION_REASON.FALLBACK_ALL && baseDestinations.length) {
        logger.warn({ sourceJid: jid, destCount: baseDestinations.length }, 'Origem sem destino escolhido: espelhando para TODOS os destinos da conta')
        recordOperationalSignal('mirror_fallback_all_destinations', { userId, sourceJid: jid, destCount: baseDestinations.length })
      }
      if (routing.reason === DESTINATION_REASON.EXPLICIT_EMPTY) {
        logger.warn({ sourceJid: jid }, 'Origem com destinos escolhidos, porém nenhum destino válido restou — nada será enviado')
      }
      // Outbox multicanal: captura uma vez por mensagem de origem, antes do
      // fan-out WhatsApp. O consumidor da API renderiza/publica depois; o
      // bot-worker nunca recebe token Meta nem transforma Instagram em JID.
      await captureInstagramMirror({
        user: { id: userId, plan: cfg.plan, accessExpiresAt: cfg.accessExpiresAt },
        sourceGroupId: monitorGroup?.id,
        sourceMessageKey: `${jid}:${msg.key.id}`,
        text: finalText,
        primary,
      }, { db }).catch(err => logger.warn({ err: err?.message, msgId: msg.key.id }, 'Falha ao capturar Story espelhado'))

      const destinations = cfg.botConfig.postToStatus ? [...baseDestinations, 'status@broadcast'] : baseDestinations
      // "Intervalo entre destinos" (specs/018-unificar-protecao-anti-ban,
      // FR-022 a FR-026): deixou de ser um sorteio congelado no enqueue e
      // virou espera FIXA, decidida no DEQUEUE por
      // core/destinationSpacing.js (processSendJob) — vale para qualquer
      // destino (grupo, canal, status), não só canal, e nunca congela a fila
      // serial (sempre adiamento, mesmo curto). Ver RCA "'Atraso entre
      // canais' — default 90s → 20s" no AGENTS.md.
      // Cupom usa a janela curta (couponDedupWindowMs); produto mantém a
      // janela diária. primary.linkKind é resolvido por resolveLinkKind no
      // momento da conversão (mesmo em Amazon/ML, que não marcam sozinhos —
      // ver converters/linkKind.js), então já reflete a classificação correta
      // aqui, igual pra todos os destinos desta mensagem.
      const isCouponLink = primary.linkKind === 'coupon'
      const effectiveDedupWindowMs = isCouponLink ? couponDedupWindowMs : linkDedupWindowMs
      // Idade máxima para um envio AINDA PENDENTE contar como duplicata. Cupom
      // usa a própria janela curta (não segura repost legítimo de campanha);
      // produto usa o teto longo, porque um job adiado horas pela preservação
      // do destino continua sendo o MESMO envio esperando sair.
      const pendingDedupMaxAgeMs = isCouponLink ? effectiveDedupWindowMs : PENDING_DEDUP_MAX_AGE_MS
      for (const destJid of destinations) {
        const postDetail = cfg.groups.postDetails.find(g => g.waJid === destJid)
        // Feature 017 (arquitetura multicanal de entrega), D-A4/D-A6/T022:
        // ÚNICO ramo de hand-off do worker. `postDetail.deliveryNetwork` já
        // vem RESOLVIDO por toPostDetail() (src/billing/groupEntitlements.js)
        // — 'whatsapp' para destino ausente/legado. `status@broadcast` (sem
        // postDetail) também é sempre WhatsApp. Com o interruptor
        // DELIVERY_NETWORKS_ENABLED no default, buildEntitledGroupConfig já
        // filtrou qualquer destino não-WhatsApp para fora de
        // cfg.groups.postDetails — este ramo é INALCANÇÁVEL em produção
        // hoje, por construção (ver test/delivery-rollout-fora-do-worker.test.js).
        // Nada do caminho de WhatsApp abaixo (dedup, buildPayload, envio) é
        // tocado quando o destino É WhatsApp — o `continue` só corre para o
        // destino de outra rede.
        const destDeliveryNetwork = postDetail?.deliveryNetwork ?? DELIVERY_NETWORK.WHATSAPP
        if (destDeliveryNetwork !== DELIVERY_NETWORK.WHATSAPP) {
          await enqueueDeliveryOutbox({
            userId,
            deliveryNetwork: destDeliveryNetwork,
            destinationId: destJid,
            sourceId: jid,
            offer: {
              texto: finalText,
              linkConvertido: primary.converted || primary.url || '',
              imagem: null,
              produto: { titulo: null, preco: null },
            },
          }).catch(err => logger.warn({ err: err?.message, destJid, deliveryNetwork: destDeliveryNetwork }, 'Falha ao enfileirar hand-off multicanal'))
          continue
        }
        // Botão "Ver canal" definido pelo GRUPO DE DESTINO (ou null = sem botão).
        const channelForward = resolveChannelForward(postDetail)
        // Aparência da imagem: escolhida pelo DESTINO, não pela origem. Ver
        // core/imageModePolicy.js — valor ausente/desconhecido cai em 'original'.
        // Destino com botão "Ver canal" não aceita card: o WhatsApp só aceita o
        // botão em corpo de mídia. A degradação preserva a marca d'água — antes
        // dela, card com marca + botão saía como foto SEM marca, em silêncio.
        const destinationImageMode = effectiveDestinationImageMode(postDetail?.imageMode, { hasChannelButton: !!channelForward })
        const watermarkText = String(postDetail?.watermarkText ?? '').trim()
        const watermarkColor = postDetail?.watermarkColor ?? undefined
        const watermarkSize = postDetail?.watermarkSize ?? undefined
        const watermarkPosition = postDetail?.watermarkPosition ?? undefined
        const useDestinationWatermark = destinationImageUsesWatermark(destinationImageMode) && Boolean(watermarkText)
        // Segurança anti-duplicação por destino. Precisamos guardar DUAS chaves:
        // - primary.url: link upstream estável. Bloqueia a mesma mensagem da fonte
        //   repostada logo depois, mesmo que o conversor gere outro shortlink.
        // - primary.converted: link final. Bloqueia fontes diferentes que caiam no
        //   mesmo link afiliado.
        // truncateByCodePoints (não `.slice`): cortar em 80 code UNITS parte o par
        // surrogate de um emoji ao meio, e a metade solta faz a reserva de
        // SendDedupKey morrer com `unexpected end of hex escape` no Prisma.
        const fallbackDedupSubject = `${msg.key.id || 'nolink'}:${truncateByCodePoints(sanitizeMessageForLog(finalText), 80)}`
        const { dedupKeys } = buildMirrorDedupKeys({
          destJid,
          primaryUrl: primary.url,
          primaryConverted: primary.converted,
          fallbackSubject: fallbackDedupSubject,
        })
        const localDedupMatch = dedupKeys
          .map(key => (dedup.links[key] ? { key, ageMs: Date.now() - dedup.links[key] } : null))
          .filter(Boolean)
          .find(m => m.ageMs < effectiveDedupWindowMs)
        if (localDedupMatch) {
          await registerDedupBlock({
            reason: 'skip:dedup_recent_link',
            platform: primary.platform,
            destJid,
            originalUrl: primary.url,
            convertedUrl: primary.converted,
            messageText: finalText,
            dedupWindowMs: effectiveDedupWindowMs,
            ageMs: localDedupMatch.ageMs,
          })
          // Diagnóstico (2ª rodada de reports de cupom preso): loga QUAL chave
          // bateu (url original vs. convertido — ver buildMirrorDedupKeys) e há
          // quanto tempo, pra distinguir "bloqueio de verdade dentro da janela"
          // de "bug". matchedKey aqui é destJid:url — comparar com primary.url/
          // primary.converted no log de 'Link convertido' de perto no tempo.
          logger.info({ destJid, dedupKeyCount: dedupKeys.length, matchedKey: localDedupMatch.key, ageMs: localDedupMatch.ageMs, windowMs: effectiveDedupWindowMs, layer: 'local' }, 'Duplicata ignorada'); continue
        }

        // Trava compartilhada entre processos. A dedup local é por worker; se
        // dois workers/sockets processarem a mesma sessão, ou se Redis estiver
        // ausente/fail-open, o banco ainda enxerga os envios recentes para o
        // mesmo usuário+destino+link e bloqueia a duplicata antes de criar novo
        // log queued. Caso real: duas linhas success idênticas em ~9s com
        // dedupHits=0.
        const dedupLookupUrls = [...new Set([primary.url, primary.converted].filter(Boolean))]
        const recentDbDuplicate = dedupLookupUrls.length
          ? await db.messageLog.findFirst({
              where: {
                userId,
                destGroup: destJid,
                OR: [
                  { originalUrl: { in: dedupLookupUrls } },
                  { convertedUrl: { in: dedupLookupUrls } },
                ],
                // Dois critérios independentes (ver PENDING_DEDUP_MAX_AGE_MS):
                // 1) já ENTREGUE dentro da janela do linkKind;
                // 2) ainda PENDENTE na fila — duplicata independente da idade,
                //    porque o job pode estar adiado há horas pela preservação
                //    do destino e ainda vai sair.
                // CUPOM fica de fora do critério 2 (pendingMaxAgeMs cai para a
                // janela curta do cupom): a mesma URL de campanha é reposta
                // várias vezes ao dia com códigos diferentes, e segurar a
                // segunda porque a primeira ainda não saiu perderia oferta
                // legítima. Produto mantém a proteção completa.
                AND: [{
                  OR: [
                    {
                      status: 'success',
                      sentAt: { gte: new Date(Date.now() - effectiveDedupWindowMs) },
                    },
                    {
                      status: { in: ['queued', 'sending'] },
                      sentAt: { gte: new Date(Date.now() - pendingDedupMaxAgeMs) },
                    },
                  ],
                }],
              },
              orderBy: { sentAt: 'desc' },
              select: { id: true, sentAt: true, status: true },
            }).catch(err => {
              logger.warn({ err: err?.message, destJid }, 'Dedup DB lookup falhou; seguindo com dedup local/global')
              return null
            })
          : null
        if (recentDbDuplicate) {
          const dbAgeMs = Date.now() - new Date(recentDbDuplicate.sentAt).getTime()
          await registerDedupBlock({
            reason: 'skip:dedup_recent_link',
            platform: primary.platform,
            destJid,
            originalUrl: primary.url,
            convertedUrl: primary.converted,
            messageText: finalText,
            dedupWindowMs: effectiveDedupWindowMs,
            ageMs: dbAgeMs,
          })
          logger.info({ destJid, recentLogId: recentDbDuplicate.id, recentStatus: recentDbDuplicate.status, dedupKeyCount: dedupKeys.length, ageMs: dbAgeMs, windowMs: effectiveDedupWindowMs, layer: 'db' }, 'Duplicata DB ignorada')
          continue
        }

        // Reserva atômica cross-worker. O findFirst acima é diagnóstico/legado,
        // mas sozinho ainda tem janela de corrida: dois workers podem consultar
        // antes de qualquer um criar MessageLog. O índice único em SendDedupKey
        // transforma a dedup em compare-and-set no SQLite.
        //
        // expiresAt usa SEND_DEDUP_RESERVATION_TTL_MS (fixo, curto) — NÃO
        // effectiveDedupWindowMs. Bug real corrigido: essa tabela existe só
        // pra fechar a corrida de MILISSEGUNDOS entre o findFirst acima e o
        // create do MessageLog logo abaixo (ver updateMany que vincula a
        // reserva ao log recém-criado) — nunca precisou representar a janela
        // lógica inteira de dedup. Usar effectiveDedupWindowMs aqui prendia
        // reservas de CUPOM por até 24h (a janela ANTIGA, de antes da reserva
        // ter sido criada) sempre que o índice único ainda estava ocupado, já
        // que create() conflita pela EXISTÊNCIA da linha, não pelo seu
        // expiresAt — só o deleteMany() abaixo libera o slot, e só libera
        // quando expiresAt já passou. A dedup "de verdade" (é ou não duplicata
        // dentro da janela do linkKind) já é decidida pelas outras 3 camadas
        // (local, MessageLog/DB, Redis), que reavaliam a janela atual a cada
        // checagem — essa aqui só precisa sobreviver ao tempo de um request.
        const reservationExpiresAt = new Date(Date.now() + SEND_DEDUP_RESERVATION_TTL_MS)
        await db.sendDedupKey.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(err => {
          logger.warn({ err: err?.message }, 'Limpeza de SendDedupKey expirada falhou')
        })
        const reservedDedupKeys = []
        let reservedDuplicate = false
        let reservedDuplicateKey = null
        let reservationAgeMs = null
        for (const key of dedupKeys) {
          try {
            const reservation = await db.sendDedupKey.create({
              data: { userId, destGroup: destJid, dedupKey: key, expiresAt: reservationExpiresAt },
              select: { id: true },
            })
            reservedDedupKeys.push(reservation.id)
          } catch (err) {
            if (err?.code === 'P2002') {
              // Bug real encontrado por report em produção (mesma família do
              // fix do Redis/PR #1192, mas nesta tabela): uma linha gravada
              // ANTES de SEND_DEDUP_RESERVATION_TTL_MS existir (ou sob
              // qualquer versão anterior do código que usava um TTL mais
              // longo pra expiresAt) pode ter expiresAt até 24h no futuro —
              // o deleteMany acima só remove linha com expiresAt JÁ passado,
              // então essa linha "órfã" nunca é limpa e conflita pra sempre
              // até seu próprio expiresAt antigo vencer. Sintoma observado:
              // painel mostrando "bloqueado há 393min" com janela de 5min.
              //
              // Fix: em vez de confiar no expiresAt gravado na linha, mede a
              // idade REAL (createdAt) contra o teto ATUAL
              // (SEND_DEDUP_RESERVATION_TTL_MS). Mais velha que o teto atual
              // → não é uma corrida de verdade (essa reserva só precisa
              // sobreviver a um request, nunca minutos): deleta e tenta de
              // novo. Continua mais nova que o teto → é duplicata real
              // (outro worker reservou a mesma chave há pouco), trata como
              // bloqueio de verdade.
              const conflicting = await db.sendDedupKey.findFirst({
                where: { userId, destGroup: destJid, dedupKey: key },
                select: { id: true, createdAt: true },
              }).catch(() => null)
              const conflictAgeMs = conflicting ? Date.now() - new Date(conflicting.createdAt).getTime() : null
              if (conflicting && conflictAgeMs > SEND_DEDUP_RESERVATION_TTL_MS) {
                await db.sendDedupKey.delete({ where: { id: conflicting.id } }).catch(() => {})
                try {
                  const retried = await db.sendDedupKey.create({
                    data: { userId, destGroup: destJid, dedupKey: key, expiresAt: reservationExpiresAt },
                    select: { id: true },
                  })
                  reservedDedupKeys.push(retried.id)
                  continue
                } catch {
                  // Corrida genuína com outro worker que reservou no meio
                  // desse delete+retry — cai no bloqueio normal abaixo.
                }
              }
              reservedDuplicate = true
              reservedDuplicateKey = key
              reservationAgeMs = conflictAgeMs
              break
            }
            logger.warn({ err: err?.message, destJid }, 'Reserva SendDedupKey falhou; seguindo com dedup local/global')
          }
        }
        if (reservedDuplicate) {
          await registerDedupBlock({
            reason: 'skip:dedup_recent_link',
            platform: primary.platform,
            destJid,
            originalUrl: primary.url,
            convertedUrl: primary.converted,
            ageMs: reservationAgeMs,
            messageText: finalText,
            dedupWindowMs: effectiveDedupWindowMs,
          })
          logger.info({ destJid, dedupKeyCount: dedupKeys.length, ageMs: reservationAgeMs, windowMs: effectiveDedupWindowMs, layer: 'reservation' }, 'Duplicata reservada DB ignorada')
          continue
        }

        if (GLOBAL_DEDUP_MODE !== 'off') {
          // Usa a mesma janela efetiva (diária pra produto, curta pra cupom)
          // também na dedup cross-instância via Redis — antes usava
          // dedupeWindowMs (5min) sempre, o que deixava a mesma oferta de
          // PRODUTO passar de novo poucos minutos depois quando o bloqueio
          // in-memory não pegava (ex.: outro processo/instância).
          let globalDuplicate = false
          let globalDuplicateAgeMs = null
          for (const key of dedupKeys) {
            const globalDedup = await globalDedupCheckAndSet(key, effectiveDedupWindowMs)
            if (globalDedup.duplicate) {
              globalDuplicate = true
              globalDuplicateAgeMs = globalDedup.ageMs ?? null
              break
            }
          }
          if (globalDuplicate) {
            await registerDedupBlock({
              reason: 'skip:dedup_recent_link_global',
              platform: primary.platform,
              destJid,
              originalUrl: primary.url,
              convertedUrl: primary.converted,
              messageText: finalText,
              dedupWindowMs: effectiveDedupWindowMs,
              ageMs: globalDuplicateAgeMs,
            })
            logger.info({ destJid, dedupKeyCount: dedupKeys.length, ageMs: globalDuplicateAgeMs, windowMs: effectiveDedupWindowMs, layer: 'redis' }, 'Duplicata global ignorada')
            continue
          }
        }
        for (const key of dedupKeys) dedup.links[key] = Date.now()
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
        //
        // O modo é resolvido POR DESTINO (destinationImageMode, calculado acima
        // no início do loop) — uma mesma oferta pode sair 'original' num grupo,
        // 'original_watermark' noutro e 'preview' num terceiro. `imageMode` aqui
        // é sempre o MODO-BASE ('original'/'preview'); a marca d'água é uma
        // camada aplicada em cima do modo-base 'original' (useDestinationWatermark).
        const imageMode = destinationImageBaseMode(destinationImageMode)
        const wantImage = !['none', 'preview'].includes(imageMode)
        // O caminho de relay reaproveita a mídia hospedada da mensagem de origem.
        // Portanto ele só é correto quando a preferência é explicitamente
        // "Imagem que veio na mensagem". No modo "Imagem oficial da loja"
        // precisamos forçar o caminho de upload (getImage → fetch ativo) para não
        // vazar a imagem do anúncio/origem por cima da escolha do usuário.
        // `reupload` (padrão): a foto da mensagem de origem é baixada e SUBIDA de
        // novo, exatamente como no destino com botão "Ver canal" — caminho único
        // para a mesma promessa de produto. Ver shouldReuploadOriginalMedia
        // (core/imageModePolicy.js) para o RCA de por que os dois caminhos
        // deixaram de coexistir.
        // Marca d'água exige acesso aos bytes: mesmo com o escape hatch global
        // em relay, um destino com marca precisa baixar/compor/subir a imagem —
        // o relay reaproveita o proto da origem, sem qualquer chance de compor
        // a marca por cima.
        const original = (shouldRelayOriginalMediaForImageMode(imageMode) && !useDestinationWatermark && !shouldReuploadOriginalMedia())
          ? originalMedia
          : null
        let useLinkPreview = false  // será setado a true se jpegThumbnail for descartado

        const previousSuccessCount = await db.messageLog.count({ where: { userId, status: 'success' } }).catch(() => 1)
        const log = await db.messageLog.create({
          data: { ...logData, status: 'queued' },
        })
        if (reservedDedupKeys.length) {
          await db.sendDedupKey.updateMany({
            where: { id: { in: reservedDedupKeys } },
            data: { messageLogId: log.id },
          }).catch(err => {
            logger.warn({ err: err?.message, logId: log.id }, 'Falha ao vincular SendDedupKey ao MessageLog')
          })
        }
        // COMO esta oferta saiu, preenchido por buildPayload no dequeue e
        // persistido no MessageLog quando o envio dá certo. Antes daqui existia
        // um `sentVia` que nascia 'text' e nunca era atualizado — ou seja, o
        // painel sabia que o envio deu certo, mas não sabia se a cliente recebeu
        // foto, card ou texto pelado. Era esse buraco que fazia todo problema de
        // imagem ser descoberto pela cliente, e não por nós.
        const deliveryInfo = { kind: null, originImageBytes: null }

        // PR-5.B.2: variação de copy por canal-destino. Aplica só em canal —
        // em grupo não há fingerprint de "mesma mensagem em N", então mantém
        // texto original. Usa random:true (igual ao dispatcher de ofertas
        // automáticas) para a variação realmente alternar a cada envio; antes
        // era determinística por destJid+data, o que mandava sempre a mesma
        // variação no mesmo canal/dia e enfraquecia o anti-fingerprint.
        const isChannelDest = isChannelDestination(destJid)
        const variantText = isChannelDest
          ? (isPreservationFeatureEnabled(cfg.preservationActive, cfg.botConfig, PRESERVATION_FEATURE.COPY_VARIATION)
              ? applyVariation(finalText, { groupId: destJid, poolJson: resolveCopyVariationPoolJson(cfg.botConfig.copyVariationPoolJson), random: true })
              : finalText)
          : finalText

        // buildPayload é LAZY de propósito: roda no dequeue, dentro do
        // worker. Mantém image.buffer (Buffer) em memória do processo, sem
        // passar pelo Redis. Ver enqueueSendJob() para a explicação completa.
        const buildPayload = async () => {
          // Quanto a MENSAGEM DE ORIGEM trouxe de imagem. `getOriginalPhotoOnce`
          // é memoizado por mensagem, então isto não gera download extra — e é o
          // dado que separa "não havia foto" de "havia foto e se perdeu".
          try {
            const origem = await getOriginalPhotoOnce()
            deliveryInfo.originImageBytes = origem?.buffer?.length ?? 0
          } catch {
            deliveryInfo.originImageBytes = null
          }

          // Modo "preview": envia uma única mensagem de texto com link preview
          // clicável do WhatsApp (card grande via thumbnail HQ upada — ver
          // buildManualLinkPreview). Não envia imageMessage: o clique no card
          // abre o link, enquanto o clique numa imagem só ampliaria a foto.
          // activeSock (e não um sock capturado) porque buildPayload roda no
          // dequeue, possivelmente após reconexão.
          //
          // EXCEÇÃO — destino com botão "Ver canal" (channelForward): o botão
          // (contextInfo.forwardedNewsletterMessageInfo) só é aceito pelo
          // WhatsApp em corpo de MÍDIA (injectChannelForwardIntoPayload,
          // src/core/channelSend.js, MÍDIA-ONLY por decisão pós-regressão) —
          // texto puro/linkPreview nunca carrega o botão. Por isso, quando o
          // destino pediu o botão, pulamos o card de preview e caímos no
          // caminho de imagem abaixo (getImage com forceOriginalForChannelButton),
          // que é o único capaz de anexar o botão.
          if (imageMode === 'preview' && !channelForward) {
            // Sinal de TEXTO da blindagem tripla (couponBrandCardPolicy.js).
            //
            // NÃO usar isCouponMsg cru aqui: ele (isCouponAnnouncement) dispara
            // com QUALQUER "cupom" + palavra em CAIXA ALTA, inclusive num PRODUTO
            // que só carrega um código de cupom ("...Ryzen 5 5500... CUPOM:
            // PRESENTE"). Quando esse produto vem por short link que esconde o
            // MLB/ASIN (ex.: mercadolivre.com/sec/XXXX → linkKind:'coupon',
            // urlHasProductId:false), as três blindagens passavam e o produto
            // saía com o BANNER "Cupom Loja" no lugar da foto — regressão de
            // produção (produto Ryzen com banner ML, 2026-07; mesma família de
            // #1205/#1208, que o short link driblava por trás do texto).
            //
            // Reusa a MESMA decisão já computada para a estratégia de imagem
            // (couponSkipActiveFetch, via decideSkipActiveFetchForCoupon): ela
            // distingue "cupom genérico → link resolve p/ produto aleatório"
            // (skip=true → banner é o certo) de "produto + cupom" (titleOverlap
            // 'match' → skip=false → foto do produto). Assim os dois caminhos de
            // imagem (preview e não-preview) concordam sobre produto-vs-cupom.
            //
            // O sinal de vitrine ML (warning) NÃO é mais gatilho independente
            // (RCA 2026-09-18): ele indica FALHA DE CONVERSÃO, não cupom, e
            // sozinho derrubava as três blindagens de uma vez. Hoje só vale com
            // vitrine confirmada — ver resolveCouponTextSignal.
            const couponTextSignal = resolveCouponTextSignal({
              couponSkipActiveFetch,
              warning: primary?.warning,
              // `primary.url` é o link ORIGINAL da mensagem (o convertido é
              // `primary.converted`) — a mesma entrada de isDirectVitrineShare
              // dentro do converter, para as duas pontas não discordarem.
              vitrineConfirmed: isDirectVitrineShare(primary?.url),
            })
            let fonteDaFoto = null
            const linkPreview = await buildManualLinkPreview({
              onFonteDaFoto: fonte => { fonteDaFoto = fonte },
              text: variantText,
              primary,
              credentialsMap: cfg.credentials,
              uploadToServer: activeSock?.waUploadToServer,
              destJid,
              couponTextSignal,
              // Plano B da foto (previewImageFallbackPolicy.js): só é chamado
              // quando a loja não entregou imagem. `downloadOriginalImage` é
              // lazy e já tem log próprio; no modo preview ele não é usado por
              // mais ninguém (getImage devolve null cedo), então não há
              // download duplicado da mesma mídia.
              fetchOriginPhoto: getOriginalPhotoOnce,
              // Modo "card com marca d'água": a marca é uma camada em cima do
              // modo-base, igual ao par 'original'/'original_watermark'.
              watermark: useDestinationWatermark ? { text: watermarkText, color: watermarkColor, size: watermarkSize, position: watermarkPosition } : null,
            })
            deliveryInfo.kind = linkPreview ? kindDoCard(fonteDaFoto) : DELIVERY_KIND.TEXTO
            return buildMonitoredMessagePayload({
              finalText: variantText,
              image: null,
              useLinkPreview: true,
              linkPreview,
            })
          }

          // Quando o destino tem botão de canal (channelForward), pulamos o relay
          // de propósito: o relay reaproveita o proto de mídia da ORIGEM e injetar
          // o NOSSO canal nele faz o WhatsApp derrubar o envio. Em vez disso caímos
          // no caminho sendMessage com a imagem rebaixada (getImage) — o MESMO
          // caminho comprovado das ofertas automáticas — e a injeção central
          // (mídia-only) adiciona o botão. Sem botão, mantemos o relay (fidelidade
          // máxima de mídia, inclui vídeo).
          if (shouldUseRelayPath({ destJid, hasOriginal: !!original }) && !channelForward) {
            // documentMessage também tem legenda: sem trocar, o documento saía
            // com a legenda da ORIGEM (links do concorrente inclusos).
            const hasCaption = original.type === 'imageMessage' || original.type === 'videoMessage' || original.type === 'documentMessage'
            // Higieniza o contextInfo herdado da ORIGEM (remove botão de terceiros
            // e externalAdReply). forwardNewsletter=null: relay nunca injeta canal.
            const replayProto = buildRelayProto(original.proto, {
              caption: hasCaption ? variantText : undefined,
              forwardNewsletter: null,
            })
            deliveryInfo.kind = DELIVERY_KIND.RELAY
            return {
              _route: 'relay',
              relay: {
                type: original.type,
                proto: replayProto,
              },
            }
          }

          let image = null
          if (wantImage || channelForward) {
            let fetched = await getImage({ forceOriginalForChannelButton: !!channelForward, imageMode })
            // Loja não devolveu foto oficial e resolveMonitoredImage caiu no
            // último recurso (jpegThumbnail pequena — ver monitoredImageResolver.js).
            // No modo 'original' puro, mandar essa miniatura como CORPO DE MÍDIA
            // sai ampliada/borrada (relato real: Shopee sem ids, card de cadeira
            // saiu pixelado). Tratamos como se não houvesse imagem: cai no MESMO
            // card de preview clicável usado abaixo (useLinkPreview), com a
            // cascata de previewImageFallbackPolicy.js. NÃO se aplica a
            // channelForward — o botão "Ver canal" exige corpo de mídia.
            if (imageMode === 'original' && !channelForward && fetched?.usedThumbnailFallback) {
              fetched = null
            }
            // Mutação anti-fingerprint SOMENTE para canal-destino (newsletter
            // JID) e quando o opt-in global está ligado. NÃO aplicar a grupos.
            // Quando ligada, o crop + qualidade variada vão DENTRO do mesmo
            // encode do normalize (sem 2º encode JPEG = sem dupla compressão).
            // Regressão de dupla compressão documentada em 2026-06
            // (commit image-upload-bug-fix). Ver normalizeImageForWhatsApp.
            const wantMutation = isChannelDest && isPreservationFeatureEnabled(cfg.preservationActive, cfg.botConfig, PRESERVATION_FEATURE.IMAGE_MUTATION)
            if (fetched && useDestinationWatermark && imageMode === 'original') {
              try {
                const rendered = await renderDestinationWatermark(fetched.buffer, { text: watermarkText, color: watermarkColor, size: watermarkSize, position: watermarkPosition })
                // A mutação roda POR CIMA da imagem já marcada (2º encode JPEG,
                // aceito só nesta combinação rara de marca+mutação ligadas ao
                // mesmo tempo). Sem isso, o canal perderia a proteção
                // anti-fingerprint sempre que a marca desse certo — achado de
                // revisão (a marca não pode desligar essa proteção em silêncio).
                const mutated = wantMutation
                  ? await normalizeImageForWhatsApp(rendered.main, { mutation: { groupId: destJid } })
                  : null
                image = mutated || {
                  buffer: rendered.main,
                  mimetype: 'image/jpeg',
                  jpegThumbnail: rendered.thumbnail,
                  width: rendered.width,
                  height: rendered.height,
                }
                if (!rendered.watermarkApplied) reportWatermarkMissing(`foto:${rendered.skipReason || 'nao_aplicada'}`, { destJid })
              } catch (err) {
                logger.warn({ err: err?.message, destJid }, 'Marca d\'água falhou; enviando imagem normal')
                reportWatermarkMissing('foto:render_falhou', { destJid, err: err?.message })
                image = await normalizeImageForWhatsApp(fetched.buffer, wantMutation ? { mutation: { groupId: destJid } } : {})
              }
            } else {
              image = fetched
                ? await normalizeImageForWhatsApp(fetched.buffer, wantMutation ? { mutation: { groupId: destJid } } : {})
                : null
            }
            if (fetched && !image) {
              logger.warn({ msgId: msg.key.id, srcMime: fetched.mimetype, size: fetched.buffer?.length }, 'normalizeImageForWhatsApp falhou — enviando sem imagem')
            }
            // Sem imagem disponível (falha de fetch ou produto sem foto): cai
            // pro link preview automático do WhatsApp em vez de texto pelado —
            // vale tanto pro modo 'original' histórico quanto pro destino com
            // channelForward (que não tem 'original' setado, mas precisa do
            // mesmo fallback gracioso). Sem imagem não há corpo de mídia, então
            // o botão "Ver canal" não sai nesse envio específico — degrada pra
            // preview normal em vez de falhar o envio.
            if ((imageMode === 'original' || channelForward) && !image) {
              useLinkPreview = true
            }
          }

          // Sem imagem, `useLinkPreview` sozinho só liga o preview AUTOMÁTICO do
          // Baileys (generateHighQualityLinkPreview). Ele não resolve link de
          // afiliado encurtado (s.shopee.com.br, amzn.to, meli.la) — é a
          // limitação que abre o comentário de monitoredImageResolver.js —, e aí
          // a oferta chega no grupo como TEXTO PELADO, sem foto e sem card.
          // Foi o que aconteceu ao ligar o piso de qualidade da miniatura em
          // 2026-08-26: trocamos foto ruim por nenhuma imagem, que é pior.
          //
          // Montamos então o MESMO card manual do modo preview (foto da loja →
          // plano B com a foto da mensagem de origem). A oferta sai com card
          // clicável e com a foto que houver; a miniatura pequena, renderizada
          // dentro de um card, é legível — o problema original era ela ampliada
          // como imagem de corpo inteiro.
          if (useLinkPreview && !image) {
            let fonteDaFotoFallback = null
            const fallbackPreview = await buildManualLinkPreview({
              onFonteDaFoto: fonte => { fonteDaFotoFallback = fonte },
              text: variantText,
              primary,
              credentialsMap: cfg.credentials,
              uploadToServer: activeSock?.waUploadToServer,
              destJid,
              couponTextSignal: resolveCouponTextSignal({
                couponSkipActiveFetch,
                warning: primary?.warning,
                vitrineConfirmed: isDirectVitrineShare(primary?.url),
              }),
              fetchOriginPhoto: getOriginalPhotoOnce,
              // O piso NÃO vale aqui: neste ponto a alternativa não é uma foto
              // melhor, é nenhuma imagem. Card com miniatura pequena > texto.
              allowSmallOriginPhoto: true,
              watermark: useDestinationWatermark ? { text: watermarkText, color: watermarkColor, size: watermarkSize, position: watermarkPosition } : null,
            }).catch(err => {
              logger.warn({ err: err?.message, destJid }, 'Card de fallback sem imagem falhou; oferta sai como texto')
              return null
            })
            deliveryInfo.kind = fallbackPreview ? kindDoCard(fonteDaFotoFallback) : DELIVERY_KIND.TEXTO
            return buildMonitoredMessagePayload({
              finalText: variantText,
              image: null,
              useLinkPreview: true,
              linkPreview: fallbackPreview,
            })
          }

          deliveryInfo.kind = image ? DELIVERY_KIND.FOTO : DELIVERY_KIND.TEXTO
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
          // Revalidação no dequeue (core/destinationRouting.js): o job pode
          // esperar minutos/horas na fila e a cliente pode desvincular/apagar o
          // destino nesse meio-tempo.
          sourceJid: jid,
          platforms,
          plan: cfg.plan,
          // O intervalo entre destinos NÃO congela mais no enqueue (era o
          // sorteio `staggerMs`) — é decidido no DEQUEUE por
          // core/destinationSpacing.js (processSendJob), junto do freio de
          // fila recalculado por destino.
          delayMs: 0,
          typingDelayMs: calculateTypingDelayMs({ text: variantText, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
          channelForward,
          // specs/017-client-coupon-catalog: { platform, priceCents } | null,
          // resolvido em applyMirrorTemplate SEM leitura extra de rede. Só
          // campos escalares (nunca função/Buffer) — precisa sobreviver ao
          // JSON.stringify do BullMQ como qualquer payload serializável.
          couponContext,
          buildPayload,
          // Referência viva: buildPayload roda no dequeue e preenche este mesmo
          // objeto, que processSendJob lê depois para gravar no MessageLog.
          deliveryInfo,
          onDone: async (result) => {
            if (result.ok) {
              logger.info({ destJid, platforms, deliveryKind: deliveryInfo.kind, originImageBytes: deliveryInfo.originImageBytes }, 'Mensagem enviada')
              if (previousSuccessCount === 0) {
                trackAnalyticsEventSafe({ userId, event: 'first_send_success', metadata: { platform: platforms } })
                maybeSendFirstOfferMessage().catch(() => {})
              }
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
    markUpsertReceived()
    if (type !== 'notify' && type !== 'append') return
    const cutoff = Date.now() - INCOMING_MAX_AGE_MS

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
      // Mensagens enviadas pelo próprio número conectado (fromMe) reaparecem no
      // upsert. Historicamente TODAS eram descartadas aqui — o filtro protegia
      // contra eco dos próprios envios do robô. Mas isso também bloqueava o caso
      // legítimo: a dona da conta enviar ela mesma uma oferta num grupo
      // DISTRIBUIDOR monitorado, esperando que o robô espelhe pros destinos.
      // Agora só descartamos fromMe quando o grupo NÃO é uma fonte monitorada:
      // os envios do robô vão pros grupos de DESTINO (role 'post'), que não são
      // fontes, então continuam sendo ignorados; já a mensagem manual num grupo
      // monitorado segue o pipeline normal. A brecha de eco de um grupo que
      // fosse source E destino ao mesmo tempo é fechada por construção pela
      // trava anti-eco no cadastro de grupos (POST /api/groups): um mesmo JID
      // não pode existir como 'monitor' e 'post'. Fora isso, a dedup por link
      // segue como rede final. Só pagamos o getConfig (cacheado) no ramo fromMe.
      if (msg.key.fromMe) {
        const selfCfg = await getConfig().catch(() => null)
        const selfNormalizedJid = normalizeJidForMatch(msg.key.remoteJid)
        const isMonitoredSource = Boolean(
          selfNormalizedJid &&
          selfCfg?.groups?.monitor?.some(m => normalizeJidForMatch(m.waJid) === selfNormalizedJid)
        )
        if (!isMonitoredSource) continue
      }
      // Marca atividade do JID — usado pelo monitorSilenceWatchdog pra
      // diferenciar "monitor parado por falha de decrypt" de "monitor
      // inativo organicamente". Atualiza independente de filtros downstream.
      const remoteJid = normalizeJidForMatch(msg.key.remoteJid)
      if (remoteJid) lastIncomingByMonitorJid.set(remoteJid, Date.now())
      const msgTsRaw = Number(msg.messageTimestamp ?? 0)
      const hasValidTimestamp = Number.isFinite(msgTsRaw) && msgTsRaw > 0
      const msgTs = hasValidTimestamp ? msgTsRaw * 1000 : null
      // Cada mensagem é vista UMA vez, ao vivo. Reentrega da fila offline do
      // WhatsApp (`type: 'append'`, drenada a cada reconexão) e mensagem velha
      // não reentram no pipeline — ver src/core/incomingFreshness.js. Antes o
      // descarte era um `continue` mudo: nem o motivo nem a idade apareciam no
      // bot.log, o que tornava impossível ver reoferta acontecendo.
      const dedupKey = buildIncomingDedupKey(msg)
      let freshness = shouldProcessIncomingMessage({
        upsertType: type,
        messageTimestampMs: msgTs,
        now: Date.now(),
        maxAgeMs: INCOMING_MAX_AGE_MS,
      })
      // Portão tardio (RCA 2026-09-24): só paga o getConfig (cacheado) e a
      // consulta ao conjunto de ids vistos quando a mensagem já seria
      // descartada por idade E ainda cabe na janela tardia.
      if (
        !freshness.process &&
        freshness.reason === INCOMING_DROP_REASON.STALE &&
        incomingLateMaxAgeMs > INCOMING_MAX_AGE_MS &&
        Number.isFinite(freshness.ageMs) && freshness.ageMs < incomingLateMaxAgeMs
      ) {
        const lateCfg = await getConfig().catch(() => null)
        const isMonitoredSource = Boolean(
          remoteJid && lateCfg?.groups?.monitor?.some(m => normalizeJidForMatch(m.waJid) === remoteJid)
        )
        freshness = shouldProcessIncomingMessage({
          upsertType: type,
          messageTimestampMs: msgTs,
          now: Date.now(),
          maxAgeMs: INCOMING_MAX_AGE_MS,
          lateMaxAgeMs: incomingLateMaxAgeMs,
          isMonitoredSource,
          seenBefore: hasSeenIncomingId(dedup, dedupKey, Date.now(), seenIncomingIdWindowMs),
        })
      }
      if (!freshness.process) {
        logger.info({
          jid: msg.key.remoteJid,
          msgId: msg.key.id,
          upsertType: type,
          reason: freshness.reason,
          ageMs: freshness.ageMs,
          maxAgeMs: INCOMING_MAX_AGE_MS,
          lateMaxAgeMs: incomingLateMaxAgeMs,
        }, 'Mensagem descartada: reentrega/mensagem velha não reentra no pipeline')
        continue
      }
      if (freshness.reason === INCOMING_ACCEPT_REASON.LATE_MONITORED_SOURCE) {
        logger.info({
          jid: msg.key.remoteJid,
          msgId: msg.key.id,
          upsertType: type,
          ageMs: freshness.ageMs,
          lateMaxAgeMs: incomingLateMaxAgeMs,
        }, 'Mensagem atrasada aceita: origem monitorada e id nunca visto (entrega tardia pós-queda)')
      }

      const now = Date.now()
      pruneDedupStore(dedup, now, { msgIds: dedupeWindowMs, links: linkDedupWindowMs, seenIds: seenIncomingIdWindowMs })
      if (dedupKey && hasRecentDedupEntry(dedup.msgIds, dedupKey, now, dedupeWindowMs)) {
        logger.info({ dedupKey, jid: msg.key.remoteJid, upsertType: type, ageMs: msgTs ? now - msgTs : null, windowMs: dedupeWindowMs }, 'Mensagem duplicada ignorada')
        continue
      }
      const remembered = rememberDedupEntry(dedup, dedupKey, now)
      // Todo id ACEITO entra no conjunto de vistos — é ele que impede a
      // reentrega do mesmo id de reentrar pela janela tardia.
      const rememberedSeen = rememberSeenIncomingId(dedup, dedupKey, now)
      if (remembered || rememberedSeen) scheduleDedupSave(dedup)

      // Forense de reoferta (RCA 2026-07 — mensagem espelhada 5x): sem esta
      // linha era impossível provar, pelo bot.log, se o WhatsApp reofertou a
      // MESMA mensagem (mesmo key.id) ou se a fonte republicou — o log de
      // upsert só trazia {type, count}. Volume proporcional ao de mensagens
      // aceitas (reentregas e duplicatas param nos `continue` acima).
      // upsertType='append' aqui significa mensagem de CANAL ao vivo (a única
      // 'append' que sobrevive ao filtro de frescor).
      logger.info({
        jid: msg.key.remoteJid,
        msgId: msg.key.id,
        upsertType: type,
        hasValidTimestamp,
        ageMs: msgTs ? now - msgTs : null,
      }, 'Mensagem aceita para processamento')
      markMessageAccepted()

      const msgId = msg.key.id || dedupKey || `${msg.key.remoteJid || 'unknown'}:${msgTsRaw || now}`
      const accepted = incomingQueue.enqueue(() => processIncomingMessage(msg, sock), {
        label: `msg:${msgId}`,
        orderKey: msg.key.remoteJid,
        onError: async (err) => {
          const currentCfg = await getConfig().catch(() => null)
          const currentJid = msg.key.remoteJid
          const isMonitored = Boolean(currentCfg?.groups?.monitor?.find?.(m => m.waJid === currentJid))
          if (!isMonitored) {
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
    reconnectDeadlineMs = Date.now() + 1_000
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


async function shutdown(code = 0, { exit = registerProcessHandlers } = {}) {
  if (shuttingDown) return
  shuttingDown = true
  eventLoopDelay.disable()
  stopHeartbeatIpc()
  clearInterval(scheduledMessagesTimer)
  clearInterval(stuckSendLogsTimer)
  clearInterval(monitorSilenceTimer)
  if (dedupFlushTimer) clearTimeout(dedupFlushTimer)
  if (knownChannelsFlushTimer) clearTimeout(knownChannelsFlushTimer)

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
  try { activeSock?.end?.(new Error('session shutdown')) } catch {}
  try { pendingSock?.end?.(new Error('session shutdown')) } catch {}
  activeSock = null
  pendingSock = null
  try { await runtimeRedis?.quit?.() } catch {}
  if (exit) exitRuntime(code)
}

if (registerProcessHandlers) process.once('SIGTERM', () => { void shutdown(0) })
if (registerProcessHandlers) process.once('SIGINT', () => { void shutdown(0) })

const handleMessage = async msg => {
  if (msg?.type === 'stop') {
    logger.info('Bot parando por solicitação do manager')
    await shutdown(0)
  }

  if (msg?.type === 'reloadConfig') {
    configCache = null
    configCachePromise = null
    logger.info('Config recarregada')
    ensureChannelSubscriptions().catch(err => logger.error({ err: err?.message }, 'channels: erro ao inscrever após reload'))
    if (msg.requestId) sendIpc({ type: 'reloadConfigResult', requestId: msg.requestId, data: true })
  }

  if (msg?.type === 'refreshWaGroups') {
    const result = await triggerWaGroupsRefresh('ipc_manual')
    sendIpc({ type: 'refreshWaGroups', requestId: msg.requestId, data: result })
  }

  if (msg?.type === 'listGroups') {
    if (!activeSock) {
      sendIpc({ type: 'groups', requestId: msg.requestId, data: [], error: 'Bot não conectado' })
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
        sendIpc({ type: 'groups', requestId: msg.requestId, data: list })
      })
      .catch(err => {
        sendIpc({ type: 'groups', requestId: msg.requestId, data: [], error: err.message })
      })
  }

  if (msg?.type === 'requestPairingCode') {
    const requestId = msg.requestId
    const phone = msg.phone
    if (!phone) {
      sendIpc({ type: 'pairingCode', requestId, error: 'Telefone obrigatório' })
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
          // Janela venceu sem código: o pareamento não aconteceu, devolve a
          // credencial antiga para a sessão poder voltar sozinha.
          void pairingAuthBackup.restore()
          if (sendIpc) sendIpc({ type: 'pairingCode', requestId: expired.requestId, error: 'Tempo esgotado aguardando código de pareamento' })
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

      // NÃO apagar: mover para backup. Se o WhatsApp recusar o pareamento
      // antes de o código chegar ao usuário, a credencial antiga volta e a
      // sessão retoma a reconexão automática em vez de ficar travada sem
      // credencial nenhuma (RCA 2026-07-28).
      await pairingAuthBackup.backup()

      logger.info({ requestId }, 'Iniciando socket fresh em pairing mode')
      startBot().catch(async err => {
        if (!pairingState.ownsRequest(requestId)) return
        logger.error({ err: err.message, requestId }, 'startBot falhou durante pairing')
        pairingState.clear()
        await pairingAuthBackup.restore()
        if (sendIpc) sendIpc({ type: 'pairingCode', requestId, error: `Falha ao iniciar sessão: ${err.message}` })
      })
    } catch (err) {
      logger.error({ err: err.message, requestId }, 'Erro inesperado no handler de pairing')
      pairingState.clear()
      await pairingAuthBackup.restore()
      if (sendIpc) sendIpc({ type: 'pairingCode', requestId, error: err.message })
    }
  }

  if (msg?.type === 'metrics') {
    sendIpc({ type: 'metricsResult', requestId: msg.requestId, data: { ...getSendQueueMetrics(), incomingQueue: incomingQueue.getStats(), sessionHealth: getSessionHealth(), reception: getReceptionHealth(), chatScope: getChatScopeSnapshot(), disconnectedForMs: disconnectedSinceMs == null ? null : Date.now() - disconnectedSinceMs, worker: workerMetadata, runtime: getRuntimeMemoryMetrics() } })
  }

  if (msg?.type === 'broadcast') {
    if (!activeSock) {
      sendIpc({ type: 'broadcastResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    // specs/017-client-coupon-catalog (T020): loja identificada pelo link do
    // texto (mesmo detector usado no espelhamento, src/detector.js — nunca
    // o de dashboard/lib, proibido aqui). Preço tratado como desconhecido
    // (cai na ordem fixa e previsível do FR-011 dentro de chooseCoupon); a
    // substituição em si acontece no MESMO ponto de processSendJob (T019).
    const broadcastCouponContext = couponContextFromText(msg.text, msg.options?.couponPriceCents)

    let queued = 0
    const errors = []
    for (const jid of msg.jids) {
      let log
      try {
        log = await db.messageLog.create({
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
      } catch (err) {
        // Defesa em profundidade (specs/006-worker-crash-log-safety): uma
        // falha ao gravar o log NUNCA pode virar unhandledRejection e
        // derrubar o worker via crash-guard, o que descartaria toda a fila de
        // envio em memória para os demais jids. Loga e segue para o próximo
        // jid — sem log.id válido não há como enfileirar o envio deste.
        logger.error({ err: err?.message, jid }, 'Falha ao gravar MessageLog no broadcast; pulando este destinatário')
        errors.push({ jid, error: classifyError(err) })
        continue
      }
      // Grupo de destino: define o botão "Ver canal" E como a oferta aparece.
      const broadcastPostDetail = (await getConfig()).groups.postDetails.find(g => g.waJid === jid)
      // null = sem botão. A injeção acontece em processSendJob.
      const broadcastChannelForward = resolveChannelForward(broadcastPostDetail)
      const imageRecipe = buildBroadcastImageRecipe(msg.text, { ...msg.options, appearance: resolveOfferAppearance(broadcastPostDetail, { hasChannelButton: !!broadcastChannelForward }) })
      const accepted = await enqueueSendJob({
        type: 'broadcast',
        logId: log.id,
        destJid: jid,
        platforms: 'broadcast',
        plan: 'broadcast',
        // Freio de fila recalculado por destino no dequeue (processSendJob).
        delayMs: 0,
        typingDelayMs: calculateTypingDelayMs({ text: msg.text, minMs: SMART_DELAY_TYPING_MIN_MS, maxMs: SMART_DELAY_TYPING_MAX_MS, charsPerSecond: SMART_DELAY_TYPING_CHARS_PER_SECOND }),
        channelForward: broadcastChannelForward,
        couponContext: broadcastCouponContext,
        // Fila de ofertas com horário próprio pede para ignorar a janela
        // silenciosa global neste envio (origem 'offerQueue'). Propagado ao
        // gate em processSendJob. Sem o flag = comportamento histórico.
        ignoreGlobalQuietHours: msg.options?.ignoreGlobalQuietHours === true,
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
    sendIpc({ type: 'broadcastResult', requestId: msg.requestId, data: { queued, rejected: errors.length, errors } })
  }

  // Admin > Contato com cliente: mensagem manual pro PRÓPRIO número da conta
  // (self-chat), fora do pipeline de oferta — sem MessageLog, sem dedup, sem
  // preservação. Igual às mensagens automáticas do piloto
  // (maybeSendSelfWelcomeMessage e cia), só que disparada por ação humana.
  if (msg?.type === 'sendSelfMessage') {
    if (!activeSock) {
      sendIpc({ type: 'sendSelfMessageResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    const phone = activeSock.user?.id?.split(':')[0] ?? null
    if (!phone) {
      sendIpc({ type: 'sendSelfMessageResult', requestId: msg.requestId, error: 'Número não identificado' })
      return
    }
    try {
      const texto = buildAdminSupportMessageText({ corpo: msg.text })
      await activeSock.sendMessage(`${phone}@s.whatsapp.net`, { text: texto })
      logger.info({ userId }, 'Mensagem manual do suporte enviada para o próprio número')
      sendIpc({ type: 'sendSelfMessageResult', requestId: msg.requestId, data: { ok: true } })
      logWhatsappSelfMessageContact({ reason: 'mensagem_manual_suporte', texto, actorUserId: msg.actorUserId ?? null })
    } catch (err) {
      sendIpc({ type: 'sendSelfMessageResult', requestId: msg.requestId, error: String(err?.message ?? err) })
    }
    return
  }

  if (msg?.type === 'channel:metadata') {
    if (!activeSock) {
      sendIpc({ type: 'channel:metadataResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      const data = await getChannelMetadata({
        sock: activeSock,
        jid: msg.jid,
        inviteCode: msg.inviteCode,
      })
      sendIpc({ type: 'channel:metadataResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message, jid: msg.jid, inviteCode: msg.inviteCode }, 'channel:metadata falhou')
      sendIpc({ type: 'channel:metadataResult', requestId: msg.requestId, error: err.message })
    }
    return
  }

  if (msg?.type === 'channel:follow') {
    if (!activeSock) {
      sendIpc({ type: 'channel:followResult', requestId: msg.requestId, error: 'Bot não conectado' })
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
      sendIpc({ type: 'channel:followResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message, jid: msg.jid }, 'channel:follow falhou')
      sendIpc({ type: 'channel:followResult', requestId: msg.requestId, error: err.message })
    }
    return
  }

  if (msg?.type === 'channel:listFollowed') {
    if (!activeSock) {
      sendIpc({ type: 'channel:listFollowedResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    try {
      // União: canais que o bot seguiu nesta vida + canais detectados no
      // histórico/chats do usuário. Set dedupa automaticamente.
      const data = await listFollowedChannels({
        sock: activeSock,
        followedSet: new Set([...followedChannelJids, ...knownChannelJids]),
      })
      sendIpc({ type: 'channel:listFollowedResult', requestId: msg.requestId, data })
    } catch (err) {
      logger.warn({ err: err?.message }, 'channel:listFollowed falhou')
      sendIpc({ type: 'channel:listFollowedResult', requestId: msg.requestId, error: err.message })
    }
    return
  }
}

if (registerProcessHandlers) process.on('message', handleMessage)
if (autoStart) await startBot()
return {
  userId,
  start: startBot,
  stop: () => shutdown(0, { exit: false }),
  drain: async () => waitUntilDrained({ isDrained: sendJobTracker.isDrained, timeoutMs: SHUTDOWN_DRAIN_TIMEOUT_MS, pollIntervalMs: 100 }),
  command: handleMessage,
  metrics: async () => ({ ...getRuntimeMemoryMetrics(), queue: { ...getSendQueueMetrics(), incoming: incomingQueue.getStats() }, sessionHealth: getSessionHealth() }),
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createBotSessionRuntime({ registerProcessHandlers: true, autoStart: true }).catch(err => {
    logger.error(err, 'Erro fatal no worker')
    process.exit(1)
  })
}
