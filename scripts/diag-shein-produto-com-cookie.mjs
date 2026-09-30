#!/usr/bin/env node
/**
 * Diagnóstico read-only: a SHEIN devolve NOME/PREÇO do produto para o nosso
 * servidor quando a chamada vai COM o cookie (código de acesso) da cliente?
 *
 * Contexto (2026-09-30, conta promosdaella): página de produto, vitrine do
 * oneLink e as APIs `productInfo/*` respondem captcha (`/risk/challenge`,
 * `/risk/action/limit`) para chamada SEM sessão — medido da VPS e de fora.
 * O único caminho que a SHEIN já aceita do servidor é a API de afiliada com
 * o cookie da cliente (é assim que o link curto sai). Este script repete os
 * mesmos endpoints COM esse cookie e diz, por endpoint, se veio título/preço.
 *
 * Não escreve nada. Não imprime cookie, token nem memberId.
 *
 * Uso (no VPS, DENTRO do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-shein-produto-com-cookie.mjs <email> [goods_id]
 *   (goods_id padrão: 529469487 — produto real de 30/09 da conta acima)
 */
import 'dotenv/config'
const [email, goodsIdArg] = process.argv.slice(2)
if (!email) { console.error('uso: node scripts/diag-shein-produto-com-cookie.mjs <email> [goods_id]'); process.exit(1) }
const goodsId = String(goodsIdArg || '529469487').replace(/\D/g, '')

const { default: db } = await import('../src/db.js')
const { decryptCredential } = await import('../src/credentialCrypto.js')
const { normalizeAmazonCookie: normalizeCookieExport } = await import('../src/converters/amazon.js')

const UA = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
const TIMEOUT_MS = 12_000

const user = await db.user.findUnique({ where: { email }, select: { id: true } })
if (!user) { console.error('conta não encontrada'); process.exit(1) }
const row = await db.credential.findUnique({ where: { userId_platform: { userId: user.id, platform: 'shein' } } })
if (!row) { console.error('conta sem cadastro SHEIN'); process.exit(1) }
let creds = {}
try { creds = JSON.parse(decryptCredential(row.data)) } catch { console.error('cadastro SHEIN ilegível'); process.exit(1) }
const cookie = normalizeCookieExport(creds?.cookie).trim()
const tag = String(creds?.tag || '').trim()
console.log({ goodsId, temCookie: cookie.length > 0, tamanhoCookie: cookie.length, temTag: tag.length > 0 })
if (!cookie) process.exit(1)

function resumo(html) {
  const t = String(html || '')
  const pick = (re) => (t.match(re)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return {
    bytes: t.length,
    captcha: /risk\/(?:challenge|action)/i.test(t) || /captcha/i.test(t.slice(0, 5000)),
    ogTitle: pick(/property=["']og:title["'][^>]*content=["']([^"']{3,})["']/i) || pick(/<title>([^<]{3,})<\/title>/i),
    goodsName: pick(/"goods_name"\s*:\s*"([^"]{3,})"/i),
    preco: pick(/"(?:salePrice|retailPrice)"\s*:\s*\{[^}]*"amountWithSymbol"\s*:\s*"([^"]+)"/i) || pick(/(R\$\s?\d[\d.]*,\d{2})/),
  }
}

async function chamar(nome, url, { headers = {}, method = 'GET', body } = {}) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method, body, redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: 'application/json,text/html;q=0.9,*/*;q=0.8', 'Accept-Language': 'pt-BR,pt;q=0.9', ...headers },
    })
    const location = res.headers.get('location') || ''
    const texto = await res.text().catch(() => '')
    const r = resumo(texto)
    console.log(`\n-- ${nome}`)
    console.log({ http: res.status, ms: Date.now() - t0, redirectParaRisk: /\/risk\//i.test(location), ...r })
    return { status: res.status, texto }
  } catch (err) {
    console.log(`\n-- ${nome}`)
    console.log({ erro: err?.name || 'erro', ms: Date.now() - t0 })
    return { status: 0, texto: '' }
  }
}

const comCookie = { Cookie: cookie }
const bff = { 'bff-source': 'shein;pwa', 'Content-Type': 'application/json' }

// 1) sessão (mesma chamada do encurtador) — decide se o cookie ainda vale
const site = await chamar('getSiteInfo COM cookie', 'https://m.shein.com/br/api/others/getSiteInfo', { headers: { ...comCookie, ...bff } })
let sess = {}
try { sess = JSON.parse(site.texto) } catch {}
const logado = Boolean(String(sess?.memberId || '').trim())
console.log({ sessaoLogada: logado, siteUid: sess?.SiteUID || null, language: sess?.appLanguage || null })
const tokenHeaders = logado ? { token: sess.token || '', siteuid: sess.SiteUID || 'mbr', localcountry: 'BR', language: sess.appLanguage || 'pt-br', mi: sess.memberId } : {}

// 2) página de produto e vitrine do oneLink, COM cookie
await chamar('produto m.shein.com COM cookie', `https://m.shein.com/br/-p-${goodsId}.html`, { headers: comCookie })
await chamar('produto br.shein.com COM cookie', `https://br.shein.com/-p-${goodsId}.html`, { headers: comCookie })
const ark = await chamar('vitrine ark/default COM cookie', `https://m.shein.com/br/ark/default?goods_id=${goodsId}&scene=1&test=5051&ad_type=KOC&campaign=goods&campaign_id=20`, { headers: comCookie })
// A vitrine foi a ÚNICA página que a SHEIN entregou ao servidor (30/09, 772 KB,
// com "R$79,99" dentro). Guarda o corpo (sem cookie/token — é só o HTML da
// resposta) e mostra onde nome/preço aparecem, para decidir se dá para ler
// título/preço por aqui.
if (ark.texto) {
  const { writeFileSync } = await import('node:fs')
  const arquivo = `/tmp/shein-ark-${goodsId}.html`
  writeFileSync(arquivo, ark.texto)
  const t = ark.texto
  const achados = {}
  for (const [nome, re] of Object.entries({
    goods_name: /"goods_name"\s*:\s*"([^"]{3,120})"/g,
    goodsName: /"goodsName"\s*:\s*"([^"]{3,120})"/g,
    productName: /"productName"\s*:\s*"([^"]{3,120})"/g,
    og_title: /property=["']og:title["'][^>]*content=["']([^"']{3,120})["']/g,
    title_tag: /<title>([^<]{3,120})<\/title>/g,
    amountWithSymbol: /"amountWithSymbol"\s*:\s*"([^"]{2,30})"/g,
    reais: /(R\$\s?\d[\d.]*,\d{2})/g,
    goods_id_ctx: new RegExp(`.{0,80}${goodsId}.{0,80}`, 'g'),
  })) {
    const vals = [...t.matchAll(re)].map(m => (m[1] ?? m[0]).replace(/\s+/g, ' ').trim()).filter(Boolean)
    achados[nome] = { ocorrencias: vals.length, primeiras: [...new Set(vals)].slice(0, 4) }
  }
  console.log({ arquivoSalvo: arquivo, bytes: t.length })
  console.log(JSON.stringify(achados, null, 1))
}

// 3) APIs JSON de produto, COM cookie + token de sessão
const q = `goods_id=${goodsId}&_ver=1.1.8&_lang=pt-br`
await chamar('api productInfo/quickView COM cookie+token', `https://m.shein.com/br/api/productInfo/quickView/get?${q}`, { headers: { ...comCookie, ...bff, ...tokenHeaders } })
await chamar('api productInfo/attr COM cookie+token', `https://m.shein.com/br/api/productInfo/attr/get?${q}`, { headers: { ...comCookie, ...bff, ...tokenHeaders } })
await chamar('api productInfo/detailImage COM cookie+token', `https://m.shein.com/br/api/productInfo/detailImage/get?${q}`, { headers: { ...comCookie, ...bff, ...tokenHeaders } })

// 4) o encurtador de afiliada devolve algo além do oneLink? (mesma chamada do produto)
if (logado) {
  await chamar('affiliate share/link/from/url (resposta completa, sem link)', 'https://m.shein.com/br/affiliate/api/share/link/from/url', {
    method: 'POST',
    headers: { ...comCookie, ...bff, 'X-Requested-With': 'XMLHttpRequest', ...tokenHeaders },
    body: JSON.stringify({ url: `https://br.shein.com/-p-${goodsId}.html`, language: sess.appLanguage || 'pt-br', uid: sess.memberId }),
  }).then(({ texto }) => { try { const d = JSON.parse(texto); console.log({ code: d?.code, chavesDeInfo: Object.keys(d?.info || {}) }) } catch {} })
}

console.log('\nLeitura: "captcha:true" ou "redirectParaRisk:true" = a SHEIN bloqueia mesmo com o cookie. "goodsName"/"preco" preenchidos = dá para ler nome/preço por esse endpoint.')
await db.$disconnect()
