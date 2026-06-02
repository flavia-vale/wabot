import 'dotenv/config'

import { fetchProductInfo as defaultFetchProductInfo } from '../converters/productInfoScraper.js'
import { fetchProductImage as defaultFetchProductImage, fetchImageBuffer as defaultFetchImageBuffer, normalizeImageForWhatsApp as defaultNormalizeImage } from '../converters/imageScrapers.js'
import { buildScrapedOffer, buildCredentialsMap } from '../converters/offerEngine.js'
import { detectLinks } from '../detector.js'
import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { PRESET_TEMPLATE_BODIES } from '../../dashboard/lib/mobileTemplateStore.js'

const HTTP_URL_RE = /https?:\/\/[^\s<>()]+/gi
const DEFAULT_POLL_TIMEOUT_SECONDS = 25
const DEFAULT_POLL_INTERVAL_MS = 1000
const MAX_TELEGRAM_MESSAGE_LENGTH = 4096
const MAX_TELEGRAM_CAPTION_LENGTH = 1024
const MAX_INCOMING_TEXT_LENGTH = 4000
export const PRODUCT_NOT_FOUND_MESSAGE = '⚠️ Nenhum produto encontrado para o link enviado!'
export const WHATSAPP_SHARE_PROMPT = 'Quer enviar essa mensagem para o WhatsApp?'

export function buildWhatsappShareUrl(offerText) {
  return `https://wa.me/?text=${encodeURIComponent(String(offerText || ''))}`
}

export function buildWhatsappShareMarkup(offerText) {
  return {
    inline_keyboard: [[{ text: 'Sim', url: buildWhatsappShareUrl(offerText) }]],
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeChatId(value) {
  return String(value ?? '').trim()
}

function trimTrailingPunctuation(url) {
  return String(url || '').replace(/[),.;!?]+$/g, '')
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function extractSingleHttpUrl(text = '') {
  const rawText = String(text || '')
  if (!rawText.trim()) return { code: 'EMPTY_TEXT', url: null }
  if (rawText.length > MAX_INCOMING_TEXT_LENGTH) return { code: 'TEXT_TOO_LARGE', url: null }

  const urls = [...rawText.matchAll(HTTP_URL_RE)]
    .map(match => trimTrailingPunctuation(match[0]))
    .filter(isValidHttpUrl)

  if (!urls.length) return { code: 'NO_LINK', url: null }
  if (urls.length > 1) return { code: 'MULTIPLE_LINKS', url: null }
  return { code: null, url: urls[0] }
}

function hasProductInfo(product = {}) {
  return Boolean(
    String(product?.title || '').trim()
    || String(product?.price || '').trim()
    || String(product?.newPrice || '').trim()
    || String(product?.priceNow || '').trim()
    || String(product?.oldPrice || '').trim()
    || String(product?.priceWas || '').trim()
  )
}

export function buildOfferMessage({ product = {}, link }) {
  if (!hasProductInfo(product)) return PRODUCT_NOT_FOUND_MESSAGE

  const raw = buildMobileOfferText({
    product,
    link,
    template: 'simples',
    templateBody: PRESET_TEMPLATE_BODIES.simples,
  })

  // buildMobileOfferText preserves unfilled {variable} placeholders intentionally
  // for the dashboard UI (where users type in the missing fields). In the bot
  // context those raw placeholders must never reach the end user — strip them.
  const cleaned = raw
    .split('\n')
    .filter(line => !/\{[^}]+\}/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned || PRODUCT_NOT_FOUND_MESSAGE
}

// Carrega as credenciais (cookie ML, tag de afiliado) de um usuário fixo
// definido por TELEGRAM_OFFER_BOT_USER_ID. O bot do Telegram não tem usuário
// logado (só chat IDs autorizados), então ele "empresta" as credenciais desse
// usuário só para BUSCAR dados — o link devolvido ao usuário continua sendo o
// original (keepOriginalLink=true). Sem a env, roda anônimo (credenciais {}),
// mantendo o comportamento histórico e os testes db-free.
export async function defaultLoadCredentialsMap() {
  const userId = String(process.env.TELEGRAM_OFFER_BOT_USER_ID || '').trim()
  if (!userId) return {}
  const { default: db } = await import('../db.js')
  const credentials = await db.credential.findMany({ where: { userId } })
  return buildCredentialsMap(credentials)
}

export async function buildTelegramOfferText(url, {
  fetchProductInfo = defaultFetchProductInfo,
  buildOffer = buildScrapedOffer,
  credentialsMap = {},
  convertLink,
} = {}) {
  if (!isValidHttpUrl(url)) {
    const err = new Error('Link inválido. Cole uma URL começando com http(s)://.')
    err.code = 'INVALID_URL'
    throw err
  }

  // Motor único compartilhado com o painel "Criar oferta". keepOriginalLink
  // garante que a oferta devolva o link COLADO pelo usuário, mesmo quando a
  // busca de dados usou um link convertido/resolvido internamente.
  const offer = await buildOffer({
    url,
    credentialsMap,
    keepOriginalLink: true,
    fetchProductInfo,
    ...(convertLink ? { convertLink } : {}),
  })
  const product = { title: offer.title, oldPrice: offer.oldPrice, newPrice: offer.newPrice }
  return buildOfferMessage({ product, link: offer.displayUrl || url })
}

function inferPlatformFromUrl(url) {
  return detectLinks(String(url || ''))[0]?.platform || null
}

export async function fetchTelegramOfferImage(url, {
  fetchProductImage = defaultFetchProductImage,
  fetchImageBuffer = defaultFetchImageBuffer,
  normalizeImage = defaultNormalizeImage,
  credentials = {},
  logger = console,
} = {}) {
  if (!isValidHttpUrl(url)) return null

  const platform = inferPlatformFromUrl(url)
  if (!platform) return null

  try {
    const imageUrl = await fetchProductImage(platform, url, credentials)
    if (!imageUrl) return null

    const downloaded = await fetchImageBuffer(imageUrl, url)
    if (!downloaded?.buffer) return null

    const normalized = await normalizeImage(downloaded.buffer).catch(() => null)
    if (normalized?.buffer) {
      return {
        buffer: normalized.buffer,
        mimetype: normalized.mimetype || 'image/jpeg',
      }
    }

    return {
      buffer: downloaded.buffer,
      mimetype: downloaded.mimetype || 'image/jpeg',
    }
  } catch (err) {
    logger.warn?.({ err: err.message, url, platform }, 'Falha ao buscar imagem da oferta para Telegram')
    return null
  }
}

export async function buildTelegramOffer(url, {
  fetchProductInfo = defaultFetchProductInfo,
  fetchProductImage = defaultFetchProductImage,
  fetchImageBuffer = defaultFetchImageBuffer,
  normalizeImage = defaultNormalizeImage,
  credentialsMap = {},
  imageCredentials,
  convertLink,
  logger = console,
} = {}) {
  // Imagem usa as credenciais da Shopee quando disponíveis (resolveShopeeImage
  // exige appId/secretKey); demais lojas ignoram o argumento.
  const resolvedImageCredentials = imageCredentials ?? credentialsMap.shopee ?? {}
  const [text, image] = await Promise.all([
    buildTelegramOfferText(url, { fetchProductInfo, credentialsMap, convertLink }),
    fetchTelegramOfferImage(url, {
      fetchProductImage,
      fetchImageBuffer,
      normalizeImage,
      credentials: resolvedImageCredentials,
      logger,
    }),
  ])
  return { text, image }
}

function buildHelpText() {
  return [
    'Oi! Eu gero uma oferta pronta a partir de um link que você colar aqui.',
    '',
    'Como usar:',
    '1. Cole apenas 1 link http(s) por mensagem.',
    '2. O bot busca título/preço quando a loja permite leitura.',
    '3. Ele NÃO converte o link — usa exatamente o link colado na oferta.',
    '',
    'Comandos: /start ou /help',
  ].join('\n')
}

function buildUrlErrorText(code) {
  if (code === 'MULTIPLE_LINKS') return 'Encontrei mais de um link. Envie apenas 1 link por mensagem para gerar uma oferta por produto.'
  if (code === 'TEXT_TOO_LARGE') return 'Mensagem grande demais. Envie só o texto curto com 1 link de produto.'
  return 'Não encontrei um link válido. Cole uma URL começando com http:// ou https://.'
}

function createTelegramClient({ token, fetchImpl = fetch }) {
  const baseUrl = `https://api.telegram.org/bot${token}`

  async function call(method, payload) {
    const res = await fetchImpl(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || body?.ok === false) {
      const err = new Error(body?.description || `Telegram API error (${res.status})`)
      err.statusCode = res.status
      err.response = body
      throw err
    }
    return body.result
  }

  return {
    getUpdates(payload) {
      return call('getUpdates', payload)
    },
    sendMessage(chatId, text, extra = {}) {
      return call('sendMessage', {
        chat_id: chatId,
        text: String(text || '').slice(0, MAX_TELEGRAM_MESSAGE_LENGTH),
        disable_web_page_preview: true,
        ...extra,
      })
    },
    async sendPhoto(chatId, image, extra = {}) {
      if (!image?.buffer) throw new Error('Imagem ausente para sendPhoto')

      const form = new FormData()
      form.set('chat_id', String(chatId))
      form.set('photo', new Blob([image.buffer], { type: image.mimetype || 'image/jpeg' }), 'oferta.jpg')
      for (const [key, value] of Object.entries(extra || {})) {
        if (value != null) form.set(key, String(value))
      }

      const res = await fetchImpl(`${baseUrl}/sendPhoto`, {
        method: 'POST',
        body: form,
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.ok === false) {
        const err = new Error(body?.description || `Telegram API error (${res.status})`)
        err.statusCode = res.status
        err.response = body
        throw err
      }
      return body.result
    },
  }
}

export function createTelegramOfferBot({
  token = process.env.TELEGRAM_OFFER_BOT_TOKEN,
  allowedChatIds = process.env.TELEGRAM_OFFER_BOT_ALLOWED_CHAT_IDS,
  fetchProductInfo = defaultFetchProductInfo,
  fetchProductImage = defaultFetchProductImage,
  fetchImageBuffer = defaultFetchImageBuffer,
  normalizeImage = defaultNormalizeImage,
  imageCredentials,
  loadCredentialsMap = defaultLoadCredentialsMap,
  convertLink,
  telegramClient = null,
  logger = console,
  pollTimeoutSeconds = DEFAULT_POLL_TIMEOUT_SECONDS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  recordOfferLog = () => {},
} = {}) {
  if (!token && !telegramClient) {
    throw new Error('TELEGRAM_OFFER_BOT_TOKEN obrigatório para iniciar o bot de ofertas do Telegram.')
  }

  const client = telegramClient || createTelegramClient({ token })
  const allowedChats = Array.isArray(allowedChatIds)
    ? new Set(allowedChatIds.map(normalizeChatId).filter(Boolean))
    : new Set(String(allowedChatIds || '').split(',').map(normalizeChatId).filter(Boolean))
  const activeChats = new Set()
  let offset = 0
  let stopped = false

  function isAllowed(chatId) {
    return allowedChats.size === 0 || allowedChats.has(normalizeChatId(chatId))
  }

  // O logging nunca pode derrubar o bot nem interromper o atendimento.
  async function safeRecord(entry) {
    try {
      await recordOfferLog(entry)
    } catch (err) {
      logger.warn?.({ err: err.message }, 'Falha ao registrar log de oferta do Telegram')
    }
  }

  async function handleUpdate(update) {
    const message = update?.message || update?.edited_message
    const chatId = message?.chat?.id
    if (!chatId) return

    if (!isAllowed(chatId)) {
      logger.warn?.({ chatId }, 'Telegram offer bot ignored unauthorized chat')
      return
    }

    const text = String(message.text || '').trim()
    if (!text || text === '/start' || text === '/help') {
      await client.sendMessage(chatId, buildHelpText())
      return
    }

    const extracted = extractSingleHttpUrl(text)
    if (extracted.code) {
      await client.sendMessage(chatId, buildUrlErrorText(extracted.code))
      await safeRecord({ chatId, inputUrl: text, platform: null, status: 'invalid_input', errorMsg: extracted.code })
      return
    }

    const chatKey = normalizeChatId(chatId)
    if (activeChats.has(chatKey)) {
      await client.sendMessage(chatId, 'Já estou gerando uma oferta para este chat. Aguarde terminar antes de enviar outro link.')
      return
    }

    const startedAt = Date.now()
    const platform = inferPlatformFromUrl(extracted.url)
    activeChats.add(chatKey)
    try {
      // Carrega as credenciais do usuário fixo (env) para que a busca de
      // título/preço use cookie ML / resolução de afiliado igual ao painel.
      // Falha ao carregar nunca derruba o atendimento — cai para anônimo.
      let credentialsMap = {}
      try {
        credentialsMap = (await loadCredentialsMap()) || {}
      } catch (err) {
        logger.warn?.({ err: err.message }, 'Falha ao carregar credenciais para oferta do Telegram; seguindo anônimo')
      }

      const offer = await buildTelegramOffer(extracted.url, {
        fetchProductInfo,
        fetchProductImage,
        fetchImageBuffer,
        normalizeImage,
        credentialsMap,
        imageCredentials,
        convertLink,
        logger,
      })
      let withImage = false
      if (offer.image?.buffer && typeof client.sendPhoto === 'function') {
        try {
          await client.sendPhoto(chatId, offer.image, {
            caption: offer.text.slice(0, MAX_TELEGRAM_CAPTION_LENGTH),
          })
          withImage = true
          if (offer.text.length > MAX_TELEGRAM_CAPTION_LENGTH) {
            await client.sendMessage(chatId, offer.text)
          }
        } catch (err) {
          logger.warn?.({ err: err.message, chatId }, 'Falha ao enviar foto pelo Telegram; enviando oferta em texto')
          await client.sendMessage(chatId, offer.text)
        }
      } else {
        await client.sendMessage(chatId, offer.text)
      }

      // Só oferece o encaminhamento ao WhatsApp quando uma oferta real foi
      // montada (não no caminho "produto não encontrado").
      const productFound = offer.text !== PRODUCT_NOT_FOUND_MESSAGE
      if (productFound) {
        await client.sendMessage(chatId, WHATSAPP_SHARE_PROMPT, {
          reply_markup: buildWhatsappShareMarkup(offer.text),
        })
      }

      await safeRecord({
        chatId,
        inputUrl: extracted.url,
        platform,
        status: productFound ? 'success' : 'product_not_found',
        withImage,
        latencyMs: Date.now() - startedAt,
      })
    } catch (err) {
      logger.warn?.({ err: err.message, chatId }, 'Falha ao gerar oferta pelo Telegram')
      await client.sendMessage(chatId, 'Não consegui ler os dados do produto agora. Tente novamente em instantes ou use outro link.')
      await safeRecord({ chatId, inputUrl: extracted.url, platform, status: 'error', errorMsg: err.message, latencyMs: Date.now() - startedAt })
    } finally {
      activeChats.delete(chatKey)
    }
  }

  async function pollOnce() {
    const updates = await client.getUpdates({
      offset,
      timeout: pollTimeoutSeconds,
      allowed_updates: ['message', 'edited_message'],
    })
    for (const update of updates || []) {
      offset = Math.max(offset, Number(update.update_id || 0) + 1)
      await handleUpdate(update)
    }
    return updates || []
  }

  async function start() {
    logger.info?.('Telegram offer bot iniciado')
    while (!stopped) {
      try {
        await pollOnce()
      } catch (err) {
        if (err?.statusCode === 409) {
          logger.error?.({ err: err.message }, 'Telegram getUpdates retornou 409 Conflict: outra instância está fazendo polling com o MESMO token (ou há um webhook setado). Garanta apenas 1 processo rodando e tokens distintos entre prod e staging.')
        } else {
          logger.error?.({ err: err.message }, 'Erro no polling do Telegram offer bot')
        }
        await sleep(pollIntervalMs)
      }
    }
  }

  function stop() {
    stopped = true
  }

  return { handleUpdate, pollOnce, start, stop }
}
