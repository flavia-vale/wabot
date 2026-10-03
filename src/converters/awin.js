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
import { AwinAuthError, AwinHttpError, AwinRateLimitError } from '../integrations/awin/errors.js'
import {
  buildAwinDeepLink,
  cleanDestinationUrl,
  isAwinShortUrl,
  isAwinTrackingUrl,
  parseAwinClickUrl,
} from '../integrations/awin/storeMatcher.js'

export const AWIN_NOT_JOINED_ERROR = 'awin_store_not_joined'
// Tempos curtos de propósito (R2, revisão 2026-10-03): a mensagem do
// espelhamento tem 25 s na fila (incomingQueue) e a Awin é só UMA das lojas
// dela. Awin lenta = sai o link longo, nunca a oferta some por tempo.
const SHORT_RESOLVE_TIMEOUT_MS = 3_000
const SHORT_RESOLVE_MAX_HOPS = 4
const GENERATE_TIMEOUT_MS = 4_000
// Teto de tempo da Awin por MENSAGEM (vários links Awin na mesma oferta são
// convertidos um de cada vez). Passou do teto → link longo, sem chamada.
export const AWIN_MESSAGE_BUDGET_MS = 10_000
const MIN_CALL_MS = 500
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
  // O mesmo teto vale para TODOS os saltos juntos, não para cada um.
  const deadline = Date.now() + timeoutMs
  let current = url
  for (let hop = 0; hop < SHORT_RESOLVE_MAX_HOPS; hop++) {
    if (!isAwinShortUrl(current)) return current
    const remaining = deadline - Date.now()
    if (remaining <= 0) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)
    let response
    try {
      response = await fetchFn(current, { method: 'GET', redirect: 'manual', signal: controller.signal })
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
    // Só o Location interessa: o corpo é descartado para a conexão não ficar
    // presa esperando alguém ler (R3).
    try { await response?.body?.cancel?.() } catch { /* já fechado */ }
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
// mesmo tidd.ly duas vezes (antes do sanitizador e na conversão). Falha também
// fica guardada, por pouco tempo (R2): o mesmo tidd.ly que não abriu não
// gasta outros 3 s na mesma mensagem nem nas cópias dela. Teto de entradas
// fixo — memória: < 1 MB.
const SHORT_CACHE_MAX = 2_000
export const AWIN_SHORT_FAIL_TTL_MS = 5 * 60_000
const shortCache = new Map()

export async function resolveAwinShortUrlCached(url, options = {}) {
  const now = options.now ? options.now() : Date.now()
  const hit = shortCache.get(url)
  if (hit && (hit.target || now - hit.at < AWIN_SHORT_FAIL_TTL_MS)) return hit.target
  const target = await resolveAwinShortUrl(url, options)
  if (shortCache.has(url)) shortCache.delete(url)
  else if (shortCache.size >= SHORT_CACHE_MAX) shortCache.delete(shortCache.keys().next().value)
  shortCache.set(url, { target: target || null, at: now })
  return target
}

// Disjuntor por conta (R2/R7): Awin fora do ar ou lenta → 3 falhas seguidas
// abrem o disjuntor por 5 min, e nesse tempo sai o link longo SEM chamada (nem
// espera). Código de acesso recusado (401/403) abre por 30 min. Falta de vaga
// no limite por minuto e recusa de um link só (4xx) não contam. Memória: 1
// entrada pequena por conta Awin.
export const AWIN_BREAKER_FAILURES = 3
export const AWIN_BREAKER_OPEN_MS = 5 * 60_000
export const AWIN_BREAKER_AUTH_OPEN_MS = 30 * 60_000
const breakers = new Map()

export function awinBreakerIsOpen(accountId, now = Date.now()) {
  const state = breakers.get(accountId)
  return Boolean(state?.openUntil && now < state.openUntil)
}

function recordAwinResult(accountId, error, now) {
  if (!error) { breakers.delete(accountId); return }
  if (error instanceof AwinRateLimitError) return
  // 4xx de UM link (destino que a loja recusa) não diz nada da Awin.
  if (error instanceof AwinHttpError && Number(error.status) < 500) return
  const state = breakers.get(accountId) ?? { failures: 0, openUntil: 0 }
  if (error instanceof AwinAuthError) {
    state.failures = AWIN_BREAKER_FAILURES
    state.openUntil = now + AWIN_BREAKER_AUTH_OPEN_MS
  } else {
    state.failures++
    if (state.failures >= AWIN_BREAKER_FAILURES) state.openUntil = now + AWIN_BREAKER_OPEN_MS
  }
  breakers.set(accountId, state)
}

/** Só para testes. */
export function resetAwinRuntimeState() {
  breakers.clear()
  shortCache.clear()
}

/**
 * Página da LOJA por trás de um link da Awin (tidd.ly / cread.php), para ler
 * foto e nome. Nunca abre o link de clique até o fim: tidd.ly → só o Location
 * (com cache — a conversão já leu o mesmo link); cread.php → o `ued`, sem
 * rede. Link que não é da Awin volta como está. null = não deu para saber.
 */
export async function awinStorePageUrl(url, { resolveShortUrl = resolveAwinShortUrlCached } = {}) {
  let target = url
  if (isAwinShortUrl(target)) target = await resolveShortUrl(target).catch(() => null)
  if (!target) return null
  const click = parseAwinClickUrl(target)
  if (click) return cleanDestinationUrl(click.destinationUrl)
  if (isAwinTrackingUrl(target)) return null
  return target
}

// De onde o link aponta e (se já for da Awin) de quem ele é.
async function readLink(url, deps, timeoutMs) {
  let target = url
  if (isAwinShortUrl(url)) {
    target = await (deps.resolveShortUrl ?? resolveAwinShortUrlCached)(url, { timeoutMs })
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
export async function convert(url, creds, options = {}) {
  const matcher = creds?.matcher
  const accounts = creds?.accountsById
  if (!matcher || !accounts?.size) throw notConvertible('Nenhuma conta Awin cadastrada.', 'no_account')
  const clock = () => (creds.now ? creds.now() : Date.now())
  // `deadline` = teto da mensagem inteira (bot-worker). Sem ele, só os tempos
  // de cada chamada valem (Converter links / Criar oferta).
  const timeLeft = () => (Number.isFinite(options?.deadline) ? options.deadline - clock() : Infinity)

  const link = await readLink(url, creds, Math.max(1_000, Math.min(SHORT_RESOLVE_TIMEOUT_MS, timeLeft())))

  // Já é link da cliente: não mexe (não gasta chamada nem cota).
  if (link.wasAwin && link.publisherId && creds.publisherIds?.has(link.publisherId)) {
    const store = (link.advertiserId && matcher.storeForAdvertiser(link.advertiserId)) || (link.destinationUrl && matcher.storeForUrl(link.destinationUrl)) || null
    return {
      url,
      awin: { own: true, short: isAwinShortUrl(url), cached: false, advertiserId: store?.advertiserId ?? link.advertiserId, storeName: store?.name ?? '', destinationUrl: link.destinationUrl },
    }
  }

  const cleanDestination = cleanDestinationUrl(link.destinationUrl)
  const storeByPage = cleanDestination ? matcher.storeForUrl(cleanDestination) : null
  const store = storeByPage
    || (link.advertiserId && matcher.storeForAdvertiser(link.advertiserId))
    || null
  if (!store) throw notConvertible('Loja da Awin em que você ainda não foi aprovada.', AWIN_NOT_JOINED_ERROR)
  // Link da Awin SEM página (vai para a página inicial da loja) ou com página
  // de OUTRO site: o link dela vai para a página inicial da MESMA loja — antes
  // a oferta inteira era descartada (revisão 2026-09-30). Página de outro site
  // nunca vai junto: a Awin redirecionaria para lá com a comissão da loja.
  const destinationUrl = storeByPage ? cleanDestination : null
  const account = accounts.get(store.accountId)
  if (!account) throw notConvertible('Conta Awin da loja não encontrada.', 'no_account')

  const destinationKey = awinDestinationKey(destinationUrl || `home:${store.advertiserId}`)
  const info = { own: false, advertiserId: store.advertiserId, storeName: store.name, destinationUrl }
  const cached = await creds.linkStore?.get({ accountId: account.id, advertiserId: store.advertiserId, destinationKey }).catch(() => null)
  if (cached?.shortUrl) return { url: cached.shortUrl, awin: { ...info, short: true, cached: true } }

  const longUrl = buildAwinDeepLink({ advertiserId: store.advertiserId, publisherId: account.publisherId, destinationUrl })
  let shortUrl = null
  let apiLongUrl = null
  const now = clock()
  const retryShort = cached && !cached.shortUrl && now - new Date(cached.createdAt).getTime() >= AWIN_SHORT_RETRY_MS
  if (!cached || retryShort) {
    const left = timeLeft()
    const budget = Math.min(creds.generateTimeoutMs ?? GENERATE_TIMEOUT_MS, left)
    // Disjuntor aberto ou sem tempo na mensagem: link longo, sem chamada.
    if (awinBreakerIsOpen(account.id, now) || left < MIN_CALL_MS) {
      return { url: longUrl, awin: { ...info, short: false, cached: false } }
    }
    try {
      const client = creds.client ?? getDefaultAwinClient()
      const generated = await withTimeout(client.generateLink(account.token, account.publisherId, {
        advertiserId: store.advertiserId,
        ...(destinationUrl ? { destinationUrl } : {}),
        shorten: true,
        noWait: true,
      }), budget)
      shortUrl = generated?.shortUrl || null
      apiLongUrl = generated?.url || null
      recordAwinResult(account.id, null, clock())
    } catch (error) {
      recordAwinResult(account.id, error, clock())
      // Plano B: link longo montado aqui (limite por minuto, cota, Awin fora).
      // Não guarda — a próxima vez tenta o curto de novo.
      return { url: longUrl, awin: { ...info, short: false, cached: false } }
    }
    await creds.linkStore?.save({
      accountId: account.id,
      advertiserId: store.advertiserId,
      destinationKey,
      destinationUrl: destinationUrl || '',
      shortUrl,
      longUrl: apiLongUrl || longUrl,
    }).catch(() => {})
  }
  // `cached` sem curto = a Awin já respondeu sem link curto para este produto
  // (cota do dia no fim): não pede de novo, sai o longo.
  const finalUrl = shortUrl || apiLongUrl || cached?.longUrl || longUrl
  return { url: finalUrl, awin: { ...info, short: Boolean(shortUrl), cached: Boolean(cached) && !retryShort } }
}
