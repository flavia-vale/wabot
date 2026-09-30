// Foto da Magalu via scraper externo (RCA 2026-09-30).
//
// O Akamai da Magalu barra o servidor (403 em VPS e fora dela, medido) — nenhum
// fetch direto pega a página do produto. Este módulo monta a chamada a um
// serviço de scraping que passa pelo muro, e limita o gasto diário.
//
// DESLIGADO por padrão: sem `MAGALU_SCRAPER_KEY` nada muda. Puro (sem rede).
//   MAGALU_SCRAPER_PROVIDER  zenrows (default) | scrapedo
//   MAGALU_SCRAPER_KEY       chave da conta
//   MAGALU_SCRAPER_DAILY_CAP chamadas por dia (default 100)

const PROVIDERS = {
  zenrows: (key, target) => `https://api.zenrows.com/v1/?apikey=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}&js_render=true&premium_proxy=true&proxy_country=br`,
  scrapedo: (key, target) => `https://api.scrape.do/?token=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}&render=true&geoCode=br&super=true`,
}

export function readMagaluScraperConfig(env = process.env) {
  const key = String(env.MAGALU_SCRAPER_KEY || '').trim()
  const provider = String(env.MAGALU_SCRAPER_PROVIDER || 'zenrows').trim().toLowerCase()
  if (!key || !PROVIDERS[provider]) return null
  const cap = Number(env.MAGALU_SCRAPER_DAILY_CAP)
  return { key, provider, dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 100 }
}

export function buildMagaluScraperUrl(config, targetUrl) {
  return PROVIDERS[config.provider](config.key, targetUrl)
}

// Teto diário em memória (por processo). Reinicia à meia-noite UTC.
const usage = { day: '', count: 0 }

export function takeMagaluScraperQuota(config, now = new Date()) {
  const day = now.toISOString().slice(0, 10)
  if (usage.day !== day) { usage.day = day; usage.count = 0 }
  if (usage.count >= config.dailyCap) return false
  usage.count += 1
  return true
}

export function resetMagaluScraperQuotaForTest() { usage.day = ''; usage.count = 0 }
