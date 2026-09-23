#!/usr/bin/env node
/**
 * Diagnóstico: o que a API de afiliado da Shopee responde para a chave de UMA
 * conta, operação por operação, comparado com uma conta que funciona.
 *
 * Pergunta que este script responde: o erro 10035 ("You currently do not have
 * access to the Shopee Affiliate Open API Platform") é da conta inteira ou só
 * de uma parte da API? Medido de fora com App ID INVENTADO, a Shopee devolve
 * 10035 tanto em `productOfferV2` quanto em `generateShortLink` — então 10035
 * pode significar simplesmente "esse App ID não tem acesso / não existe".
 *
 * O que ele faz:
 *   [1] mostra a forma do App ID cadastrado (sem o valor inteiro) e compara
 *       com o ID de afiliada que aparece nos links da própria cliente
 *       (`an_<numero>`) — colar o ID de afiliada no campo App ID é um engano
 *       comum;
 *   [2] chama `productOfferV2` por palavra-chave (só leitura);
 *   [3] chama `productOfferV2` pelo produto (só leitura);
 *   [4] chama `generateShortLink` (GERA um link curto do lado da Shopee — é o
 *       mesmo que o espelhamento faz a cada oferta; não publica nada);
 *   [5] mostra como terminaram os envios de Shopee da conta nas últimas 72h
 *       (se o espelhamento está mesmo saindo com link convertido);
 *   [6] repete [2] com a chave de OUTRA conta que converteu Shopee nas últimas
 *       48h — separa "problema da chave dela" de "a Shopee mudou para todos".
 *
 * NUNCA imprime a chave secreta nem o App ID inteiro.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-shopee-chave.mjs <email> [url-de-produto-shopee]
 */

import 'dotenv/config'
import axios from 'axios'
import crypto from 'crypto'
import db from '../src/db.js'
import { decryptCredential } from '../src/credentialCrypto.js'
import { resolveShopeeShortLink, extractShopeeIds } from '../src/converters/shopee.js'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
const [who, urlArg] = process.argv.slice(2)
if (!who) {
  console.error('Uso: node scripts/diag-shopee-chave.mjs <email> [url-de-produto-shopee]')
  process.exit(1)
}

function mask(value) {
  const s = String(value ?? '')
  if (!s) return '(vazio)'
  if (s.length <= 6) return `${s[0]}…(${s.length} caracteres)`
  return `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} caracteres, ${/^\d+$/.test(s) ? 'só números' : 'tem letras/símbolos'})`
}

async function callShopee(creds, query) {
  const body = { query }
  const payload = JSON.stringify(body)
  const ts = Math.floor(Date.now() / 1000)
  const sig = crypto.createHash('sha256').update(`${creds.appId}${ts}${payload}${creds.secretKey}`).digest('hex')
  try {
    const { status, data } = await axios.post(ENDPOINT, body, {
      headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${creds.appId}, Timestamp=${ts}, Signature=${sig}` },
      timeout: 10000,
      validateStatus: () => true,
    })
    const err = Array.isArray(data?.errors) ? data.errors[0] : null
    if (err) return `HTTP ${status} ERRO ${err?.extensions?.code ?? err?.code ?? '?'}: ${String(err?.message || '').slice(0, 140)}`
    return `HTTP ${status} OK ${JSON.stringify(data?.data).slice(0, 220)}`
  } catch (e) {
    return `FALHOU (rede): ${e?.message}`
  }
}

function loadCreds(row) {
  try {
    const c = JSON.parse(decryptCredential(row.data))
    return { appId: String(c?.appId ?? '').trim(), secretKey: String(c?.secretKey ?? '').trim() }
  } catch {
    return null
  }
}

const user = await db.user.findFirst({ where: { email: who }, select: { id: true, email: true } })
if (!user) {
  console.error(`Nenhuma conta com o e-mail "${who}".`)
  process.exit(1)
}
console.log(`\n=== Chave da Shopee — ${user.email} ===\n`)

const row = await db.credential.findFirst({ where: { userId: user.id, platform: 'shopee' } })
const creds = row ? loadCreds(row) : null
if (!creds?.appId || !creds?.secretKey) {
  console.log('[1] SEM App ID/chave secreta utilizáveis cadastrados. Nada a testar.')
  process.exit(0)
}

// Envios de Shopee das últimas 72h (usado em [1] e [5]).
const since = new Date(Date.now() - 72 * 3600_000)
let logs = []
try {
  logs = await db.messageLog.findMany({
    where: { userId: user.id, platform: { contains: 'shopee' }, sentAt: { gte: since } },
    select: { status: true, errorMsg: true, convertedUrl: true, originalUrl: true, sentAt: true },
    orderBy: { sentAt: 'desc' },
    take: 2000,
  })
} catch (e) {
  console.log(`(não consegui ler os envios: ${e?.message})`)
}

// [1] Forma do App ID x ID de afiliada visto nos links dela.
const affiliateIds = new Map()
const collectAn = (text) => {
  for (const m of String(text || '').matchAll(/an_(\d{6,})/g)) affiliateIds.set(m[1], (affiliateIds.get(m[1]) || 0) + 1)
}
collectAn(urlArg)
let resolvedArg = null
if (urlArg) {
  resolvedArg = await resolveShopeeShortLink(urlArg).catch(() => null)
  collectAn(resolvedArg)
}
console.log(`[1] App ID cadastrado: ${mask(creds.appId)}`)
console.log(`    Chave secreta: ${creds.secretKey.length} caracteres`)
if (affiliateIds.size) {
  for (const [id, n] of affiliateIds) {
    const igual = id === creds.appId
    console.log(`    ID de afiliada visto no link colado (an_${mask(id)}): ${igual ? '⚠ IGUAL ao App ID cadastrado — ela colou o ID de afiliada no campo App ID' : 'diferente do App ID (ok)'} [${n}x]`)
  }
} else {
  console.log('    (passe a URL do link de produto dela como 2º argumento para comparar com o ID de afiliada)')
}
console.log('')

// [2] productOfferV2 por palavra-chave (a mesma consulta da sondagem de saúde).
const Q_KEYWORD = '{ productOfferV2(keyword: "teste", listType: 1, sortType: 2, page: 1, limit: 1) { nodes { itemId } } }'
console.log(`[2] productOfferV2 (palavra-chave): ${await callShopee(creds, Q_KEYWORD)}\n`)

// [3] productOfferV2 pelo produto + [4] generateShortLink.
const ids = extractShopeeIds(resolvedArg || urlArg || '') || { shopId: '515433918', itemId: '19997980913' }
const Q_ITEM = `{ productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) { nodes { productName priceMin } } }`
console.log(`[3] productOfferV2 (produto ${ids.shopId}/${ids.itemId}): ${await callShopee(creds, Q_ITEM)}\n`)
const Q_LINK = `mutation { generateShortLink(input: { originUrl: "https://shopee.com.br/product/${ids.shopId}/${ids.itemId}", subIds: ["espelhagrupos"] }) { shortLink } }`
console.log(`[4] generateShortLink (o que o espelhamento usa): ${await callShopee(creds, Q_LINK)}\n`)

// [5] Como terminaram os envios de Shopee dela.
const tally = new Map()
let lastShortLink = null
for (const l of logs) {
  const key = `${l.status}${l.errorMsg ? ` | ${String(l.errorMsg).slice(0, 60)}` : ''}`
  tally.set(key, (tally.get(key) || 0) + 1)
  if (!lastShortLink && l.status === 'success' && /s\.shopee\.com\.br|shope\.ee/i.test(l.convertedUrl || '')) lastShortLink = l
}
console.log(`[5] Envios de Shopee nas últimas 72h: ${logs.length}`)
for (const [k, n] of [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${String(n).padStart(4)}  ${k}`)
console.log(lastShortLink
  ? `    Último envio com link curto de Shopee convertido: ${lastShortLink.sentAt.toISOString()} -> ${lastShortLink.convertedUrl}`
  : '    NENHUM envio de Shopee com link curto convertido nas últimas 72h.')
console.log('')

// [6] Conta de controle: outra conta que converteu Shopee nas últimas 48h.
try {
  const recent = await db.messageLog.findMany({
    where: {
      userId: { not: user.id },
      status: 'success',
      platform: { contains: 'shopee' },
      convertedUrl: { contains: 's.shopee.com.br' },
      sentAt: { gte: new Date(Date.now() - 48 * 3600_000) },
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 5,
  })
  let tested = false
  for (const r of recent) {
    const other = await db.credential.findFirst({ where: { userId: r.userId, platform: 'shopee' } })
    const otherCreds = other ? loadCreds(other) : null
    if (!otherCreds?.appId || !otherCreds?.secretKey) continue
    console.log(`[6] Conta de controle (${r.userId.slice(0, 6)}…, App ID ${mask(otherCreds.appId)}):`)
    console.log(`    productOfferV2 (palavra-chave): ${await callShopee(otherCreds, Q_KEYWORD)}`)
    tested = true
    break
  }
  if (!tested) console.log('[6] Nenhuma outra conta com Shopee convertido nas últimas 48h para comparar.')
} catch (e) {
  console.log(`[6] Não consegui buscar conta de controle: ${e?.message}`)
}

console.log(`
--- Leitura ---
  [1] App ID igual ao ID de afiliada          -> cadastro errado: ela precisa pegar o App ID na página
                                                 Open API do portal de afiliados da Shopee.
  [2]/[3]/[4] todos ERRO 10035                -> a Shopee não reconhece esse App ID (conta inteira).
  [4] OK e [2]/[3] ERRO 10035                 -> acesso só à geração de link, não ao catálogo.
  [5] sem link curto recente                  -> o espelhamento de Shopee também NÃO está convertendo.
  [6] ERRO 10035 na conta de controle         -> mudança da Shopee para todos, não da conta dela.
`)
process.exit(0)
