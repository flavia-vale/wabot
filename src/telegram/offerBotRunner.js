import 'dotenv/config'

console.info('[telegram-offer-bot] runner booting', {
  pid: process.pid,
  nodeEnv: process.env.NODE_ENV || null,
  appEnv: process.env.APP_ENV || null,
  tokenConfigured: Boolean(String(process.env.TELEGRAM_OFFER_BOT_TOKEN || '').trim()),
  allowedChatIdsConfigured: Boolean(String(process.env.TELEGRAM_OFFER_BOT_ALLOWED_CHAT_IDS || '').trim()),
})

process.on('unhandledRejection', (err) => {
  console.error('[telegram-offer-bot] unhandledRejection', err)
})

process.on('uncaughtException', (err) => {
  console.error('[telegram-offer-bot] uncaughtException', err)
  process.exit(1)
})

const [{ createTelegramOfferBot }, { recordTelegramOfferLog }] = await Promise.all([
  import('./offerBot.js'),
  import('./offerLog.js'),
])

console.info('[telegram-offer-bot] runner imports loaded')

const bot = createTelegramOfferBot({ recordOfferLog: recordTelegramOfferLog })

const stop = () => {
  console.info('[telegram-offer-bot] stop signal received')
  bot.stop()
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)

await bot.start()
