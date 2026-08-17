// Probe diagnóstico da SHEIN (rodar ANTES de implementar a loja).
//
// Responde a ÚNICA pergunta que decide se vale implementar a SHEIN:
// "pendurar o parâmetro de afiliada numa URL de produto credita comissão,
// ou a atribuição só vale no oneLink emitido pelo servidor da SHEIN?"
//
// Essa é a mesma armadilha já documentada no AGENTS.md para o Mercado Livre
// (pendurar `partner_id` em página não-produto NÃO credita) e para a Amazon
// (RCA 2026-07: link saía bonito e a comissão ia para o vazio por 8 dias).
// Descobrir isso agora custa 5 minutos; descobrir depois custa semanas de
// comissão perdida em silêncio.
//
// Uso:
//   node scripts/diag-shein-affiliate-link.mjs '<SEU oneLink DA SHEIN>' ['<link de produto>']
//
// Ex.:
//   node scripts/diag-shein-affiliate-link.mjs 'https://onelink.shein.com/14/4v4p6bpzshsx'
//
// O script é READ-ONLY: não toca no banco, não envia mensagem, não grava nada.
// Ele só resolve o seu oneLink, mostra qual é o seu identificador de afiliada
// e monta os links do teste. QUEM decide é você, clicando no celular.

const AFFILIATE_PARAMS = [
  'url_from', 'aff_id', 'src_identifier', 'koc_id',
  'onelink', 'requestId', 'campaign_id', 'goods_id', 'ad_type', 'campaign',
]
// Os que identificam a AFILIADA (candidatos a carregar o crédito da comissão).
const IDENTITY_PARAMS = ['url_from', 'koc_id', 'aff_id', 'src_identifier']
const SHEIN_PRODUCT_RE = /-p-(\d+)(?:-cat-(\d+))?\.html/i
// O oneLink de produto não usa o caminho `-p-<id>.html`: ele leva o produto no
// query param `goods_id`. As duas formas contam como "achei o produto".
const SHEIN_GOODS_ID_RE = /[?&]goods_id=(\d+)/i
// Página de captcha do sistema de risco da SHEIN. Ela responde 200 e guarda o
// destino real em `redirection` — seguir para ela PERDE os parâmetros do hop
// anterior, que é justamente onde está o dado que interessa.
const SHEIN_RISK_RE = /\/risk\/(?:challenge|action)/i

function isSheinShortLink(url) {
  return /^https?:\/\/(?:[a-z0-9-]+\.)*(?:onelink\.shein\.com|shein\.top)\//i.test(String(url || ''))
}

function hasProductId(url) {
  return SHEIN_PRODUCT_RE.test(url) || SHEIN_GOODS_ID_RE.test(url)
}

function readGoodsId(url) {
  return url.match(SHEIN_PRODUCT_RE)?.[1] || url.match(SHEIN_GOODS_ID_RE)?.[1] || null
}
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

const MAX_HOPS = 8
const TIMEOUT_MS = 12000

// oneLink não devolve 302: serve uma página-interstício que redireciona por JS.
// Por isso a resolução lê o CORPO, não só o cabeçalho Location — mesma lição do
// resolveShopeeShortLink (src/converters/shopee.js).
// O interstício do oneLink NÃO usa meta-refresh nem `location=`: ele guarda o
// destino num <input id="url"> escondido, que o JS da página lê. Esse é o
// padrão real medido em 2026-08 — por isso ele vem PRIMEIRO na lista.
const HTML_REDIRECT_PATTERNS = [
  /<input[^>]+id=["']url["'][^>]+value=["']([^"']+)["']/i,
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>\s]+)/i,
  /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
  /<link[^>]+rel=["']?canonical["']?[^>]+href=["']([^"']+)["']/i,
]

function extractRedirectFromHtml(html, baseUrl) {
  for (const re of HTML_REDIRECT_PATTERNS) {
    const m = html.match(re)
    if (m?.[1]) {
      try {
        return new URL(m[1].replace(/&amp;/g, '&'), baseUrl).toString()
      } catch {}
    }
  }
  return null
}

async function resolveOneLink(startUrl) {
  const hops = []
  let current = startUrl
  const cookieJar = new Map()

  for (let i = 0; i < MAX_HOPS; i++) {
    const cookieHeader = [...cookieJar].map(([k, v]) => `${k}=${v}`).join('; ')
    let res
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      })
    } catch (err) {
      hops.push({ url: current, status: 'ERRO DE REDE', note: err?.message || String(err) })
      break
    }

    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) cookieJar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }

    hops.push({ url: current, status: res.status })

    // Parou onde interessa: a URL já revela o produto.
    if (hasProductId(current)) break

    const location = res.headers.get('location')
    if (location) {
      let next
      try {
        next = new URL(location, current).toString()
      } catch {
        break
      }
      // Não entrar no captcha: o hop atual é o mais informativo que teremos.
      if (SHEIN_RISK_RE.test(next)) {
        hops[hops.length - 1].note = 'próximo hop é o captcha da SHEIN — parando aqui'
        break
      }
      current = next
      continue
    }

    if (!String(res.headers.get('content-type') || '').includes('text/html')) break

    let html = ''
    try {
      html = await res.text()
    } catch {
      break
    }

    const next = extractRedirectFromHtml(html, current)
    if (!next || next === current) {
      hops[hops.length - 1].note = 'fim da cadeia (sem redirect no corpo)'
      break
    }
    if (SHEIN_RISK_RE.test(next)) {
      hops[hops.length - 1].note = 'próximo hop é o captcha da SHEIN — parando aqui'
      break
    }
    current = next
  }

  return { finalUrl: current, hops }
}

function readAffiliateParams(url) {
  const found = {}
  try {
    const u = new URL(url)
    for (const key of AFFILIATE_PARAMS) {
      const value = u.searchParams.get(key)
      if (value) found[key] = value
    }
  } catch {}
  return found
}

// O que sai: identidade e sessão de QUEM GEROU o link. O que FICA: tudo que
// descreve o destino (`goods_id`, `campaign_id`, `ad_type`, `campaign`,
// `scene`, `test`) — sem isso a página não sabe qual produto abrir, e o link
// convertido nasceria quebrado.
const THIRD_PARTY_PARAMS = [
  'url_from', 'koc_id', 'aff_id', 'src_identifier',
  'onelink', 'requestId', 'behaviorId',
]

function stripAffiliateTracking(url) {
  try {
    const u = new URL(url)
    for (const key of THIRD_PARTY_PARAMS) u.searchParams.delete(key)
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key)) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return url
  }
}

function buildConvertedLink(productUrl, affiliateParams) {
  try {
    const u = new URL(stripAffiliateTracking(productUrl))
    // Só o que identifica VOCÊ. De fora ficam:
    // - `requestId`/`behaviorId`: rastro da sessão de quem gerou o link;
    // - `campaign_id`: pertence a uma campanha específica da SHEIN, não à
    //   afiliada. Levar isso para uma página de produto sujaria o teste — não
    //   dá para saber se o crédito veio da sua identificação ou da campanha.
    for (const key of IDENTITY_PARAMS) {
      if (affiliateParams[key]) u.searchParams.set(key, affiliateParams[key])
    }
    return u.toString()
  } catch {
    return null
  }
}

function line(char = '─') {
  return char.repeat(72)
}

async function main() {
  const oneLink = process.argv[2]
  const productArg = process.argv[3]

  if (!oneLink) {
    console.error('Falta o seu link de afiliada da SHEIN.\n')
    console.error("Uso: node scripts/diag-shein-affiliate-link.mjs '<seu oneLink>' ['<link de produto>']")
    process.exitCode = 1
    return
  }

  console.log(line('═'))
  console.log('TESTE DE COMISSÃO DA SHEIN — read-only, nada é enviado nem gravado')
  console.log(line('═'))

  console.log('\n1) RESOLVENDO O SEU LINK DE AFILIADA\n')
  const { finalUrl, hops } = await resolveOneLink(oneLink)
  for (const [i, hop] of hops.entries()) {
    console.log(`   ${i + 1}. [${hop.status}] ${hop.url}`)
    if (hop.note) console.log(`      ↳ ${hop.note}`)
  }

  console.log(`\n   Chegou em: ${finalUrl}`)

  const affiliateParams = readAffiliateParams(finalUrl)
  console.log('\n2) O QUE IDENTIFICA VOCÊ NESSE LINK\n')
  if (Object.keys(affiliateParams).length === 0) {
    console.log('   ⚠ Nenhum parâmetro de afiliada encontrado na URL final.')
    console.log('     Isso pode significar que a SHEIN atribui por cookie/sessão, e')
    console.log('     não pela URL — nesse caso NÃO dá para converter link sozinho.')
  } else {
    for (const [key, value] of Object.entries(affiliateParams)) {
      const isAttribution = IDENTITY_PARAMS.includes(key)
      console.log(`   ${isAttribution ? '✔' : '·'} ${key} = ${value}`)
    }
    console.log('\n   (✔ = provável parâmetro de comissão; · = rastro da sessão de quem gerou)')
  }

  // O 2º argumento pode ser um link de produto direto OU o oneLink de OUTRO
  // afiliado (o caso real: é isso que chega no grupo monitorado). Sendo oneLink,
  // resolvemos ele também — é exatamente o que o robô fará em produção.
  let productUrl = productArg || (hasProductId(finalUrl) ? finalUrl : null)
  let originInfo = null

  if (productArg && isSheinShortLink(productArg)) {
    console.log('\n1b) RESOLVENDO O LINK DE ORIGEM (do outro afiliado)\n')
    const origin = await resolveOneLink(productArg)
    for (const [i, hop] of origin.hops.entries()) {
      console.log(`   ${i + 1}. [${hop.status}] ${hop.url}`)
      if (hop.note) console.log(`      ↳ ${hop.note}`)
    }
    const originParams = readAffiliateParams(origin.finalUrl)
    originInfo = { url: origin.finalUrl, params: originParams }
    productUrl = origin.finalUrl
    console.log('\n   Quem ganha a comissão HOJE nesse link:')
    for (const key of IDENTITY_PARAMS) {
      if (originParams[key]) console.log(`      ${key} = ${originParams[key]}`)
    }
  }

  console.log('\n3) OS DOIS LINKS DO TESTE\n')
  if (!productUrl) {
    console.log('   Seu oneLink não aponta para um produto (é campanha/vitrine).')
    console.log('   Rode de novo passando um link de produto como 2º argumento:\n')
    console.log("   node scripts/diag-shein-affiliate-link.mjs '<seu oneLink>' \\")
    console.log("     'https://br.shein.com/algum-produto-p-485735309.html'")
  } else {
    const converted = buildConvertedLink(productUrl, affiliateParams)
    console.log(`   Produto (goods_id ${readGoodsId(productUrl) ?? '?'}):`)
    console.log(`   ${line()}`)
    console.log('   A) LINK OFICIAL (gerado pela SHEIN) — o controle:')
    console.log(`      ${oneLink}`)
    console.log('\n   B) LINK MONTADO POR NÓS — é este que precisa ser provado:')
    console.log(`      ${converted}`)
    console.log(`   ${line()}`)

    if (originInfo) {
      // Invariante do produto: o link de terceiro NUNCA pode ser encaminhado,
      // nem em pedaço. Se sobrar qualquer identificador do outro afiliado no
      // link convertido, a comissão vai para ele — falha grave e silenciosa.
      const leaked = IDENTITY_PARAMS
        .filter((key) => originInfo.params[key])
        .filter((key) => String(converted).includes(originInfo.params[key]))
      console.log('\n   Conferência de segurança:')
      if (leaked.length === 0) {
        console.log('   ✔ nenhum identificador do outro afiliado sobrou no link B')
      } else {
        console.log(`   ✘ VAZOU identificador do outro afiliado: ${leaked.join(', ')}`)
        console.log('     Não use esse link — a comissão iria para ele.')
      }
    }
  }

  console.log('\n4) COMO CONCLUIR O TESTE (só você pode fazer)\n')
  console.log('   1. Anote quantos cliques o seu painel da SHEIN mostra HOJE.')
  console.log('   2. No CELULAR, abra o link B (o montado por nós). Navegue um pouco.')
  console.log('   3. Espere o painel atualizar (pode levar algumas horas).')
  console.log('   4. Se o clique do link B aparecer → a conversão automática funciona,')
  console.log('      e a SHEIN pode ser implementada como as outras lojas.')
  console.log('      Se NÃO aparecer → a comissão só vale no link oficial da SHEIN,')
  console.log('      e converter link sozinho seria trabalhar de graça.')
  console.log('\n   Faça o teste com o celular fora do WiFi de casa se puder — assim')
  console.log('   você não confunde com um clique seu anterior.\n')
}

main().catch((err) => {
  console.error('Falhou:', err?.message || err)
  process.exitCode = 1
})
