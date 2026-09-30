// Sincronização das promoções de UMA conta Rakuten. Usa só os dados dessa
// conta; erro aqui nunca afeta outra conta (o agendador chama uma por vez).
// Espelho de src/integrations/awin/syncService.js.
//
// Regras (docs/rca/afiliados-rakuten.md):
// - fonte: feed de ofertas /coupon/1.0 da rede Brasil (8). A Rakuten só
//   devolve lojas em que a cliente foi APROVADA (medido em 2026-09-30).
//   Oferta com cupom entra (o código vai na mensagem).
// - página a página (até 500 itens em memória por vez), upsert por
//   (conta, promotionId).
// - logo e site da loja: 1 chamada por loja NOVA (/v2/advertisers/{id});
//   loja já conhecida reaproveita o que está no banco. O logo é a foto da
//   oferta — sem foto, o WhatsApp abriria o link de rastreio a partir do
//   servidor para montar a prévia (clique falso vindo da VPS).
// - lojas aprovadas (Link Locator) → RakutenProgramme e o `id` dos links da
//   cliente (do clickurl) → RakutenAccount.linkId: base da conversão de links.
// - promoção que SUMIU do feed só vira "expired" quando a execução leu tudo
//   até o fim. Execução parcial só vence as que passaram do endDate.
// - dados recusados → conta "invalid_credential", para de agendar até
//   salvar dados novos. 429 → reagenda. Outro erro → tenta de novo em 15 min.

import dbDefault from '../../db.js'
import { decryptCredential } from '../../credentialCrypto.js'
import { getDefaultRakutenClient, RAKUTEN_MAX_PAGE_SIZE } from './client.js'
import { RakutenAuthError, RakutenRateLimitError, RakutenResponseError } from './errors.js'
import { extractAdvertiser, extractCouponPage, translateCoupon } from './translate.js'
import { extractApprovedMerchants, extractRakutenLinkId, storeDomainsFromUrl } from './storeMatcher.js'
import { RAKUTEN_ACCOUNT_STATUS, RAKUTEN_MESSAGES } from './accountService.js'

export const RAKUTEN_MAX_PAGES = 20
export const RAKUTEN_MAX_NEW_ADVERTISERS_PER_RUN = 30
// Lojas aprovadas SEM site conhecido: quantas perguntamos por execução (o
// resto fica para a próxima hora; loja sem domínio só converte link da
// própria Rakuten com `mid`).
export const RAKUTEN_MAX_PROGRAMME_LOOKUPS_PER_RUN = 30
export const RAKUTEN_RETRY_AFTER_ERROR_MS = 15 * 60_000
export const RAKUTEN_RETRY_AFTER_RATE_LIMIT_MS = 5 * 60_000
export const RAKUTEN_EXPIRED_RETENTION_MS = 30 * 24 * 60 * 60_000
export const RAKUTEN_SYNC_RUNS_KEPT = 50
const MAX_ERRORS = 5

const SKIP_REASON_TEXT = {
  missing_link: 'vieram sem link',
  missing_title: 'vieram sem título',
  missing_advertiser: 'vieram sem a loja',
  invalid: 'vieram em formato estranho',
}

const runningAccounts = new Set()

export function isRakutenAccountSyncing(accountId) {
  return runningAccounts.has(accountId)
}

export function decryptRakutenCreds(account, decrypt = decryptCredential) {
  return {
    clientId: decrypt(account.clientIdEncrypted),
    clientSecret: decrypt(account.clientSecretEncrypted),
    sid: account.sid,
  }
}

async function upsertPage({ db, account, runId, items, counters, skipReasons }) {
  const byId = new Map()
  for (const raw of items) {
    const result = translateCoupon(raw)
    if (!result.ok) {
      counters.skipped++
      skipReasons.set(result.reason, (skipReasons.get(result.reason) || 0) + 1)
      continue
    }
    byId.set(result.record.promotionId, result.record)
  }
  const records = [...byId.values()]
  if (!records.length) return []
  const existing = await db.rakutenPromotion.findMany({
    where: { accountId: account.id, promotionId: { in: records.map((record) => record.promotionId) } },
    select: { promotionId: true },
  })
  const known = new Set(existing.map((row) => row.promotionId))
  await db.$transaction(records.map((record) => db.rakutenPromotion.upsert({
    where: { accountId_promotionId: { accountId: account.id, promotionId: record.promotionId } },
    create: { ...record, userId: account.userId, accountId: account.id, status: 'active', lastSeenRunId: runId },
    update: { ...record, status: 'active', expiredAt: null, lastSeenRunId: runId },
  })))
  for (const record of records) {
    if (known.has(record.promotionId)) counters.updated++
    else { counters.inserted++; known.add(record.promotionId) }
  }
  return records
}

// Logo/site da loja: reaproveita o que já está no banco; pergunta à Rakuten
// só pelas lojas sem logo (teto por execução). Falha aqui nunca derruba o
// sync — a promoção sai sem foto, como a Awin v1.
async function fillAdvertiserInfo({ db, client, account, creds, advertiserIds }) {
  if (!advertiserIds.size) return 0
  const ids = [...advertiserIds]
  const known = await db.rakutenPromotion.findMany({
    where: { accountId: account.id, advertiserId: { in: ids }, logoUrl: { not: null } },
    select: { advertiserId: true, logoUrl: true, storeUrl: true },
    distinct: ['advertiserId'],
  })
  const info = new Map(known.map((row) => [row.advertiserId, { logoUrl: row.logoUrl, storeUrl: row.storeUrl }]))
  let asked = 0
  for (const id of ids) {
    if (info.has(id) || asked >= RAKUTEN_MAX_NEW_ADVERTISERS_PER_RUN) continue
    asked++
    try {
      const advertiser = extractAdvertiser(await client.getAdvertiser(creds, id))
      if (advertiser?.logoUrl || advertiser?.storeUrl) info.set(id, { logoUrl: advertiser.logoUrl, storeUrl: advertiser.storeUrl })
    } catch (error) {
      if (error instanceof RakutenAuthError || error instanceof RakutenRateLimitError) throw error
    }
  }
  for (const [advertiserId, data] of info) {
    await db.rakutenPromotion.updateMany({
      where: { accountId: account.id, advertiserId, logoUrl: null },
      data: { logoUrl: data.logoUrl ?? null, storeUrl: data.storeUrl ?? null },
    })
  }
  return asked
}

// Lojas aprovadas (Link Locator) → RakutenProgramme. Base da conversão de
// links. Site/domínio: o que já está guardado (programa ou promoção) ou 1
// chamada por loja nova (teto por execução). Loja que sumiu da lista é
// apagada; resposta estranha não apaga nada. Devolve quantas lojas ficaram
// (null = não leu).
async function syncProgrammes({ db, client, account, creds, runId }) {
  if (typeof client.listApprovedMerchants !== 'function') return null
  const merchants = extractApprovedMerchants(await client.listApprovedMerchants(creds))
  if (!merchants) return null
  const ids = merchants.map((merchant) => merchant.advertiserId)
  const knownProgrammes = await db.rakutenProgramme.findMany({
    where: { accountId: account.id, advertiserId: { in: ids } },
    select: { advertiserId: true, storeUrl: true },
  })
  const storeUrls = new Map(knownProgrammes.filter((row) => row.storeUrl).map((row) => [row.advertiserId, row.storeUrl]))
  const fromPromotions = await db.rakutenPromotion.findMany({
    where: { accountId: account.id, advertiserId: { in: ids.filter((id) => !storeUrls.has(id)) }, storeUrl: { not: null } },
    select: { advertiserId: true, storeUrl: true },
    distinct: ['advertiserId'],
  })
  for (const row of fromPromotions) storeUrls.set(row.advertiserId, row.storeUrl)
  let asked = 0
  for (const merchant of merchants) {
    if (storeUrls.has(merchant.advertiserId) || asked >= RAKUTEN_MAX_PROGRAMME_LOOKUPS_PER_RUN) continue
    asked++
    try {
      const advertiser = extractAdvertiser(await client.getAdvertiser(creds, merchant.advertiserId))
      if (advertiser?.storeUrl) storeUrls.set(merchant.advertiserId, advertiser.storeUrl)
    } catch (error) {
      if (error instanceof RakutenAuthError || error instanceof RakutenRateLimitError) throw error
    }
  }
  for (const merchant of merchants) {
    const storeUrl = storeUrls.get(merchant.advertiserId) ?? null
    const data = { name: merchant.name, storeUrl, domainsJson: JSON.stringify(storeDomainsFromUrl(storeUrl)), lastSeenRunId: runId }
    await db.rakutenProgramme.upsert({
      where: { accountId_advertiserId: { accountId: account.id, advertiserId: merchant.advertiserId } },
      create: { ...data, userId: account.userId, accountId: account.id, advertiserId: merchant.advertiserId },
      update: data,
    })
  }
  await db.rakutenProgramme.deleteMany({
    where: { accountId: account.id, OR: [{ lastSeenRunId: null }, { lastSeenRunId: { not: runId } }] },
  })
  return merchants.length
}

function describeFailure(error) {
  if (error instanceof RakutenAuthError) return RAKUTEN_MESSAGES.auth
  if (error instanceof RakutenRateLimitError) return RAKUTEN_MESSAGES.rateLimited
  return RAKUTEN_MESSAGES.unavailable
}

export async function syncRakutenAccount(accountId, deps = {}) {
  if (runningAccounts.has(accountId)) return { skipped: 'busy' }
  runningAccounts.add(accountId)
  try {
    const db = deps.db ?? dbDefault
    const client = deps.client ?? getDefaultRakutenClient()
    const now = deps.now ?? (() => new Date())
    const decrypt = deps.decrypt ?? decryptCredential
    const trigger = deps.trigger === 'manual' ? 'manual' : 'schedule'
    const maxPages = deps.maxPages ?? RAKUTEN_MAX_PAGES

    const account = await db.rakutenAccount.findUnique({ where: { id: accountId } })
    if (!account) return { skipped: 'not_found' }
    if (trigger === 'schedule' && (!account.syncEnabled || account.status === RAKUTEN_ACCOUNT_STATUS.INVALID_CREDENTIAL)) {
      return { skipped: 'not_schedulable' }
    }

    const startedAt = now()
    const run = await db.rakutenSyncRun.create({ data: { userId: account.userId, accountId: account.id, trigger, status: 'running', startedAt } })
    const counters = { pages: 0, inserted: 0, updated: 0, skipped: 0, expired: 0 }
    const skipReasons = new Map()
    let complete = false
    let failure = null
    let advertiserError = null
    let programmes = null
    let programmesError = null
    let linkId = null

    try {
      const creds = decryptRakutenCreds(account, decrypt)
      const advertiserIds = new Set()
      for (let page = 1; page <= maxPages; page++) {
        const parsed = extractCouponPage(await client.listCoupons(creds, { page, pageSize: RAKUTEN_MAX_PAGE_SIZE }))
        if (!parsed) throw new RakutenResponseError()
        counters.pages++
        const records = await upsertPage({ db, account, runId: run.id, items: parsed.items, counters, skipReasons })
        for (const record of records) {
          advertiserIds.add(record.advertiserId)
          linkId ||= extractRakutenLinkId(record.clickUrl)
        }
        const lastPage = parsed.totalPages ?? page
        if (!parsed.items.length || page >= lastPage) { complete = true; break }
      }
      try {
        await fillAdvertiserInfo({ db, client, account, creds, advertiserIds })
      } catch (error) {
        if (error instanceof RakutenAuthError) throw error
        advertiserError = error
      }
      // Lojas aprovadas: falha só aqui não derruba as promoções e mantém a
      // lista antiga (a conversão segue com ela).
      try {
        programmes = await syncProgrammes({ db, client, account, creds, runId: run.id })
      } catch (error) {
        if (error instanceof RakutenAuthError) throw error
        programmesError = error
      }
    } catch (error) {
      failure = error
      complete = false
    }

    const finishedAt = now()
    const expiredByDate = await db.rakutenPromotion.updateMany({
      where: { accountId: account.id, status: 'active', endDate: { lt: finishedAt } },
      data: { status: 'expired', expiredAt: finishedAt },
    })
    counters.expired += expiredByDate.count
    if (complete) {
      const expiredByAbsence = await db.rakutenPromotion.updateMany({
        where: { accountId: account.id, status: 'active', OR: [{ lastSeenRunId: null }, { lastSeenRunId: { not: run.id } }] },
        data: { status: 'expired', expiredAt: finishedAt },
      })
      counters.expired += expiredByAbsence.count
    }
    await db.rakutenPromotion.deleteMany({
      where: { accountId: account.id, status: 'expired', expiredAt: { lt: new Date(finishedAt.getTime() - RAKUTEN_EXPIRED_RETENTION_MS) } },
    })

    const errors = []
    if (failure) errors.push({ message: describeFailure(failure) })
    if (advertiserError) errors.push({ message: `Não deu para buscar o logo de algumas lojas: ${describeFailure(advertiserError)}` })
    if (programmesError) errors.push({ message: `Não deu para atualizar a lista de lojas aprovadas: ${describeFailure(programmesError)}` })
    for (const [reason, count] of skipReasons) {
      if (errors.length >= MAX_ERRORS) break
      errors.push({ message: `${count} ${count === 1 ? 'promoção foi ignorada porque' : 'promoções foram ignoradas porque'} ${SKIP_REASON_TEXT[reason] || SKIP_REASON_TEXT.invalid}` })
    }

    let runStatus
    const accountUpdate = { lastSyncAt: finishedAt }
    // Só troca quando achou: conta sem promoção nesta hora mantém o que tinha.
    if (linkId && linkId !== account.linkId) accountUpdate.linkId = linkId
    if (failure instanceof RakutenAuthError) {
      runStatus = 'invalid_credential'
      Object.assign(accountUpdate, { status: RAKUTEN_ACCOUNT_STATUS.INVALID_CREDENTIAL, statusDetail: RAKUTEN_MESSAGES.auth, nextSyncAt: null })
    } else if (failure instanceof RakutenRateLimitError) {
      runStatus = 'rate_limited'
      const wait = Math.max(RAKUTEN_RETRY_AFTER_RATE_LIMIT_MS, Number(failure.retryAfterMs) || 0)
      Object.assign(accountUpdate, { nextSyncAt: new Date(finishedAt.getTime() + wait) })
    } else if (failure) {
      runStatus = 'failed'
      Object.assign(accountUpdate, { status: RAKUTEN_ACCOUNT_STATUS.ERROR, statusDetail: describeFailure(failure), nextSyncAt: new Date(finishedAt.getTime() + RAKUTEN_RETRY_AFTER_ERROR_MS) })
    } else {
      runStatus = complete ? 'success' : 'partial'
      Object.assign(accountUpdate, { status: RAKUTEN_ACCOUNT_STATUS.OK, statusDetail: null, nextSyncAt: new Date(finishedAt.getTime() + Math.max(15, account.syncIntervalMinutes || 60) * 60_000) })
    }
    accountUpdate.lastSyncStatus = runStatus

    await db.rakutenSyncRun.update({
      where: { id: run.id },
      data: { status: runStatus, ...counters, errorsJson: JSON.stringify(errors.slice(0, MAX_ERRORS)), finishedAt },
    })
    await db.rakutenAccount.update({ where: { id: account.id }, data: accountUpdate })

    const old = await db.rakutenSyncRun.findMany({
      where: { accountId: account.id },
      orderBy: { startedAt: 'desc' },
      skip: RAKUTEN_SYNC_RUNS_KEPT,
      select: { id: true },
    })
    if (old.length) await db.rakutenSyncRun.deleteMany({ where: { id: { in: old.map((row) => row.id) } } })

    return { runId: run.id, status: runStatus, ...counters, programmes, errors: errors.slice(0, MAX_ERRORS) }
  } finally {
    runningAccounts.delete(accountId)
  }
}
