// Sincronização de promoções de UMA conta Awin. Usa só as credenciais dessa
// conta; erro aqui nunca afeta outra conta (o agendador chama uma por vez).
//
// Regras (docs/rca/afiliados-awin.md):
// - filtros fixos: type=promotion (cupons/vouchers fora), membership=joined
//   (só lojas em que a cliente foi aprovada), regionCodes=["BR"]; dois
//   status: active e upcoming (as de amanhã chegam antes da meia-noite).
// - página a página (no máximo 200 itens em memória por vez), upsert por
//   (conta, promotionId).
// - promoção que SUMIU da Awin só vira "expired" quando a execução leu tudo
//   até o fim. Execução parcial (erro no meio, teto de páginas) só vence as
//   que passaram do endDate — nunca apaga por ausência sem ter lido tudo.
// - 401/403 → conta "invalid_credential", para de agendar até salvar código
//   novo. 429 → reagenda. Outro erro → tenta de novo em 15 min.

import dbDefault from '../../db.js'
import { decryptCredential } from '../../credentialCrypto.js'
import { getDefaultAwinClient, AWIN_MAX_PAGE_SIZE } from './client.js'
import { extractProgrammes } from './storeMatcher.js'
import { AWIN_LINK_RETENTION_MS } from './conversionContext.js'
import { AwinAuthError, AwinRateLimitError, AwinResponseError } from './errors.js'
import { extractPromotionPage, translatePromotion } from './translate.js'
import { AWIN_ACCOUNT_STATUS, AWIN_MESSAGES } from './accountService.js'

export const AWIN_SYNC_PROMOTION_STATUSES = Object.freeze(['active', 'upcoming'])
export const AWIN_MAX_PAGES_PER_STATUS = 25
export const AWIN_RETRY_AFTER_ERROR_MS = 15 * 60_000
export const AWIN_RETRY_AFTER_RATE_LIMIT_MS = 5 * 60_000
export const AWIN_EXPIRED_RETENTION_MS = 30 * 24 * 60 * 60_000
export const AWIN_SYNC_RUNS_KEPT = 50
const MAX_ERRORS = 5

const SKIP_REASON_TEXT = {
  not_promotion: 'não eram promoções (cupons ficam de fora)',
  missing_link: 'vieram sem link',
  missing_title: 'vieram sem título',
  missing_id: 'vieram sem identificação',
  missing_advertiser: 'vieram sem a loja',
  not_brazil: 'não valem no Brasil',
  invalid: 'vieram em formato estranho',
}

const runningAccounts = new Set()

export function isAwinAccountSyncing(accountId) {
  return runningAccounts.has(accountId)
}

function buildFilters(status) {
  return { type: 'promotion', status, membership: 'joined', regionCodes: ['BR'] }
}

async function upsertPage({ db, account, runId, items, counters, skipReasons }) {
  const records = []
  for (const raw of items) {
    const result = translatePromotion(raw)
    if (!result.ok) {
      counters.skipped++
      skipReasons.set(result.reason, (skipReasons.get(result.reason) || 0) + 1)
      continue
    }
    records.push(result.record)
  }
  if (!records.length) return
  const existing = await db.awinPromotion.findMany({
    where: { accountId: account.id, promotionId: { in: records.map((record) => record.promotionId) } },
    select: { promotionId: true },
  })
  const known = new Set(existing.map((row) => row.promotionId))
  await db.$transaction(records.map((record) => db.awinPromotion.upsert({
    where: { accountId_promotionId: { accountId: account.id, promotionId: record.promotionId } },
    create: { ...record, userId: account.userId, accountId: account.id, status: 'active', lastSeenRunId: runId },
    update: { ...record, status: 'active', expiredAt: null, lastSeenRunId: runId },
  })))
  for (const record of records) {
    if (known.has(record.promotionId)) counters.updated++
    else { counters.inserted++; known.add(record.promotionId) }
  }
}

async function syncStatus({ db, client, account, token, runId, status, counters, skipReasons, maxPages }) {
  let seen = 0
  for (let page = 1; page <= maxPages; page++) {
    const body = await client.listPromotions(token, account.publisherId, { filters: buildFilters(status), page, pageSize: AWIN_MAX_PAGE_SIZE })
    const parsed = extractPromotionPage(body)
    if (!parsed) throw new AwinResponseError()
    counters.pages++
    await upsertPage({ db, account, runId, items: parsed.items, counters, skipReasons })
    seen += parsed.items.length
    if (parsed.items.length < AWIN_MAX_PAGE_SIZE) return true
    if (parsed.total != null && seen >= parsed.total) return true
  }
  return false
}

function describeFailure(error) {
  if (error instanceof AwinAuthError) return AWIN_MESSAGES.auth
  if (error instanceof AwinRateLimitError) return AWIN_MESSAGES.rateLimited
  return AWIN_MESSAGES.unavailable
}

// Lojas aprovadas (joined, BR) → AwinProgramme. 1 chamada por execução.
// Loja que sumiu da lista (a cliente saiu ou foi removida) é apagada: sem ela,
// o link daquela loja volta a ser tratado como loja não aprovada. Resposta
// estranha não apaga nada. Devolve quantas lojas ficaram (null = não leu).
async function syncProgrammes({ db, client, account, token, runId }) {
  const body = await client.listProgrammes(token, account.publisherId, { relationship: 'joined', countryCode: 'BR' })
  const stores = extractProgrammes(body)
  if (!stores) return null
  for (const store of stores) {
    const data = { name: store.name, displayUrl: store.displayUrl, domainsJson: JSON.stringify(store.domains), lastSeenRunId: runId }
    await db.awinProgramme.upsert({
      where: { accountId_advertiserId: { accountId: account.id, advertiserId: store.advertiserId } },
      create: { ...data, userId: account.userId, accountId: account.id, advertiserId: store.advertiserId },
      update: data,
    })
  }
  await db.awinProgramme.deleteMany({
    where: { accountId: account.id, OR: [{ lastSeenRunId: null }, { lastSeenRunId: { not: runId } }] },
  })
  return stores.length
}

export async function syncAwinAccount(accountId, deps = {}) {
  if (runningAccounts.has(accountId)) return { skipped: 'busy' }
  runningAccounts.add(accountId)
  try {
    const db = deps.db ?? dbDefault
    const client = deps.client ?? getDefaultAwinClient()
    const now = deps.now ?? (() => new Date())
    const decrypt = deps.decrypt ?? decryptCredential
    const trigger = deps.trigger === 'manual' ? 'manual' : 'schedule'
    const maxPages = deps.maxPagesPerStatus ?? AWIN_MAX_PAGES_PER_STATUS

    const account = await db.awinAccount.findUnique({ where: { id: accountId } })
    if (!account) return { skipped: 'not_found' }
    if (trigger === 'schedule' && (!account.syncEnabled || account.status === AWIN_ACCOUNT_STATUS.INVALID_CREDENTIAL)) {
      return { skipped: 'not_schedulable' }
    }

    const startedAt = now()
    const run = await db.awinSyncRun.create({ data: { userId: account.userId, accountId: account.id, trigger, status: 'running', startedAt } })
    const counters = { pages: 0, inserted: 0, updated: 0, skipped: 0, expired: 0 }
    const skipReasons = new Map()
    let complete = true
    let failure = null
    let programmes = null
    let programmesError = null

    try {
      const token = decrypt(account.tokenEncrypted)
      for (const status of AWIN_SYNC_PROMOTION_STATUSES) {
        const finished = await syncStatus({ db, client, account, token, runId: run.id, status, counters, skipReasons, maxPages })
        if (!finished) complete = false
      }
      // Lojas para a conversão de links. Falha aqui não derruba as promoções
      // já lidas (as lojas antigas continuam valendo); código vencido sim.
      try {
        programmes = await syncProgrammes({ db, client, account, token, runId: run.id })
      } catch (error) {
        if (error instanceof AwinAuthError || error instanceof AwinRateLimitError) throw error
        programmesError = error
      }
    } catch (error) {
      failure = error
      complete = false
    }

    const finishedAt = now()
    // Vencidas pela data valem sempre; "sumiu da Awin" só com leitura completa.
    const expiredByDate = await db.awinPromotion.updateMany({
      where: { accountId: account.id, status: 'active', endDate: { lt: finishedAt } },
      data: { status: 'expired', expiredAt: finishedAt },
    })
    counters.expired += expiredByDate.count
    if (complete) {
      const expiredByAbsence = await db.awinPromotion.updateMany({
        where: { accountId: account.id, status: 'active', OR: [{ lastSeenRunId: null }, { lastSeenRunId: { not: run.id } }] },
        data: { status: 'expired', expiredAt: finishedAt },
      })
      counters.expired += expiredByAbsence.count
    }

    await db.awinPromotion.deleteMany({
      where: { accountId: account.id, status: 'expired', expiredAt: { lt: new Date(finishedAt.getTime() - AWIN_EXPIRED_RETENTION_MS) } },
    })

    // Links convertidos sem uso há 90 dias saem do cache (o link em si continua
    // valendo na Awin; só não é mais reaproveitado).
    await db.awinLink.deleteMany({
      where: { accountId: account.id, lastUsedAt: { lt: new Date(finishedAt.getTime() - AWIN_LINK_RETENTION_MS) } },
    })

    const errors = []
    if (failure) errors.push({ message: describeFailure(failure) })
    if (programmesError) errors.push({ message: `Não deu para atualizar a lista de lojas aprovadas: ${describeFailure(programmesError)}` })
    for (const [reason, count] of skipReasons) {
      if (errors.length >= MAX_ERRORS) break
      errors.push({ message: `${count} ${count === 1 ? 'promoção foi ignorada porque' : 'promoções foram ignoradas porque'} ${SKIP_REASON_TEXT[reason] || SKIP_REASON_TEXT.invalid}` })
    }

    let runStatus
    const accountUpdate = { lastSyncAt: finishedAt }
    if (failure instanceof AwinAuthError) {
      runStatus = 'invalid_credential'
      Object.assign(accountUpdate, { status: AWIN_ACCOUNT_STATUS.INVALID_CREDENTIAL, statusDetail: AWIN_MESSAGES.auth, nextSyncAt: null })
    } else if (failure instanceof AwinRateLimitError) {
      runStatus = 'rate_limited'
      const wait = Math.max(AWIN_RETRY_AFTER_RATE_LIMIT_MS, Number(failure.retryAfterMs) || 0)
      Object.assign(accountUpdate, { nextSyncAt: new Date(finishedAt.getTime() + wait) })
    } else if (failure) {
      runStatus = 'failed'
      Object.assign(accountUpdate, { status: AWIN_ACCOUNT_STATUS.ERROR, statusDetail: describeFailure(failure), nextSyncAt: new Date(finishedAt.getTime() + AWIN_RETRY_AFTER_ERROR_MS) })
    } else {
      runStatus = complete ? 'success' : 'partial'
      Object.assign(accountUpdate, { status: AWIN_ACCOUNT_STATUS.OK, statusDetail: null, nextSyncAt: new Date(finishedAt.getTime() + Math.max(15, account.syncIntervalMinutes || 60) * 60_000) })
    }
    accountUpdate.lastSyncStatus = runStatus

    await db.awinSyncRun.update({
      where: { id: run.id },
      data: { status: runStatus, ...counters, errorsJson: JSON.stringify(errors.slice(0, MAX_ERRORS)), finishedAt },
    })
    await db.awinAccount.update({ where: { id: account.id }, data: accountUpdate })

    const old = await db.awinSyncRun.findMany({
      where: { accountId: account.id },
      orderBy: { startedAt: 'desc' },
      skip: AWIN_SYNC_RUNS_KEPT,
      select: { id: true },
    })
    if (old.length) await db.awinSyncRun.deleteMany({ where: { id: { in: old.map((row) => row.id) } } })

    return { runId: run.id, status: runStatus, ...counters, programmes, errors: errors.slice(0, MAX_ERRORS) }
  } finally {
    runningAccounts.delete(accountId)
  }
}
