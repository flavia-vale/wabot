// Feature 017, Fatia 3 (T049) — drenagem da caixa de saída dentro do processo
// `api` (setInterval + unref, single-flight). Ordem canônica de cada tick em
// contracts/delivery-outbox.md — não reordenar:
//   1 selecionar pendentes vencidas → 2 repartir com justiça → 3 descartar
//   por idade → 4 revalidar destino/plano/ligação → 5 degradar → 6 enviar
//   (isolado por item) → 7 gravar o histórico; e podar as linhas antigas.
// Invariantes: adiar nunca é descartar; falha de um item não aborta o lote;
// nada vira "entregue" sem entrega; robô fora do ar para o tick cedo.

import defaultDb from '../db.js'
import logger from '../logger.js'
import { getDeliveryNetwork, getDeliveryNetworkCapabilities, resolveFairSharePerUser } from '../core/delivery/networks.js'
import { degradeFor, serializeDeliveryReductions } from '../core/delivery/neutralOffer.js'
import { buildDeliveryFailureCode } from '../core/delivery/deliveryFailure.js'
import { planOutboxTick } from '../core/delivery/fairShare.js'
import { HEALTH_SIGNAL } from '../core/delivery/networkHealth.js'
import { shouldDropExpiredQueueJob, buildQueueExpiredReason } from '../core/queueExpiry.js'
import { recordOperationalSignal } from '../observability/operationalSignals.js'
import { resolveDestinationPreservation } from '../core/preservationConfig.js'
import { resolveSendWindow, sendWindowState } from '../core/sendWindow.js'
import { startOfSaoPauloDayUtc } from '../offerQueue/time.js'
import { writeDeliveryHistory as writeHistory } from '../domain/delivery/history.js'

export const OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  DONE: 'done',
  FAILED: 'failed',
  DROPPED: 'dropped',
})

const DEFAULT_INTERVAL_MS = 5_000
const BATCH_SIZE = 200
const DESTINATIONS_PER_TICK = 500
const MAX_ATTEMPTS = 6
// Destino sem "idade máxima na fila" configurada: oferta mais velha que isto
// não sai mais (preço e estoque mudam). O WhatsApp sem configuração não
// descarta por idade; aqui a espera pode ser longa (aplicativo fora do ar),
// então existe um teto.
export const DEFAULT_OUTBOX_MAX_AGE_MIN = 180
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const STUCK_SENDING_MS = 10 * 60 * 1000

function resolveIntervalMs(env) {
  const n = Number.parseInt(String(env?.DELIVERY_OUTBOX_SWEEP_INTERVAL_MS ?? ''), 10)
  return Number.isFinite(n) && n >= 1000 ? n : DEFAULT_INTERVAL_MS
}

function parseOffer(row) {
  try { return JSON.parse(row.offerJson || '{}') } catch { return {} }
}

/**
 * Uma passada da drenagem para UM aplicativo. Exportada para teste.
 *
 * @param {object} deps
 * @param {string} deps.deliveryNetwork
 * @param {object} [deps.db]
 * @param {object} [deps.adapter] - default: o registrado para a rede
 * @param {(userId: string) => Promise<boolean>} deps.canUseMultiNetwork
 * @param {{ record: Function }} [deps.health]
 * @param {(event: object) => void} [deps.track]
 */
export async function runDeliveryOutboxTick({
  deliveryNetwork,
  db = defaultDb,
  adapter = getDeliveryNetwork(deliveryNetwork),
  canUseMultiNetwork,
  health = null,
  track = () => {},
  now = () => Date.now(),
  env = process.env,
  intervalMs = DEFAULT_INTERVAL_MS,
} = {}) {
  const summary = { enviados: 0, adiados: 0, descartados: 0, falhas: 0, paradoCedo: false, podados: 0 }
  if (!adapter) return summary
  const caps = getDeliveryNetworkCapabilities(deliveryNetwork)
  const t0 = now()

  // Item preso em "enviando" (processo caiu no meio do envio). A entrega pode
  // ter saído — o aplicativo não confirma — e reenviar arrisca DUPLICAR no
  // grupo da cliente (revisão crítica, item 4). Vira "entrega incerta" no
  // histórico, com motivo próprio; nunca volta para a fila.
  const stuck = await db.deliveryOutbox.findMany({
    where: { deliveryNetwork, status: OUTBOX_STATUS.SENDING, updatedAt: { lt: new Date(t0 - STUCK_SENDING_MS) } },
    take: BATCH_SIZE,
  })
  for (const row of stuck) {
    const errorMsg = buildDeliveryFailureCode(deliveryNetwork, 'entrega_incerta')
    await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.FAILED, lastError: errorMsg } }).catch(() => {})
    await writeHistory(db, row, parseOffer(row), { status: 'error', errorMsg })
  }

  // 1. Selecionar: a pendente mais antiga de CADA grupo (revisão crítica,
  // item 7). Pegar as 200 mais antigas de todo mundo deixava uma conta com
  // fila grande ocupar o lote inteiro e as outras contas esperando a vez por
  // minutos. Só sai uma por grupo por passada mesmo (fairShare.js).
  const rows = await db.deliveryOutbox.findMany({
    where: {
      deliveryNetwork,
      status: OUTBOX_STATUS.PENDING,
      OR: [{ notBeforeAt: null }, { notBeforeAt: { lte: new Date(t0) } }],
    },
    orderBy: { enqueuedAt: 'asc' },
    distinct: ['destinationId'],
    take: DESTINATIONS_PER_TICK,
  })

  // 2. Repartir com justiça sob o orçamento global do robô.
  const perSecond = caps?.rateLimits?.globalPerSecond
  const globalBudget = Number.isFinite(perSecond) ? Math.max(1, Math.floor(perSecond * (intervalMs / 1000))) : null
  const plan = planOutboxTick(rows, { perUserCap: resolveFairSharePerUser(env), globalBudget, now: t0, retryInMs: intervalMs })
  for (const { row, notBeforeAt } of plan.deferred) {
    await db.deliveryOutbox.update({ where: { id: row.id }, data: { notBeforeAt } }).catch(() => {})
    summary.adiados++
  }

  const planCache = new Map()
  const allowed = async (userId) => {
    if (!planCache.has(userId)) planCache.set(userId, Boolean(await canUseMultiNetwork(userId)))
    return planCache.get(userId)
  }

  for (const row of plan.send) {
    // Em que ponto o item estava quando algo falhou. Depois que o aplicativo
    // aceitou a oferta, o item NUNCA volta para a fila (revisão crítica,
    // item 4): voltar significaria reenviar a cada minuto, por horas, se o
    // banco estiver ocupado na hora de gravar "entregue".
    const ctx = { entregue: false }
    try {
      const outcome = await processRow(row, { db, adapter, caps, deliveryNetwork, allowed, health, track, now, ctx })
      summary[outcome.resumo]++
      if (outcome.pararTick) {
        summary.paradoCedo = true
        break
      }
    } catch (err) {
      // Isolamento por item: o lote segue.
      logger.warn({ err: err?.message, outboxId: row.id, entregue: ctx.entregue }, 'caixa de saída: item falhou; lote segue')
      if (ctx.entregue) {
        summary.enviados++
        await markDoneWithRetry(db, row.id)
      } else {
        summary.falhas++
        await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.PENDING, notBeforeAt: new Date(now() + 60_000) } }).catch(() => {})
      }
    }
  }

  // Poda por idade.
  const pruned = await db.deliveryOutbox.deleteMany({
    where: {
      status: { in: [OUTBOX_STATUS.DONE, OUTBOX_STATUS.DROPPED, OUTBOX_STATUS.FAILED] },
      updatedAt: { lt: new Date(t0 - PRUNE_AFTER_MS) },
    },
  }).catch(() => ({ count: 0 }))
  summary.podados = pruned?.count ?? 0
  return summary
}

async function drop(db, row, offer, errorMsg) {
  await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.DROPPED, lastError: errorMsg } })
  await writeHistory(db, row, offer, { status: 'skipped', errorMsg })
  return { resumo: 'descartados' }
}

// Gravar "entregue" com novas tentativas curtas (banco ocupado). Se mesmo
// assim falhar, o item fica em "enviando" e a recuperação acima o marca como
// "entrega incerta" — nunca é reenviado.
async function markDoneWithRetry(db, id, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      await db.deliveryOutbox.update({ where: { id }, data: { status: OUTBOX_STATUS.DONE, lastError: null } })
      return true
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)))
    }
  }
  return false
}

const DAY_MS = 24 * 60 * 60 * 1000
const GROUP_REFUSAL_CODES = ['robo_nao_adicionado', 'destino_apagado']

async function deferRow(db, row, untilMs) {
  await db.deliveryOutbox.update({ where: { id: row.id }, data: { notBeforeAt: new Date(untilMs) } })
  return { resumo: 'adiados' }
}

async function destinationSendLimits(db, userId, group) {
  const [preset, defaultPreset] = await Promise.all([
    group?.preservationPresetId ? db.preservationPreset?.findFirst?.({ where: { id: group.preservationPresetId, userId } }) : null,
    db.preservationPreset?.findFirst?.({ where: { userId, isDefault: true } }),
  ].map((p) => Promise.resolve(p).catch(() => null)))
  return resolveDestinationPreservation(group, { preset: preset ?? null, defaultPreset: defaultPreset ?? null })
}

async function recentlyRefusedByGroup(db, destinationId, deliveryNetwork, streak = 3) {
  const last = await db.deliveryOutbox.findMany({
    where: { destinationId, deliveryNetwork, status: { in: [OUTBOX_STATUS.DONE, OUTBOX_STATUS.FAILED] } },
    orderBy: { updatedAt: 'desc' },
    take: streak,
    select: { status: true, lastError: true },
  })
  if (last.length < streak) return false
  return last.every((r) => r.status === OUTBOX_STATUS.FAILED && GROUP_REFUSAL_CODES.some((code) => String(r.lastError ?? '').endsWith(`:${code}`)))
}

async function processRow(row, { db, adapter, caps, deliveryNetwork, allowed, health, track, now, ctx = {} }) {
  const offer = parseOffer(row)
  const group = await db.group.findFirst({
    where: { userId: row.userId, waJid: row.destinationId, role: 'post', deliveryNetwork },
  })

  // 3. Idade.
  const expiry = shouldDropExpiredQueueJob({
    enqueuedAt: new Date(row.enqueuedAt).getTime(),
    queueMaxAgeMin: group?.queueMaxAgeMin ?? DEFAULT_OUTBOX_MAX_AGE_MIN,
    now: now(),
  })
  if (expiry.drop) return drop(db, row, offer, buildQueueExpiredReason(expiry))

  // 4. Revalidar: destino ainda existe, plano ainda dá direito, aplicativo
  // ainda ligado na conta.
  if (!group) return drop(db, row, offer, 'skip:dest_unlinked')
  if (!(await allowed(row.userId))) return drop(db, row, offer, buildDeliveryFailureCode(deliveryNetwork, 'plano_pausado'))
  const link = await db.deliveryNetworkLink.findUnique({
    where: { userId_deliveryNetwork: { userId: row.userId, deliveryNetwork } },
    select: { disabledAt: true },
  })
  if (link?.disabledAt) return drop(db, row, offer, buildDeliveryFailureCode(deliveryNetwork, 'aplicativo_desligado'))

  // Revisão crítica, item 12: o horário de envio e o limite diário que a
  // cliente configurou para o destino valem também no Telegram (mesma
  // preservação efetiva do WhatsApp: destino → preset → preset padrão).
  // Fora do horário ou com o limite do dia batido, ADIA — nunca descarta; a
  // idade máxima continua valendo.
  const limits = await destinationSendLimits(db, row.userId, group)
  const nowMs = now()
  const window = resolveSendWindow(limits)
  if (window) {
    const state = sendWindowState(nowMs, window)
    if (!state.open) return deferRow(db, row, nowMs + state.waitMs)
  }
  const dailyCap = Number(limits.dailyCap)
  if (Number.isFinite(dailyCap) && dailyCap > 0) {
    const dayStart = startOfSaoPauloDayUtc(new Date(nowMs))
    const sentToday = await db.messageLog.count({
      where: { userId: row.userId, destGroup: row.destinationId, status: 'success', sentAt: { gte: dayStart } },
    })
    if (sentToday >= dailyCap) return deferRow(db, row, dayStart.getTime() + DAY_MS + 60_000)
  }

  // Revisão crítica, item 14: robô tirado do grupo (ou grupo apagado) três
  // vezes seguidas — não tenta mais enviar a cada oferta. Confere a prontidão
  // (no máximo uma consulta por minuto por grupo) e, enquanto não voltar,
  // registra a falha com o mesmo motivo, sem chamar o envio.
  if (typeof adapter.checkDestination === 'function' && await recentlyRefusedByGroup(db, row.destinationId, deliveryNetwork)) {
    const readiness = await adapter.checkDestination(row.destinationId)
    if (!readiness?.pronto && readiness?.motivo) {
      const errorMsg = buildDeliveryFailureCode(deliveryNetwork, readiness.motivo)
      await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.FAILED, lastError: errorMsg } })
      await writeHistory(db, row, offer, { status: 'error', errorMsg })
      return { resumo: 'falhas' }
    }
  }

  // Anti-repetição por destino (Fatia 4): o espelhamento manda a janela que
  // valeria para este destino (cupom: curta). O mesmo link já entregue NESTE
  // grupo dentro da janela não sai de novo. É por destino — um envio no
  // WhatsApp nunca bloqueia o Telegram, nem o contrário (FR-023).
  const janelaMs = Number(offer?.janelaRepeticaoMs)
  const linkConvertido = String(offer?.linkConvertido ?? '')
  if (linkConvertido && Number.isFinite(janelaMs) && janelaMs > 0) {
    const recent = await db.messageLog.findFirst({
      where: { userId: row.userId, destGroup: row.destinationId, convertedUrl: linkConvertido, status: 'success', sentAt: { gte: new Date(now() - janelaMs) } },
      select: { id: true },
    })
    if (recent) return drop(db, row, offer, 'skip:dedup_recent_link')
  }

  // 5. Degradar.
  const { oferta, reducoes } = degradeFor(offer, caps)
  let reductions = serializeDeliveryReductions(reducoes)

  // 6. Enviar.
  await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.SENDING, attempts: { increment: 1 } } })
  const result = await adapter.send(oferta, row.destinationId, { userId: row.userId })

  if (result?.ok) {
    ctx.entregue = true
    // O próprio envio pode ter reduzido a oferta (ex.: a foto não baixou e
    // ela saiu só com o texto) — fica registrado, nunca em silêncio.
    if (Array.isArray(result.reducoes) && result.reducoes.length) {
      reductions = serializeDeliveryReductions([...new Set([...reducoes, ...result.reducoes])])
    }
    await markDoneWithRetry(db, row.id)
    await writeHistory(db, row, offer, { status: 'success', reducoes: reductions })
    health?.record(deliveryNetwork, HEALTH_SIGNAL.OK)
    if (reductions) {
      recordOperationalSignal('delivery_degraded', { deliveryNetwork, reductions })
      track({ userId: row.userId, event: 'ops_delivery_degraded', metadata: { deliveryNetwork, reductions } })
    }
    return { resumo: 'enviados' }
  }

  const errorMsg = buildDeliveryFailureCode(deliveryNetwork, result?.motivo)
  if (result?.sinal) health?.record(deliveryNetwork, result.sinal, now(), result.sinal === HEALTH_SIGNAL.LIMITE ? row.destinationId : null)
  const attempts = Number(row.attempts ?? 0) + 1

  // Temporário: volta para a fila com espera (adiar nunca é descartar), até
  // o limite de tentativas — o teto de idade ainda vale nas próximas.
  if (result?.temporario && attempts < MAX_ATTEMPTS) {
    const waitMs = Math.max(1, Number(result.retryAfterSec ?? 30)) * 1000
    await db.deliveryOutbox.update({
      where: { id: row.id },
      data: { status: OUTBOX_STATUS.PENDING, notBeforeAt: new Date(now() + waitMs), lastError: errorMsg },
    })
    const robotDown = result.sinal === HEALTH_SIGNAL.INDISPONIVEL || result.sinal === HEALTH_SIGNAL.BLOQUEADO
    return { resumo: 'adiados', pararTick: robotDown }
  }

  await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.FAILED, lastError: errorMsg } })
  await writeHistory(db, row, offer, { status: 'error', errorMsg })
  return { resumo: 'falhas' }
}

/**
 * Liga a drenagem. Não liga (e não loga erro) sem o aplicativo registrado —
 * o registro só acontece com a rede habilitada e o segredo do robô presente.
 */
export function startDeliveryOutboxSweep({ deliveryNetwork, db = defaultDb, env = process.env, ...deps } = {}) {
  if (!getDeliveryNetwork(deliveryNetwork)) return null
  const intervalMs = resolveIntervalMs(env)
  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await runDeliveryOutboxTick({ deliveryNetwork, db, env, intervalMs, ...deps })
    } catch (err) {
      logger.warn({ err: err?.message, deliveryNetwork }, 'caixa de saída: passada falhou')
    } finally {
      running = false
    }
  }, intervalMs)
  timer.unref?.()
  return { stop: () => clearInterval(timer) }
}

/**
 * Faxina para quando o aplicativo está DESLIGADO no servidor (interruptor
 * fora da lista ou sem o segredo do robô). Os robôs do WhatsApp leem o
 * interruptor quando ligam, então podem continuar entregando ofertas à caixa
 * de saída até o próximo reinício deles. Sem drenagem, essas linhas
 * ficariam pendentes para sempre: aqui, passada a idade máxima, elas são
 * descartadas com motivo próprio no histórico — nunca "entregues".
 */
export async function runDeliveryOutboxJanitorTick({ deliveryNetwork, db = defaultDb, now = () => Date.now() } = {}) {
  const t0 = now()
  const stale = await db.deliveryOutbox.findMany({
    where: {
      deliveryNetwork,
      status: { in: [OUTBOX_STATUS.PENDING, OUTBOX_STATUS.SENDING] },
      enqueuedAt: { lt: new Date(t0 - DEFAULT_OUTBOX_MAX_AGE_MIN * 60_000) },
    },
    take: BATCH_SIZE,
  })
  const errorMsg = buildDeliveryFailureCode(deliveryNetwork, 'robo_indisponivel')
  for (const row of stale) {
    try {
      await drop(db, row, parseOffer(row), errorMsg)
    } catch (err) {
      logger.warn({ err: err?.message, outboxId: row.id }, 'caixa de saída: faxina falhou num item; seguindo')
    }
  }
  const pruned = await db.deliveryOutbox.deleteMany({
    where: {
      status: { in: [OUTBOX_STATUS.DONE, OUTBOX_STATUS.DROPPED, OUTBOX_STATUS.FAILED] },
      updatedAt: { lt: new Date(t0 - PRUNE_AFTER_MS) },
    },
  }).catch(() => ({ count: 0 }))
  return { descartados: stale.length, podados: pruned?.count ?? 0 }
}

export function startDeliveryOutboxJanitor({ deliveryNetwork, db = defaultDb, intervalMs = 10 * 60_000 } = {}) {
  const timer = setInterval(() => {
    runDeliveryOutboxJanitorTick({ deliveryNetwork, db }).catch((err) => logger.warn({ err: err?.message, deliveryNetwork }, 'caixa de saída: faxina falhou'))
  }, intervalMs)
  timer.unref?.()
  return { stop: () => clearInterval(timer) }
}
