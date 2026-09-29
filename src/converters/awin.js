// Conversor da Awin: link de loja aprovada (kabum.com.br/..., cea.com.br/...)
// ou link da Awin de outra pessoa (awin1.com/cread.php, tidd.ly) → link da
// CLIENTE. Regras (decisão da dona do produto, 2026-09-29 — não regredir):
//
// - Link curto oficial (tidd.ly, Link Builder com shorten) guardado para reuso:
//   o mesmo produto não gasta outra chamada nem outro link curto (cota medida:
//   200 links curtos por dia por conta; 20 chamadas/min por token).
// - Sem vaga no limite por minuto, cota do dia no fim, Awin fora do ar ou loja
//   que recusa o gerador → link longo documentado (awin1.com/cread.php),
//   montado aqui, sem chamada. Nunca segura a oferta esperando a Awin.
// - Loja em que a cliente NÃO foi aprovada → erro `stripFromMessage`: a
//   oferta não sai com o link de outra pessoa (mesma regra de
//   core/mirrorLinkGuard.js).
// - Link que já é da cliente (awinaffid = uma das contas dela) fica como está.
//
// `creds` vem de src/integrations/awin/conversionContext.js (contas + lojas +
// cache). Nada de token em log ou em mensagem de erro.

import { createHash } from 'node:crypto'
import { getDefaultAwinClient } from '../integrations/awin/client.js'
import {
  buildAwinDeepLink,
  cleanDestinationUrl,
  isAwinShortUrl,
  isAwinTrackingUrl,
  parseAwinClickUrl,
} from '../integrations/awin/storeMatcher.js'

export const AWIN_NOT_JOINED_ERROR = 'awin_store_not_joined'
const SHORT_RESOLVE_TIMEOUT_MS = 5_000
const SHORT_RESOLVE_MAX_HOPS = 4
const GENERATE_TIMEOUT_MS = 8_000
// Produto que ficou só com o link longo (cota do dia no fim) tenta o curto de
// novo depois disso.
export const AWIN_SHORT_RETRY_MS = 24 * 60 * 60_000

function notConvertible(message, code) {
  const err = new Error(message)
  err.stripFromMessage = true
  err.awinReason = code
  return err
}

export function awinDestinationKey(destinationUrl) {
  return createHash('sha256').update(String(destinationUrl)).digest('hex').slice(0, 40)
}

// tidd.ly → próximo endereço, sem seguir para fora da Awin (o destino final só
// é LIDO no Location, nunca buscado — sem clique contado para ninguém).
export async function resolveAwinShortUrl(url, { fetchFn = globalThis.fetch, timeoutMs = SHORT_RESOLVE_TIMEOUT_MS } = {}) {
  let current = url
  for (let hop = 0; hop < SHORT_RESOLVE_MAX_HOPS; hop++) {
    if (!isAwinShortUrl(current)) return current
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetchFn(current, { method: 'GET', redirect: 'manual', signal: controller.signal })
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
    const location = response?.headers?.get?.('location')
    if (!location || response.status < 300 || response.status >= 400) return null
    try {
      current = new URL(location, current).toString()
    } catch {
      return null
    }
  }
  return isAwinShortUrl(current) ? null : current
}

// Link curto não muda de destino: guarda o resultado para o robô não abrir o
// mesmo tidd.ly duas vezes (antes do sanitizador e na conversão). Teto de
// entradas fixo — memória: < 1 MB.
const SHORT_CACHE_MAX = 2_000
const shortCache = new Map()

export async function resolveAwinShortUrlCached(url, options = {}) {
  if (shortCache.has(url)) return shortCache.get(url)
  const target = await resolveAwinShortUrl(url, options)
  if (target) {
    if (shortCache.size >= SHORT_CACHE_MAX) shortCache.delete(shortCache.keys().next().value)
    shortCache.set(url, target)
  }
  return target
}

// De onde o link aponta e (se já for da Awin) de quem ele é.
async function readLink(url, deps) {
  let target = url
  if (isAwinShortUrl(url)) {
    target = await (deps.resolveShortUrl ?? resolveAwinShortUrlCached)(url)
    if (!target) throw notConvertible('Não foi possível abrir o link curto da Awin.', 'short_unresolved')
  }
  const click = parseAwinClickUrl(target)
  if (click) return { destinationUrl: click.destinationUrl, advertiserId: click.advertiserId, publisherId: click.publisherId, wasAwin: true }
  if (isAwinTrackingUrl(target)) return { destinationUrl: null, advertiserId: null, publisherId: null, wasAwin: true }
  return { destinationUrl: target, advertiserId: null, publisherId: null, wasAwin: false }
}

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'AWIN_TIMEOUT' })), ms) }),
  ]).finally(() => clearTimeout(timer))
}

/**
 * @returns {Promise<{ url: string, awin: { own: boolean, short: boolean, cached: boolean,
 *   advertiserId: number, storeName: string, destinationUrl: string } }>}
 */
export async function convert(url, creds, _options = {}) {
  const matcher = creds?.matcher
  const accounts = creds?.accountsById
  if (!matcher || !accounts?.size) throw notConvertible('Nenhuma conta Awin cadastrada.', 'no_account')

  const link = await readLink(url, creds)

  // Já é link da cliente: não mexe (não gasta chamada nem cota).
  if (link.wasAwin && link.publisherId && creds.publisherIds?.has(link.publisherId)) {
    const store = (link.advertiserId && matcher.storeForAdvertiser(link.advertiserId)) || (link.destinationUrl && matcher.storeForUrl(link.destinationUrl)) || null
    return {
      url,
      awin: { own: true, short: isAwinShortUrl(url), cached: false, advertiserId: store?.advertiserId ?? link.advertiserId, storeName: store?.name ?? '', destinationUrl: link.destinationUrl },
    }
  }

  const destinationUrl = cleanDestinationUrl(link.destinationUrl)
  const store = (destinationUrl && matcher.storeForUrl(destinationUrl))
    || (link.advertiserId && matcher.storeForAdvertiser(link.advertiserId))
    || null
  if (!store) throw notConvertible('Loja da Awin em que você ainda não foi aprovada.', AWIN_NOT_JOINED_ERROR)
  if (!destinationUrl) throw notConvertible('O link da Awin não diz para qual página da loja ele vai.', 'no_destination')
  const account = accounts.get(store.accountId)
  if (!account) throw notConvertible('Conta Awin da loja não encontrada.', 'no_account')

  const destinationKey = awinDestinationKey(destinationUrl)
  const info = { own: false, advertiserId: store.advertiserId, storeName: store.name, destinationUrl }
  const cached = await creds.linkStore?.get({ accountId: account.id, advertiserId: store.advertiserId, destinationKey }).catch(() => null)
  if (cached?.shortUrl) return { url: cached.shortUrl, awin: { ...info, short: true, cached: true } }

  const longUrl = buildAwinDeepLink({ advertiserId: store.advertiserId, publisherId: account.publisherId, destinationUrl })
  let shortUrl = null
  let apiLongUrl = null
  const now = creds.now ? creds.now() : Date.now()
  const retryShort = cached && !cached.shortUrl && now - new Date(cached.createdAt).getTime() >= AWIN_SHORT_RETRY_MS
  if (!cached || retryShort) {
    try {
      const client = creds.client ?? getDefaultAwinClient()
      const generated = await withTimeout(client.generateLink(account.token, account.publisherId, {
        advertiserId: store.advertiserId,
        destinationUrl,
        shorten: true,
        noWait: true,
      }), creds.generateTimeoutMs ?? GENERATE_TIMEOUT_MS)
      shortUrl = generated?.shortUrl || null
      apiLongUrl = generated?.url || null
    } catch {
      // Plano B: link longo montado aqui (limite por minuto, cota, Awin fora).
      // Não guarda — a próxima vez tenta o curto de novo.
      return { url: longUrl, awin: { ...info, short: false, cached: false } }
    }
    await creds.linkStore?.save({
      accountId: account.id,
      advertiserId: store.advertiserId,
      destinationKey,
      destinationUrl,
      shortUrl,
      longUrl: apiLongUrl || longUrl,
    }).catch(() => {})
  }
  // `cached` sem curto = a Awin já respondeu sem link curto para este produto
  // (cota do dia no fim): não pede de novo, sai o longo.
  const finalUrl = shortUrl || apiLongUrl || cached?.longUrl || longUrl
  return { url: finalUrl, awin: { ...info, short: Boolean(shortUrl), cached: Boolean(cached) && !retryShort } }
}
