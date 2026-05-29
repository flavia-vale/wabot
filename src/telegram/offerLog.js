import db from '../db.js'

const MAX_URL_LENGTH = 2000
const MAX_ERROR_LENGTH = 500
export const TELEGRAM_OFFER_STATUSES = ['success', 'product_not_found', 'invalid_input', 'error']

// Persiste uma linha por requisição do bot de ofertas do Telegram para
// alimentar a aba /admin. NUNCA propaga erro: o bot não pode cair por causa
// de logging — em caso de falha do banco a oferta já foi entregue ao usuário.
export async function recordTelegramOfferLog(entry = {}) {
  try {
    await db.telegramOfferLog.create({
      data: {
        chatId: String(entry.chatId ?? ''),
        inputUrl: String(entry.inputUrl ?? '').slice(0, MAX_URL_LENGTH),
        platform: entry.platform ? String(entry.platform) : null,
        status: TELEGRAM_OFFER_STATUSES.includes(entry.status) ? entry.status : 'error',
        withImage: Boolean(entry.withImage),
        errorMsg: entry.errorMsg ? String(entry.errorMsg).slice(0, MAX_ERROR_LENGTH) : null,
        latencyMs: Number.isFinite(entry.latencyMs) ? Math.round(entry.latencyMs) : null,
      },
    })
  } catch (err) {
    console.warn?.('Falha ao registrar TelegramOfferLog:', err?.message)
  }
}
