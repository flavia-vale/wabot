// Probe diagnóstico (rodar em STAGING): descobre qual ORIGEM enviada à
// generateShortLink da Shopee produz um short link que ABRE O APP (deep-link)
// em vez de cair na web (/m/... -> unsupported.html no WebView do WhatsApp).
//
// Uso (de dentro de ~/wabot-staging, pra carregar o .env e o banco certos):
//   node scripts/shopee-linktype-probe.mjs 'https://shopee.com.br/m/envio-rapido?<URL ORIGINAL COMPLETA DO GRUPO>'
//
// Se não passar URL, usa /m/envio-rapido como exemplo. O script NÃO envia nada
// pra ninguém — só gera os short links e imprime. Você toca em cada um no
// celular (no WhatsApp) e anota qual abre o app.
import 'dotenv/config'
import axios from 'axios'
import crypto from 'crypto'
import prisma from '../src/db.js'
import { decryptCredential } from '../src/credentialCrypto.js'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secretKey}`).digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`
}

async function genShortLink(originUrl, { appId, secretKey }) {
  const safeUrl = String(originUrl).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  // Mesmo SubID que a produção manda (SHOPEE_SUB_ID em src/converters/shopee.js).
  // Duplicado de propósito: importar o conversor arrastaria axios e a
  // implementação inteira para dentro de um script de diagnóstico.
  const body = { query: `mutation { generateShortLink(input: { originUrl: "${safeUrl}", subIds: ["espelhagrupos"] }) { shortLink } }` }
  const payload = JSON.stringify(body)
  try {
    const { data } = await axios.post(ENDPOINT, body, {
      headers: { Authorization: buildAuth(appId, secretKey, payload), 'Content-Type': 'application/json' },
      timeout: 10000,
    })
    const link = data?.data?.generateShortLink?.shortLink
    if (!link) return { ok: false, error: data?.errors?.[0]?.message || 'sem shortLink' }
    return { ok: true, link }
  } catch (err) {
    return { ok: false, error: err?.response?.data ? JSON.stringify(err.response.data) : err.message }
  }
}

// Strip do tracking de TERCEIRO (o que a API recusa com "Invalid origin URL").
function stripThirdPartyAffiliate(rawUrl) {
  let u
  try { u = new URL(String(rawUrl)) } catch { return String(rawUrl) }
  for (const key of [...u.searchParams.keys()]) {
    const lower = key.toLowerCase()
    if (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'mmp_pid', 'uls_trackid', 'gads_t_sig', 'pid', 'is_retargeting', 'c'].includes(lower)
      || lower.startsWith('af_') || lower.startsWith('deep_and_')) {
      u.searchParams.delete(key)
    }
  }
  return u.toString()
}

async function main() {
  const inputUrl = process.argv[2] || 'https://shopee.com.br/m/envio-rapido'
  let parsed
  try { parsed = new URL(inputUrl) } catch { console.error('URL inválida:', inputUrl); process.exit(1) }

  const cred = await prisma.credential.findFirst({ where: { platform: 'shopee' } })
  if (!cred) { console.error('Nenhuma credencial Shopee no banco deste ambiente.'); process.exit(1) }
  let creds
  try { creds = JSON.parse(decryptCredential(cred.data)) } catch (e) { console.error('Falha ao ler credencial:', e.message); process.exit(1) }
  if (!creds.appId || !creds.secretKey) { console.error('Credencial Shopee sem appId/secretKey.'); process.exit(1) }
  console.log(`Usando appId=${creds.appId} (userId=${cred.userId})\n`)

  const barePath = `${parsed.origin}${parsed.pathname}`
  const candidates = [
    ['A) URL pelada (comportamento ATUAL)', barePath],
    ['B) URL com params da campanha preservados, só tracking de 3o removido', stripThirdPartyAffiliate(inputUrl)],
    ['C) wrapper universal-link', `${parsed.origin}/universal-link${parsed.pathname}${parsed.search}`],
    ['D) URL original COMPLETA (pode ser recusada por carregar afiliado 3o)', inputUrl],
  ]

  for (const [label, origin] of candidates) {
    const r = await genShortLink(origin, creds)
    console.log(`\n${label}`)
    console.log(`   origin enviada: ${origin}`)
    if (r.ok) console.log(`   >> SHORT LINK: ${r.link}   <-- toque neste no celular`)
    else console.log(`   >> recusado/erro: ${r.error}`)
  }
  console.log('\nToque em cada SHORT LINK acima dentro do WhatsApp no celular e anote qual ABRE O APP.')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect() } catch {} process.exit(1) })
