#!/usr/bin/env node
/**
 * Diagnóstico: por que "Criar oferta" com um link de Shopee específico não
 * traz nome nem preço.
 *
 * `buildScrapedOffer` (offerEngine.js) chama `fetchProductInfo`, que para
 * Shopee tenta, nesta ordem: (1) API de afiliado (productOfferV2, com as
 * credenciais DA CLIENTE); (2) API pública v4 (item/get, sem credencial —
 * documentada como instável, responde 403/90309999 com frequência de IP de
 * datacenter). Se as duas falharem, sobra só o fallback de título por slug da
 * URL — que não existe em short link (`s.shopee.com.br/...`). Esse caminho é
 * MUDO hoje (fetchShopeeProductInfo engole qualquer erro em `catch { return
 * null }`), então não dá pra saber qual das duas falhou sem reproduzir aqui.
 *
 * Read-only: não grava nada, não gera link novo, não altera credencial.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-criar-oferta-shopee.mjs <email> <url-da-shopee>
 */

import 'dotenv/config'
import axios from 'axios'
import crypto from 'crypto'
import db from '../src/db.js'
import { decryptCredential } from '../src/credentialCrypto.js'
import {
  resolveShopeeShortLink,
  extractShopeeIds,
  fetchShopeeProductInfo,
} from '../src/converters/shopee.js'
import { fetchProductInfo } from '../src/converters/productInfoScraper.js'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

const [who, url] = process.argv.slice(2)
if (!who || !url) {
  console.error('Uso: node scripts/diag-criar-oferta-shopee.mjs <email> <url-da-shopee>')
  process.exit(1)
}

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const base = `${appId}${timestamp}${payload}${secretKey}`
  const signature = crypto.createHash('sha256').update(base).digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
}

const user = await db.user.findFirst({
  where: { OR: [{ email: { contains: who } }, { name: { contains: who } }] },
  select: { id: true, name: true, email: true },
})
if (!user) {
  console.error(`Nenhuma conta encontrada para "${who}".`)
  process.exit(1)
}
console.log(`\n=== Criar oferta — Shopee — ${user.name} <${user.email}> ===`)
console.log(`Link: ${url}\n`)

const row = await db.credential.findFirst({ where: { userId: user.id, platform: 'shopee' } })
let creds = null
try { creds = row ? JSON.parse(decryptCredential(row.data)) : null } catch { creds = null }

if (!creds?.appId || !creds?.secretKey) {
  console.log('[1] Credencial: SEM appId/secretKey utilizáveis.')
  console.log('    -> Sem chave, só sobra a API pública v4 (instável) e o fallback de título por slug.\n')
} else {
  console.log(`[1] Credencial: presente (appId ${String(creds.appId).slice(0, 4)}…)\n`)
}

console.log('[2] Resolução do short link...')
const canonical = await resolveShopeeShortLink(url)
const ids = extractShopeeIds(canonical)
console.log(`    URL resolvida: ${canonical}`)
console.log(`    IDs extraídos: ${ids ? `shopId=${ids.shopId} itemId=${ids.itemId}` : 'NENHUM'}\n`)

if (ids && creds?.appId) {
  console.log('[3] API de afiliado (productOfferV2), resposta CRUA...')
  const body = {
    query: `{
      productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) {
        nodes { imageUrl productName price priceMin priceMax priceDiscountRate }
      }
    }`,
  }
  const payload = JSON.stringify(body)
  try {
    const { status, data } = await axios.post(ENDPOINT, body, {
      headers: { Authorization: buildAuth(creds.appId, creds.secretKey, payload), 'Content-Type': 'application/json' },
      timeout: 8000,
    })
    console.log(`    HTTP ${status}`)
    console.log(`    ${JSON.stringify(data)}\n`)
  } catch (err) {
    console.log(`    Falhou: ${err?.response?.status || ''} ${err?.message}\n`)
  }

  const affiliateResult = await fetchShopeeProductInfo(url, creds)
  console.log(`[3b] fetchShopeeProductInfo() (o que o motor de oferta de fato usa): ${JSON.stringify(affiliateResult)}\n`)
} else if (!ids) {
  console.log('[3] Pulado — sem IDs não dá pra chamar a API de afiliado.\n')
} else {
  console.log('[3] Pulado — sem credencial utilizável.\n')
}

if (ids) {
  console.log('[4] API pública v4 (item/get, sem credencial, fallback conhecido como instável)...')
  const spcToken = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  try {
    const res = await fetch(`https://shopee.com.br/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json,text/plain,*/*',
        Referer: `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`,
        Cookie: `SPC_F=${spcToken}; csrftoken=${spcToken}`,
        'x-csrftoken': spcToken,
        'x-api-source': 'pc',
      },
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    console.log(`    HTTP ${res.status}`)
    console.log(`    ${text.slice(0, 500)}\n`)
  } catch (err) {
    console.log(`    Falhou: ${err?.message}\n`)
  }
}

console.log('[5] fetchProductInfo() — resultado final que "Criar oferta" recebe...')
const info = await fetchProductInfo(url, { shopeeCreds: creds })
console.log(`    ${JSON.stringify(info)}\n`)

console.log('--- Leitura ---')
console.log('  [3] com "errors" no corpo         -> chave recusada ou item fora do catálogo de afiliado (ver code/message)')
console.log('  [3] sem node/nodes vazio           -> item_fora_do_catalogo_de_afiliado (não é defeito nosso)')
console.log('  [4] HTTP 403 / error 90309999      -> API pública recusou (comportamento conhecido, não é regressão)')
console.log('  [5] title/newPrice vazios          -> é isto que a cliente vê: oferta sem nome/preço\n')
process.exit(0)
