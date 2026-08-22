// Probe do GERADOR DE LINK da SHEIN — descobre se dá para encurtar o link de
// oferta pelo mesmo caminho que o painel de afiliada usa, em vez de publicar a
// forma longa.
//
// POR QUE ISTO EXISTE
//
// O link curto (`onelink.shein.com/48/<código>`) NÃO é derivável: o código é um
// registro opaco criado no servidor da SHEIN. Medido: código inventado não dá
// erro, só redireciona para a home; e `shein.top` não aceita nada arbitrário.
// Logo, só a própria SHEIN emite. O painel de afiliada faz isso por um endpoint
// interno, e este script confere se ele responde a uma chamada de servidor.
//
// O QUE JÁ FOI MEDIDO (sem credencial de ninguém):
//   POST sem token          -> 403 {"code":"100105","msg":"Forbidden"}
//   POST com token inválido -> 200 {"code":"100103","msg":"Unauthorized"}
//   POST com token de visitante -> 200 {"code":"100103"}
// Nenhuma dessas respostas trouxe captcha nem pediu assinatura anti-robô — a
// única barreira observada foi identidade. O que este script fecha é a última
// dúvida: com uma sessão REAL, o endpoint aceita chamada de fora do navegador?
//
// SEGURANÇA — leia antes de rodar:
// - O código de acesso entra por variável de ambiente, NUNCA por argumento
//   (argumento fica no histórico do shell e aparece em `ps`).
// - O script NÃO imprime o código de acesso, nem o token, em nenhuma hipótese.
// - Ele gera UM link de afiliada real na sua conta (é o que o Gerador de Link
//   faria se você clicasse). Não apaga nada, não altera cadastro, não envia
//   mensagem.
//
// USO:
//   export SHEIN_COOKIE='cole aqui o cookie inteiro da shein.com logada'
//   node scripts/diag-shein-shortlink.mjs 'https://br.shein.com/<produto>-p-<id>.html'
//
// Para pegar o cookie: com a SHEIN aberta e logada no computador, clique na
// extensão Cookie-Editor -> Export -> "Header string". É esse valor.

const SITE_INFO_URL = 'https://m.shein.com/br/api/others/getSiteInfo'
const SHORTEN_URL = 'https://m.shein.com/br/affiliate/api/share/link/from/url'
const TIMEOUT_MS = 15000

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

function line(char = '─') {
  return char.repeat(72)
}

// Nunca imprimir segredo: só o formato, para a pessoa conferir que colou algo
// plausível sem o valor aparecer na tela nem no log do terminal.
function describeSecret(value) {
  const v = String(value || '')
  if (!v) return 'vazio'
  const pares = (v.match(/=/g) || []).length
  return `${v.length} caracteres, ${pares} campo(s)`
}

async function postJson(url, { token, memberId, siteUid, language, body }) {
  return fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache',
      token: token || '',
      siteuid: siteUid || 'mbr',
      localcountry: 'BR',
      language: language || 'pt-br',
      mi: memberId || '',
    },
    body: JSON.stringify(body),
  })
}


// ── Modo descoberta ────────────────────────────────────────────────────────
// Descobre o CONJUNTO MÍNIMO de cookies que a SHEIN precisa para reconhecer a
// sessão. Existe por uma razão de privacidade: o botão Export do Cookie-Editor
// copia tudo (carrinho, navegação, identificador de aparelho), e guardar isso
// inteiro é pedir muito mais do que o necessário para gerar um link.
//
// Estratégia: elimina um cookie por vez e vê se a SHEIN ainda devolve o
// memberId. O que puder sair, sai. Só chama `getSiteInfo`, que é leitura — não
// gera link nem altera nada.
//
// Imprime apenas os NOMES dos cookies necessários. Nenhum valor é exibido.
function parseCookiePairs(raw) {
  const texto = String(raw || '').trim()
  const lista = texto.startsWith('[') || texto.startsWith('{')
    ? (() => { try { const j = JSON.parse(texto); return (Array.isArray(j) ? j : [j]).map(c => [String(c?.name || ''), String(c?.value ?? '')]) } catch { return [] } })()
    : texto.split(';').map(p => { const i = p.indexOf('='); return i < 0 ? null : [p.slice(0, i).trim(), p.slice(i + 1).trim()] }).filter(Boolean)
  return lista.filter(([nome]) => nome)
}

function montarHeader(pares) {
  return pares.map(([n, v]) => `${n}=${v}`).join('; ')
}

async function sessaoReconhecida(pares) {
  try {
    const res = await fetch(SITE_INFO_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': BROWSER_UA, Accept: 'application/json',
        'Content-Type': 'application/json', 'bff-source': 'shein;pwa',
        Cookie: montarHeader(pares),
      },
    })
    const info = await res.json()
    return Boolean(String(info?.memberId || '').trim())
  } catch {
    return false
  }
}

async function descobrirMinimo(cookieBruto) {
  console.log(line('═'))
  console.log('DESCOBRINDO O MÍNIMO NECESSÁRIO')
  console.log(line('═'))

  let pares = parseCookiePairs(cookieBruto)
  console.log(`\nO seu Export tem ${pares.length} cookies.`)
  if (!pares.length) { console.log('Não consegui ler nenhum cookie. Confira o que foi colado.'); return }

  console.log('Conferindo se a SHEIN reconhece a sessão com todos...')
  if (!(await sessaoReconhecida(pares))) {
    console.log('\n✘ A SHEIN não reconheceu nem com o pacote completo.')
    console.log('  O código venceu ou foi copiado pela metade. Faça login de novo e copie outra vez.')
    return
  }
  console.log('✔ reconheceu. Agora vou tirando um por um.\n')

  const necessarios = []
  for (let i = 0; i < pares.length; i++) {
    const candidato = pares[i]
    const semEle = pares.filter((_, idx) => idx !== i && !necessarios.includes(pares[idx]))
      .concat(necessarios)
    const aindaFunciona = await sessaoReconhecida(semEle)
    if (!aindaFunciona) {
      necessarios.push(candidato)
      console.log(`   PRECISA   ${candidato[0]}`)
    } else {
      pares = pares.filter((_, idx) => idx !== i)
      i--
    }
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`\n${line()}`)
  if (!necessarios.length) {
    console.log('   Nenhum cookie individual se mostrou obrigatório — a SHEIN aceita')
    console.log('   combinações. Me mande a lista abaixo assim mesmo.')
  }
  console.log('   COOKIES NECESSÁRIOS (só os nomes — nenhum valor foi impresso):\n')
  for (const [nome] of (necessarios.length ? necessarios : pares)) console.log(`      ${nome}`)
  console.log(`\n   Descartáveis: ${cookieBruto ? parseCookiePairs(cookieBruto).length - (necessarios.length || pares.length) : 0} cookies`)
  console.log(`${line()}`)
  console.log('\n   Me mande essa lista de nomes. Vou guardar só esses e descartar o resto.\n')
}

async function main() {
  const cookie = process.env.SHEIN_COOKIE
  const modoDescoberta = process.argv.includes('--descobrir')
  const productUrl = process.argv.find(a => a.startsWith('http'))

  console.log(line('═'))
  console.log('TESTE DO GERADOR DE LINK DA SHEIN')
  console.log(line('═'))

  if (!cookie) {
    console.error('\nFalta o código de acesso. Ele entra por variável de ambiente,')
    console.error('nunca por argumento — argumento fica no histórico do shell.\n')
    console.error("  export SHEIN_COOKIE='<cookie da shein.com logada>'")
    console.error("  node scripts/diag-shein-shortlink.mjs 'https://br.shein.com/...-p-<id>.html'\n")
    process.exitCode = 1
    return
  }
  if (modoDescoberta) { await descobrirMinimo(cookie); return }

  if (!productUrl) {
    console.error('\nFalta o link do produto que você quer encurtar.\n')
    process.exitCode = 1
    return
  }

  console.log(`\nCódigo de acesso recebido: ${describeSecret(cookie)} (não será exibido)`)
  console.log(`Produto: ${productUrl}`)

  // ── Passo 1: trocar o cookie por um token de sessão ────────────────────
  console.log('\n1) CONFERINDO A SUA SESSÃO\n')
  let info
  try {
    const res = await fetch(SITE_INFO_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'bff-source': 'shein;pwa',
        Cookie: cookie,
      },
    })
    info = await res.json()
    console.log(`   HTTP ${res.status}`)
  } catch (err) {
    console.log(`   ✘ não deu para falar com a SHEIN: ${err?.message || err}`)
    process.exitCode = 1
    return
  }

  const token = info?.token || ''
  const memberId = String(info?.memberId || '')
  console.log(`   token recebido: ${token ? 'sim' : 'NÃO'}`)
  console.log(`   ID de afiliado (memberId): ${memberId || '(vazio)'}`)

  if (!memberId) {
    console.log('\n   ✘ A SHEIN respondeu como VISITANTE, não como você.')
    console.log('     O código de acesso venceu ou foi copiado incompleto.')
    console.log('     Faça login de novo na SHEIN e copie o cookie outra vez.')
    process.exitCode = 1
    return
  }

  // ── Passo 2: pedir o link curto ────────────────────────────────────────
  console.log('\n2) PEDINDO O LINK CURTO\n')
  let resposta
  try {
    const res = await postJson(SHORTEN_URL, {
      token,
      memberId,
      siteUid: info?.SiteUID,
      language: info?.appLanguage,
      body: { url: String(productUrl).trim(), language: info?.appLanguage || 'pt-br', uid: memberId },
    })
    resposta = await res.json()
    console.log(`   HTTP ${res.status}  code=${resposta?.code}  msg=${resposta?.msg || '-'}`)
  } catch (err) {
    console.log(`   ✘ falhou: ${err?.message || err}`)
    process.exitCode = 1
    return
  }

  const oneLink = resposta?.info?.oneLink || ''

  console.log('\n3) RESULTADO\n')
  console.log(`   ${line()}`)
  if (resposta?.code === '0' && oneLink) {
    console.log('   ✔ FUNCIONOU. A SHEIN gerou o link curto:')
    console.log(`\n      ${oneLink}\n`)
    console.log('   Isso confirma que o robô pode encurtar sozinho, com o seu')
    console.log('   código de acesso guardado no painel. Me avise que eu implemento.')
  } else if (resposta?.code === '100103') {
    console.log('   ✘ A SHEIN não reconheceu a sessão nesta chamada.')
    console.log('     O login existe (o passo 1 achou o seu ID), mas o gerador')
    console.log('     exige algo a mais que só o navegador dela produz.')
    console.log('     Nesse caso o caminho oficial morre — vamos de encurtador próprio.')
  } else {
    console.log('   ✘ Resposta inesperada — cole o bloco abaixo na conversa:')
    console.log(`\n${JSON.stringify(resposta, null, 2).slice(0, 900)}\n`)
  }
  console.log(`   ${line()}`)
  console.log('\n   O código de acesso não foi impresso em nenhum momento acima.\n')
}

main().catch((err) => {
  console.error('Falhou:', err?.message || err)
  process.exitCode = 1
})
