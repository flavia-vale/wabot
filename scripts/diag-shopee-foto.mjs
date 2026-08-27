#!/usr/bin/env node
/**
 * Diagnóstico: por que a foto da SHOPEE não vem.
 *
 * A Shopee tem UMA fonte de foto que funciona — a API de afiliado (GraphQL).
 * O shell SPA da página não traz og:image e a API v4 pública é bloqueada
 * (AGENTS.md, seção "Image scrapers"). Então, quando a API de afiliado não
 * devolve a foto, a oferta fica sem foto de loja e passa a depender da
 * miniatura que veio na mensagem de origem — que às vezes tem 500 bytes.
 *
 * O Mercado Livre não sofre disso porque tem TRÊS fontes (vitrine, API, página).
 *
 * Este script NÃO grava nada. Para cada link de Shopee publicado recentemente:
 *   1) resolve o short link;
 *   2) extrai (shopId, itemId);
 *   3) chama a API de afiliado com as credenciais DA CLIENTE e imprime a
 *      resposta CRUA (a API responde 200 mesmo em erro, sinalizando em
 *      `errors` — chave recusada parece "produto sem foto");
 *   4) diz, em uma linha, qual é o motivo.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-shopee-foto.mjs <email|nome> [--days=2] [--sample=8]
 */

import 'dotenv/config'
import axios from 'axios'
import crypto from 'crypto'
import db from '../src/db.js'
import { decryptCredential } from '../src/credentialCrypto.js'
import { resolveShopeeShortLink, extractShopeeIds } from '../src/converters/shopee.js'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
const arg = name => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : null
}
const who = process.argv.slice(2).find(a => !a.startsWith('--'))
const days = Number(arg('days') || 2)
const sample = Number(arg('sample') || 8)

if (!who) {
  console.error('Uso: node scripts/diag-shopee-foto.mjs <email|nome> [--days=2] [--sample=8]')
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
console.log(`\n=== Foto da Shopee — ${user.name} <${user.email}> ===\n`)

const row = await db.credential.findFirst({ where: { userId: user.id, platform: 'shopee' } })
let creds = null
try { creds = row ? JSON.parse(decryptCredential(row.data)) : null } catch { creds = null }
if (!creds?.appId || !creds?.secretKey) {
  console.log('[credencial] SEM appId/secretKey utilizáveis — a API de afiliado nem é chamada.')
  console.log('             Sem ela a Shopee não tem NENHUMA fonte de foto.\n')
  process.exit(0)
}
console.log(`[credencial] appId ${String(creds.appId).slice(0, 4)}…  (chave presente)\n`)

const since = new Date(Date.now() - days * 86400_000)
const envios = await db.messageLog.findMany({
  where: { userId: user.id, platform: { contains: 'shopee' }, sentAt: { gte: since } },
  select: { originalUrl: true, convertedUrl: true, sentAt: true },
  orderBy: { sentAt: 'desc' },
  take: sample * 4,
})

const vistos = new Set()
const alvos = []
for (const e of envios) {
  const url = e.originalUrl || e.convertedUrl
  if (!url || vistos.has(url)) continue
  vistos.add(url)
  alvos.push(url)
  if (alvos.length >= sample) break
}
if (!alvos.length) {
  console.log(`Nenhum envio de Shopee nos últimos ${days} dia(s).`)
  process.exit(0)
}

const tally = new Map()
for (const url of alvos) {
  let motivo = ''
  let detalhe = ''
  try {
    const canonical = await resolveShopeeShortLink(url)
    const ids = extractShopeeIds(canonical)
    if (!ids) {
      motivo = 'short_link_nao_resolveu'
      detalhe = canonical
    } else {
      const body = {
        query: `{ productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) { nodes { imageUrl productName } } }`,
      }
      const payload = JSON.stringify(body)
      const { data } = await axios.post(ENDPOINT, body, {
        headers: { Authorization: buildAuth(creds.appId, creds.secretKey, payload), 'Content-Type': 'application/json' },
        timeout: 8000,
      })
      const apiError = Array.isArray(data?.errors) ? data.errors[0] : null
      const node = data?.data?.productOfferV2?.nodes?.[0]
      if (apiError) {
        motivo = 'api_recusou'
        detalhe = `${apiError.code ?? ''} ${apiError.message ?? ''}`.trim()
      } else if (!node) {
        motivo = 'item_fora_do_catalogo_de_afiliado'
        detalhe = `${ids.shopId}/${ids.itemId}`
      } else if (!node.imageUrl) {
        motivo = 'catalogo_sem_imageUrl'
        detalhe = node.productName || ''
      } else {
        motivo = 'OK_foto_disponivel'
        detalhe = node.imageUrl
      }
    }
  } catch (err) {
    motivo = 'excecao'
    detalhe = err?.message || String(err)
  }
  tally.set(motivo, (tally.get(motivo) || 0) + 1)
  console.log(`  ${motivo.padEnd(36)} ${url}`)
  if (detalhe) console.log(`  ${' '.repeat(36)} ↳ ${detalhe}`)
}

console.log('\n--- Resumo ---')
for (const [motivo, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${motivo}`)
}
console.log(`
Leitura:
  api_recusou                        -> a chave da Shopee dela está sendo recusada
                                        (o mesmo erro que derruba a conversão).
  item_fora_do_catalogo_de_afiliado  -> não é defeito nosso: a Shopee só devolve
                                        foto de item que está no catálogo de
                                        afiliado. Aqui a única saída é a foto que
                                        veio na mensagem de origem.
  short_link_nao_resolveu            -> a cadeia de redirect da Shopee mudou.
`)
process.exit(0)
