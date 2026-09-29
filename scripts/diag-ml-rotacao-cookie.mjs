#!/usr/bin/env node
/**
 * Diagnóstico ao vivo: o Mercado Livre DEVOLVE cookie novo (rotação) quando o
 * robô fala com ele — e em qual rota?
 *
 * Por que importa: o robô usa o código de acesso da cliente em DUAS rotas —
 *   (1) POST createLink (src/converters/mercadolivre.js) — guarda Set-Cookie;
 *   (2) GET da página do produto para montar o card
 *       (fetchHtml em src/converters/productInfoScraper.js) — IGNORA Set-Cookie.
 * Se o ML rotaciona o `ssid` na rota (2) e invalida o antigo depois de um
 * tempo, é o próprio robô que mata o código (hipótese H7). Se nenhuma rota
 * devolve `ssid`, a renovação acontece só no navegador (H1/H6) ou o prazo é
 * fixo do lado do ML.
 *
 * O script faz NO MÁXIMO 3 requests ao ML com a credencial real e imprime só:
 * status, se caiu no muro anti-robô, NOMES dos cookies do Set-Cookie (nunca o
 * valor), se o `ssid` recebido é diferente do guardado (sim/não) e os
 * atributos Max-Age/Expires do `ssid`. Também descreve o FORMATO do ssid
 * guardado (tamanho, se tem segmentos decodificáveis com data) sem imprimi-lo.
 *
 * Read-only: NADA é gravado. Rodar em produção só com OK da dona do produto
 * (usa a credencial de uma cliente; são até 3 chamadas — o robô faz dezenas
 * por hora com a mesma credencial).
 *
 * Uso:
 *   cd ~/wabot && node scripts/diag-ml-rotacao-cookie.mjs --email=x@y [--url=https://www.mercadolivre.com.br/p/MLB...]
 *   --url  = página de produto do ML para repetir o GET que o card faz (opcional)
 *   --sem-probe = pula o createLink (só as páginas)
 */

import 'dotenv/config'
import db from '../src/db.js'
import { parseCredentialData } from '../src/credentialHealth.js'
import { checkMercadoLivreSession } from '../src/converters/mercadolivre.js'

const ML_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
const LINKBUILDER_URL = 'https://www.mercadolivre.com.br/afiliados/linkbuilder'

function arg(name, fallback = null) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const has = flag => process.argv.includes(`--${flag}`)

function jarGet(cookieHeader, name) {
  for (const part of String(cookieHeader || '').split(';')) {
    const t = part.trim()
    const eq = t.indexOf('=')
    if (eq > 0 && t.slice(0, eq) === name) return t.slice(eq + 1)
  }
  return null
}
function jarNames(cookieHeader) {
  return String(cookieHeader || '').split(';').map(p => p.trim().split('=')[0]).filter(Boolean)
}

function buildCookieHeader(creds) {
  if (creds.cookie) return String(creds.cookie)
  const pairs = []
  if (creds.id) pairs.push(`id=${creds.id}`)
  if (creds.csrf) pairs.push(`_csrf=${creds.csrf}`)
  if (creds.ssid) pairs.push(`ssid=${creds.ssid}`)
  return pairs.join('; ')
}

// Descreve um Set-Cookie sem expor valor: nome, se é deleção, Max-Age/Expires.
function describeSetCookie(line, currentJar) {
  const first = String(line).split(';')[0]
  const eq = first.indexOf('=')
  const name = first.slice(0, eq).trim()
  const value = first.slice(eq + 1).trim()
  const maxAge = /;\s*max-age\s*=\s*(-?\d+)/i.exec(line)?.[1]
  const expires = /;\s*expires\s*=\s*([^;]+)/i.exec(line)?.[1]?.trim()
  const deletion = value === '' || maxAge === '0' || (expires && Date.parse(expires) <= Date.now())
  const stored = jarGet(currentJar, name)
  const rel = stored === null ? 'novo no jar' : stored === value ? 'igual ao guardado' : 'DIFERENTE do guardado'
  const ttl = maxAge ? `Max-Age=${maxAge}s (~${Math.round(Number(maxAge) / 3600)}h)` : expires ? `Expires=${expires}` : 'de sessão (sem prazo)'
  return `${name.padEnd(22)} ${deletion ? 'DELEÇÃO' : 'valor'.padEnd(7)} | ${rel.padEnd(22)} | ${ttl}`
}

// Formato do ssid sem imprimir o valor: tamanho, classes de caractere e, se
// algum segmento base64/base64url decodifica em JSON com número parecido com
// data (2020–2040, em s ou ms), imprime só esse campo como data.
function describeSsidShape(ssid) {
  const s = String(ssid || '')
  if (!s) return ['(vazio)']
  const out = [`tamanho ${s.length}; só [A-Za-z0-9]? ${/^[A-Za-z0-9]+$/.test(s) ? 'sim' : 'não'}; pontos: ${(s.match(/\./g) || []).length}; hífens/underscores: ${(s.match(/[-_]/g) || []).length}`]
  const segs = s.includes('.') ? s.split('.') : [s]
  segs.forEach((seg, i) => {
    for (const enc of ['base64url', 'base64']) {
      try {
        const txt = Buffer.from(seg, enc).toString('utf8')
        if (!/^[\x20-\x7e]+$/.test(txt)) continue
        let json = null
        try { json = JSON.parse(txt) } catch {}
        if (json && typeof json === 'object') {
          const datas = Object.entries(json)
            .filter(([, v]) => typeof v === 'number' && (v > 1.5e9 && v < 2.3e9 || v > 1.5e12 && v < 2.3e12))
            .map(([k, v]) => `${k}=${new Date(v > 1e11 ? v : v * 1000).toISOString()}`)
          out.push(`segmento ${i + 1} decodifica em JSON (${enc}); chaves: ${Object.keys(json).join(',')}${datas.length ? `; datas: ${datas.join(' ')}` : ''}`)
          break
        }
        const nums = txt.match(/\b1[5-9]\d{8}\b|\b2[0-2]\d{8}\b/g)
        if (nums) { out.push(`segmento ${i + 1} (${enc}) contém possível epoch: ${nums.map(n => new Date(Number(n) * 1000).toISOString()).join(' ')}`); break }
      } catch {}
    }
  })
  const plain = s.match(/\b1[5-9]\d{8}\b|\b2[0-2]\d{8}\b|\b1[5-9]\d{11}\b/g)
  if (plain) out.push(`valor cru contém possível epoch: ${plain.map(n => new Date(n.length > 10 ? Number(n) : Number(n) * 1000).toISOString()).join(' ')}`)
  return out
}

async function getPage(url, cookieHeader, label) {
  console.log(`\n--- GET ${label}: ${url} (UA iPhone, redirect manual, cookie = jar guardado) ---`)
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': ML_MOBILE_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        Cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(15000),
    })
    const location = res.headers.get('location') || ''
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    let corpo = ''
    if (!location) corpo = (await res.text()).slice(0, 400000)
    const muro = /account-verification|suspicious-traffic|gz-verify/i.test(corpo) || /account-verification|gz\/verify|login/i.test(location)
    const logado = /ui-pdp|andes-money-amount|nav-header-user|linkbuilder|"logged":true|nickname/i.test(corpo)
    console.log(`hop ${hop}: status ${res.status}${location ? ` → ${location.replace(/\?.*/, '?…')}` : ''} | muro anti-robô/login: ${muro ? 'SIM' : 'não'} | sinais de página logada/produto: ${logado ? 'sim' : 'não'} | Set-Cookie: ${setCookies.length}`)
    for (const line of setCookies) console.log(`   ${describeSetCookie(line, cookieHeader)}`)
    if (!location) break
    current = new URL(location, current).toString()
  }
}

async function main() {
  const email = arg('email')
  if (!email) { console.error('Uso: node scripts/diag-ml-rotacao-cookie.mjs --email=x@y [--url=...] [--sem-probe]'); process.exit(1) }
  const user = await db.user.findUnique({ where: { email }, include: { credentials: true } })
  if (!user) { console.error(`Usuário não encontrado: ${email}`); process.exit(2) }
  const row = user.credentials.find(c => c.platform === 'mercadolivre')
  if (!row) { console.error('Sem credencial do Mercado Livre'); process.exit(3) }
  const creds = parseCredentialData(row.data)
  const jar = buildCookieHeader(creds)

  console.log(`USUÁRIO: ${user.email} (id=${user.id})`)
  console.log(`cookies no jar guardado (só nomes): ${jarNames(jar).join(', ') || '(nenhum)'}`)
  console.log('formato do ssid guardado:')
  for (const l of describeSsidShape(creds.ssid || jarGet(jar, 'ssid'))) console.log(`   ${l}`)
  console.log('(um navegador logado no ML manda ~15–25 cookies; o jar colado costuma ter 3. Cookies de aparelho/fingerprint ausentes = possível causa de expiração precoce — hipótese H3)')

  if (!has('sem-probe')) {
    console.log('\n--- POST createLink (sondagem neutra, mesma função do painel) ---')
    const probe = await checkMercadoLivreSession(creds)
    const { credentialPatch, ...publico } = probe
    console.log(JSON.stringify(publico))
    if (!credentialPatch) console.log('sem rotação: o ML não devolveu cookie novo nesta rota.')
    else {
      const names = jarNames(credentialPatch.cookie).filter(n => jarGet(credentialPatch.cookie, n) !== jarGet(jar, n))
      console.log(`rotação: cookies alterados = ${names.join(', ')} | ssid mudaria? ${credentialPatch.ssid && credentialPatch.ssid !== (creds.ssid || jarGet(jar, 'ssid')) ? 'SIM' : 'não'}`)
    }
  }

  await getPage(LINKBUILDER_URL, jar, 'página do gerador de links (o que o navegador da cliente carrega)')
  const url = arg('url')
  if (url) await getPage(url, jar, 'página de produto (o que o card do robô faz, sem guardar Set-Cookie)')
  else console.log('\n(passe --url=<página de produto do ML> para repetir o GET que o card faz)')

  console.log('\nComo ler: `ssid` com "DIFERENTE do guardado" em alguma rota = o ML rotaciona e nós descartamos (H7, corrigível no código).')
  console.log('Nenhuma rota devolve ssid = renovação não vem por aqui; medir prazo fixo com scripts/exp-ml-manter-viva.mjs em conta de teste.')
  console.log('(NADA foi gravado por este script.)')
  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('FALHA:', err?.message || err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
