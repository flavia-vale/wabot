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

// Cada provedor devolve as tentativas da MAIS BARATA para a mais cara
// (RCA 2026-09-30, medido na VPS com o Scrape.do): a foto da Magalu vem no
// HTML puro, então `render` (JavaScript) é desperdício; e sem `super` (IP
// residencial) a página também veio com foto, por 1 crédito em vez de 10.
// O `super` fica só como segunda tentativa, quando a barata cai no muro.
const PROVIDERS = {
  zenrows: (key, target) => [
    `https://api.zenrows.com/v1/?apikey=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}&js_render=true&premium_proxy=true&proxy_country=br`,
  ],
  scrapedo: (key, target) => {
    const base = `https://api.scrape.do/?token=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}&geoCode=br`
    return [base, `${base}&super=true`]
  },
}

export function readMagaluScraperConfig(env = process.env) {
  const key = String(env.MAGALU_SCRAPER_KEY || '').trim()
  const provider = String(env.MAGALU_SCRAPER_PROVIDER || 'zenrows').trim().toLowerCase()
  if (!key || !PROVIDERS[provider]) return null
  const cap = Number(env.MAGALU_SCRAPER_DAILY_CAP)
  return { key, provider, dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 100 }
}

export function buildMagaluScraperUrls(config, targetUrl) {
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
