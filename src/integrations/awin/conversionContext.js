// Monta o que a conversão de links da Awin precisa para UMA cliente: contas
// (token decifrado só em memória), lojas aprovadas → matcher, e o cache de
// links (AwinLink). Usado pelo robô (loadConfig, relido a cada minuto) e pelas
// rotas de "Converter links" / "Criar oferta".
//
// Sem conta Awin utilizável → null: detector, sanitizador e conversão ficam
// exatamente como antes (nenhuma loja nova reconhecida).
//
// Memória: poucas dezenas de lojas × poucos domínios por cliente (KB).

import dbDefault from '../../db.js'
import { decryptCredential } from '../../credentialCrypto.js'
import { AWIN_ACCOUNT_STATUS } from './accountService.js'
import { createAwinStoreMatcher, isAwinShortUrl } from './storeMatcher.js'
import { resolveAwinShortUrlCached } from '../../converters/awin.js'

export const AWIN_LINK_RETENTION_MS = 90 * 24 * 60 * 60_000
const LAST_USED_REFRESH_MS = 24 * 60 * 60_000

function parseDomains(json) {
  try {
    const list = JSON.parse(json || '[]')
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function createAwinLinkStore({ db = dbDefault, userId, now = () => Date.now() } = {}) {
  return {
    async get({ accountId, advertiserId, destinationKey }) {
      const row = await db.awinLink.findUnique({
        where: { accountId_advertiserId_destinationKey: { accountId, advertiserId, destinationKey } },
      })
      if (row && now() - new Date(row.lastUsedAt).getTime() > LAST_USED_REFRESH_MS) {
        db.awinLink.update({ where: { id: row.id }, data: { lastUsedAt: new Date(now()) } }).catch(() => {})
      }
      return row
    },
    async save({ accountId, advertiserId, destinationKey, destinationUrl, shortUrl, longUrl }) {
      const at = new Date(now())
      const data = { destinationUrl: String(destinationUrl).slice(0, 2000), shortUrl: shortUrl || null, longUrl: String(longUrl).slice(0, 4000), lastUsedAt: at }
      await db.awinLink.upsert({
        where: { accountId_advertiserId_destinationKey: { accountId, advertiserId, destinationKey } },
        create: { ...data, userId, accountId, advertiserId, destinationKey, createdAt: at },
        update: { ...data, createdAt: at },
      })
    },
  }
}

export async function loadAwinConversionContext(userId, deps = {}) {
  const db = deps.db ?? dbDefault
  const decrypt = deps.decrypt ?? decryptCredential
  if (!userId) return null
  const accounts = await db.awinAccount.findMany({
    where: { userId, status: { not: AWIN_ACCOUNT_STATUS.INVALID_CREDENTIAL } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, publisherId: true, tokenEncrypted: true },
  })
  const accountsById = new Map()
  for (const account of accounts) {
    try {
      accountsById.set(account.id, { id: account.id, publisherId: account.publisherId, token: decrypt(account.tokenEncrypted) })
    } catch {
      // Token que não decifra = conta inutilizável aqui; as outras seguem.
    }
  }
  if (!accountsById.size) return null

  const programmes = await db.awinProgramme.findMany({
    where: { userId, accountId: { in: [...accountsById.keys()] } },
    select: { accountId: true, advertiserId: true, name: true, domainsJson: true },
  })
  // Mesma loja em duas contas: vale a conta cadastrada primeiro.
  const accountOrder = new Map([...accountsById.keys()].map((id, index) => [id, index]))
  programmes.sort((a, b) => (accountOrder.get(a.accountId) - accountOrder.get(b.accountId)) || (a.advertiserId - b.advertiserId))
  const stores = programmes.map((row) => ({
    accountId: row.accountId,
    publisherId: accountsById.get(row.accountId).publisherId,
    advertiserId: row.advertiserId,
    name: row.name,
    domains: parseDomains(row.domainsJson),
  }))

  const context = {
    userId,
    accountsById,
    publisherIds: new Set([...accountsById.values()].map((account) => String(account.publisherId))),
    stores,
    matcher: createAwinStoreMatcher(stores, { publisherIds: [...accountsById.values()].map((account) => account.publisherId) }),
    linkStore: deps.linkStore ?? createAwinLinkStore({ db, userId }),
  }
  if (deps.client) context.client = deps.client
  if (deps.resolveShortUrl) context.resolveShortUrl = deps.resolveShortUrl
  // Token nunca sai em JSON/log por acidente.
  Object.defineProperty(context, 'toJSON', { enumerable: false, value: () => ({ userId, accounts: accountsById.size, stores: stores.length }) })
  return context
}

/** Opções do detector/sanitizador para esta cliente ({} sem Awin). */
export function awinOfferOptions(context) {
  return context?.matcher ? { awin: context.matcher } : {}
}

const SHORT_URL_RE = /https?:\/\/(?:[a-z0-9-]+\.)*tidd\.ly\/[^\s]+/gi
const MAX_SHORT_PER_MESSAGE = 5

/**
 * Opções do detector para UMA mensagem do espelhamento. O tidd.ly não diz de
 * que loja é sem ser aberto: abrimos (só o Location, com cache) ANTES do
 * sanitizador. Loja não aprovada / não abriu → o link é apagado como antes
 * e o resto da oferta segue (decisão 2026-09-30: "apagar o link"). Sem
 * contexto → {} (tudo igual a antes).
 */
export async function refineAwinOptionsForText(text, context, { resolveShortUrl = resolveAwinShortUrlCached } = {}) {
  const matcher = context?.matcher
  if (!matcher) return {}
  const shortUrls = [...new Set(String(text ?? '').match(SHORT_URL_RE) || [])]
    .map((url) => url.replace(/[.,;!?)'"*_~`>]+$/, ''))
    .filter(isAwinShortUrl)
    .slice(0, MAX_SHORT_PER_MESSAGE)
  if (!shortUrls.length) return { awin: matcher }
  const usable = new Set()
  await Promise.all(shortUrls.map(async (url) => {
    const target = await resolveShortUrl(url).catch(() => null)
    if (target && !isAwinShortUrl(target) && matcher.isAwinLink(target)) usable.add(url)
  }))
  return {
    awin: {
      ...matcher,
      isAwinLink: (url) => (isAwinShortUrl(url) ? usable.has(url) : matcher.isAwinLink(url)),
    },
  }
}
