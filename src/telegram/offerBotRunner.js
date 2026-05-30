import 'dotenv/config'

console.info('[telegram-offer-bot] runner booting', {
  pid: process.pid,
  nodeEnv: process.env.NODE_ENV || null,
  appEnv: process.env.APP_ENV || null,
  tokenConfigured: Boolean(String(process.env.TELEGRAM_OFFER_BOT_TOKEN || '').trim()),
  allowedChatIdsConfigured: Boolean(String(process.env.TELEGRAM_OFFER_BOT_ALLOWED_CHAT_IDS || '').trim()),
  shopeeCredsConfigured: Boolean(String(process.env.TELEGRAM_BOT_SHOPEE_APP_ID || '').trim()),
  mlCredsConfigured: Boolean(String(process.env.TELEGRAM_BOT_ML_SSID || '').trim()),
})

process.on('unhandledRejection', (err) => {
  console.error('[telegram-offer-bot] unhandledRejection', err)
})

process.on('uncaughtException', (err) => {
  console.error('[telegram-offer-bot] uncaughtException', err)
  process.exit(1)
})

const [{ createTelegramOfferBot }, { recordTelegramOfferLog }, { fetchProductInfo: baseFetchProductInfo }] = await Promise.all([
  import('./offerBot.js'),
  import('./offerLog.js'),
  import('../converters/productInfoScraper.js'),
])

console.info('[telegram-offer-bot] runner imports loaded')

// Credenciais da operadora carregadas de env vars — o bot é single-tenant,
// não há autenticação por usuário como nas rotas da API.
const shopeeCredentials = process.env.TELEGRAM_BOT_SHOPEE_APP_ID
  ? { appId: process.env.TELEGRAM_BOT_SHOPEE_APP_ID, secretKey: process.env.TELEGRAM_BOT_SHOPEE_SECRET_KEY || '' }
  : null

const mlCredentials = process.env.TELEGRAM_BOT_ML_SSID
  ? { ssid: process.env.TELEGRAM_BOT_ML_SSID, csrf: process.env.TELEGRAM_BOT_ML_CSRF || '' }
  : null

function fetchProductInfo(url) {
  return baseFetchProductInfo(url, { shopeeCredentials, mlCredentials })
}

const bot = createTelegramOfferBot({
  recordOfferLog: recordTelegramOfferLog,
  fetchProductInfo,
})

const stop = () => {
  console.info('[telegram-offer-bot] stop signal received')
  bot.stop()
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)

await bot.start()
