import axios from 'axios'

const ssid = 'ghy-082714-yppxJzgFIyVeANW6oUSLw4QXHeUGKW-__-475630078-__-1851015586630--RRR_0-RRR_0'
const testUrl = 'https://www.mercadolivre.com.br/televisor-smart-philips-86-4k/p/MLB31291994'

const headers = {
  Cookie: `ssid=${ssid}`,
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Origin: 'https://www.mercadolivre.com.br',
  Referer: 'https://www.mercadolivre.com.br/',
}

const candidates = [
  { method: 'POST', url: 'https://publishers.mercadolivre.com.br/api/v1/links', body: { url: testUrl } },
  { method: 'POST', url: 'https://publishers.mercadolivre.com.br/api/shortener', body: { url: testUrl } },
  { method: 'POST', url: 'https://www.mercadolivre.com.br/affiliates/api/shortener', body: { url: testUrl } },
  { method: 'POST', url: 'https://api.mercadolibre.com/affiliate/v1/links', body: { url: testUrl } },
  { method: 'POST', url: 'https://api.mercadolibre.com/affiliates/links', body: { url: testUrl } },
  { method: 'POST', url: 'https://api.mercadolibre.com/affiliate_deal/generate_link', body: { url: testUrl } },
]

for (const c of candidates) {
  try {
    const res = c.method === 'POST'
      ? await axios.post(c.url, c.body, { headers, timeout: 6000 })
      : await axios.get(c.url, { headers, timeout: 6000 })
    console.log(`✅ ${c.url}`)
    console.log('   Status:', res.status)
    console.log('   Body:', JSON.stringify(res.data).slice(0, 400))
  } catch (err) {
    const detail = err.response?.status
      ? `${err.response.status} — ${JSON.stringify(err.response.data).slice(0, 200)}`
      : err.message
    console.log(`❌ ${c.url} → ${detail}`)
  }
}
