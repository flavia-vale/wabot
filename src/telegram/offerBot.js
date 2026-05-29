import 'dotenv/config'

import { fetchProductInfo as defaultFetchProductInfo } from '../converters/productInfoScraper.js'
import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { PRESET_TEMPLATE_BODIES } from '../../dashboard/lib/mobileTemplateStore.js'

const HTTP_URL_RE = /https?:\/\/[^\s<>()]+/gi
const DEFAULT_POLL_TIMEOUT_SECONDS = 25
const DEFAULT_POLL_INTERVAL_MS = 1000
const MAX_TELEGRAM_MESSAGE_LENGTH = 4096
const MAX_INCOMING_TEXT_LENGTH = 4000

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

export function buildOfferMessage({ product = {}, link }) {
  return buildMobileOfferText({
    product,
    link,
    template: 'simples',
    templateBody: PRESET_TEMPLATE_BODIES.simples,
  })
}

export async function buildTelegramOfferText(url, { fetchProductInfo = defaultFetchProductInfo } = {}) {
  if (!isValidHttpUrl(url)) {
    const err = new Error('Link inválido. Cole uma URL começando com http(s)://.')
    err.code = 'INVALID_URL'
    throw err
  }

  const product = await fetchProductInfo(url)
  return buildOfferMessage({ product, link: url })
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
  }
}

export function createTelegramOfferBot({
  token = process.env.TELEGRAM_OFFER_BOT_TOKEN,
  allowedChatIds = process.env.TELEGRAM_OFFER_BOT_ALLOWED_CHAT_IDS,
  fetchProductInfo = defaultFetchProductInfo,
  telegramClient = null,
  logger = console,
  pollTimeoutSeconds = DEFAULT_POLL_TIMEOUT_SECONDS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
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
      return
    }

    const chatKey = normalizeChatId(chatId)
    if (activeChats.has(chatKey)) {
      await client.sendMessage(chatId, 'Já estou gerando uma oferta para este chat. Aguarde terminar antes de enviar outro link.')
      return
    }

    activeChats.add(chatKey)
    try {
      const offerText = await buildTelegramOfferText(extracted.url, { fetchProductInfo })
      await client.sendMessage(chatId, offerText)
    } catch (err) {
      logger.warn?.({ err: err.message, chatId }, 'Falha ao gerar oferta pelo Telegram')
      await client.sendMessage(chatId, 'Não consegui ler os dados do produto agora. Tente novamente em instantes ou use outro link.')
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
        logger.error?.({ err: err.message }, 'Erro no polling do Telegram offer bot')
        await sleep(pollIntervalMs)
      }
    }
  }

  function stop() {
    stopped = true
  }

  return { handleUpdate, pollOnce, start, stop }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = createTelegramOfferBot()
  const stop = () => {
    bot.stop()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  await bot.start()
}
