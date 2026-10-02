// Feature 017, Fatia 3 (T043) — cliente HTTP do Telegram com `fetch` nativo
// (sem dependência nova). Só FALA com o Telegram: nenhuma política (ritmo,
// plano, repetição) mora aqui — contrato do adaptador, regra 1.
//
// O segredo do robô vem de UMA env (TELEGRAM_BOT_TOKEN) e nunca de parâmetro
// vindo da cliente. Ele faz parte da URL de toda chamada, por isso: nenhuma
// mensagem de erro, retorno ou log deste módulo carrega a URL — só o método
// chamado e a descrição devolvida pelo Telegram (FR-016).

const API_BASE = 'https://api.telegram.org'
const DEFAULT_TIMEOUT_MS = 15_000

export class TelegramApiError extends Error {
  constructor(method, { status = 0, errorCode = 0, description = '', retryAfterSec = null, migrateToChatId = null } = {}) {
    super(`telegram ${method}: ${errorCode || status || 'falha_de_rede'} ${description}`.trim())
    this.name = 'TelegramApiError'
    this.method = method
    this.status = status
    this.errorCode = errorCode
    this.description = description
    this.retryAfterSec = retryAfterSec
    this.migrateToChatId = migrateToChatId
  }
}

export function readTelegramSecret(env = process.env) {
  const value = String(env?.TELEGRAM_BOT_TOKEN ?? '').trim()
  return value || null
}

export function createTelegramApi({ secret, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!secret) throw new Error('createTelegramApi: segredo do robô ausente')

  async function call(method, payload = {}, { callTimeoutMs = timeoutMs } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), callTimeoutMs)
    let res
    try {
      res = await fetchImpl(`${API_BASE}/bot${secret}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      // Mensagem própria: a do fetch pode conter a URL (com o segredo).
      throw new TelegramApiError(method, { description: err?.name === 'AbortError' ? 'tempo_esgotado' : 'falha_de_rede' })
    } finally {
      clearTimeout(timer)
    }
    let body = null
    try { body = await res.json() } catch { body = null }
    if (res.ok && body?.ok) return body.result
    throw new TelegramApiError(method, {
      status: res.status,
      errorCode: body?.error_code ?? res.status,
      description: String(body?.description ?? '').slice(0, 200),
      retryAfterSec: body?.parameters?.retry_after ?? null,
      migrateToChatId: body?.parameters?.migrate_to_chat_id ?? null,
    })
  }

  return {
    getMe: () => call('getMe'),
    getChat: (chatId) => call('getChat', { chat_id: chatId }),
    getChatMember: (chatId, userId) => call('getChatMember', { chat_id: chatId, user_id: userId }),
    // Long poll: o tempo de espera do Telegram (timeoutSec) precisa caber
    // dentro do timeout local da chamada.
    getUpdates: ({ offset, timeoutSec = 25, allowedUpdates } = {}) => call(
      'getUpdates',
      { offset, timeout: timeoutSec, ...(allowedUpdates ? { allowed_updates: allowedUpdates } : {}) },
      { callTimeoutMs: (timeoutSec + 10) * 1000 },
    ),
    sendMessage: (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, ...extra }),
    sendPhoto: (chatId, photoUrl, caption, extra = {}) => call('sendPhoto', { chat_id: chatId, photo: photoUrl, ...(caption ? { caption } : {}), ...extra }),
  }
}
