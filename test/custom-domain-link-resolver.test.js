import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  findCandidateLinks,
  isSafeCandidateUrl,
  extractStoreUrlsFromHtml,
  pickBestStoreUrl,
  resolveStoreUrlFromCustomDomain,
  resolveStoreUrlFromCustomDomainDetailed,
  resolveCustomDomainLinks,
  clearCustomDomainCache,
  CUSTOM_DOMAIN_FETCH_TIMEOUT_MS,
  CUSTOM_DOMAIN_TOTAL_BUDGET_MS,
} from '../src/core/customDomainLinkResolver.js'

const here = dirname(fileURLToPath(import.meta.url))
const PAGINA_REAL = readFileSync(join(here, 'fixtures', 'custom-domain-offer-page.html'), 'utf8')

const LINK_PROPRIO = 'https://dicasdeamigas.com.br/p/yaQ4mlRhfU'

function respostaHtml(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8', ...headers }),
    text: async () => body,
  }
}

test('acha o link de domínio próprio quando a mensagem não tem link de loja', () => {
  const texto = `Skala Cremoso 1Kg\nR$ 11,99\n${LINK_PROPRIO}\nCorre!`
  assert.deepEqual(findCandidateLinks(texto), [LINK_PROPRIO])
})

test('NÃO gasta rede quando a mensagem já tem link de loja', () => {
  const texto = `Oferta https://www.amazon.com.br/dp/B088PNBKTR/ e tambem ${LINK_PROPRIO}`
  assert.deepEqual(findCandidateLinks(texto), [])
})

test('ignora convite de grupo, rede social e arquivo', () => {
  const texto = [
    'https://chat.whatsapp.com/ABC123',
    'https://www.instagram.com/loja',
    'https://site.com.br/foto.jpg',
  ].join('\n')
  assert.deepEqual(findCandidateLinks(texto), [])
})

test('teto de candidatos por mensagem é respeitado', () => {
  const texto = [
    'https://dicasdeamigas.com.br/p/1',
    'https://ofertasdaju.com.br/p/2',
    'https://achadinhosdapri.com.br/p/3',
  ].join('\n')
  assert.equal(findCandidateLinks(texto).length, 2)
})

test('anti-SSRF: recusa rede interna, IP literal, credencial embutida e porta estranha', () => {
  const proibidos = [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1/admin',
    'http://10.0.0.5/',
    'http://localhost/x',
    'http://[::1]/x',
    'http://painel.internal/x',
    'http://user:senha@site.com.br/p/1',
    'http://site.com.br:8080/p/1',
    'ftp://site.com.br/p/1',
  ]
  for (const url of proibidos) {
    assert.equal(isSafeCandidateUrl(url), false, `deveria recusar: ${url}`)
  }
  assert.equal(isSafeCandidateUrl(LINK_PROPRIO), true)
})

test('extrai os links de loja do HTML REAL sem um engolir o outro', () => {
  // Guarda do defeito medido em 2026-09-13: usando o regex do detector direto
  // (`[^\s]*`, feito para texto corrido), o link do concorrente engolia o JSON
  // minificado inteiro e a URL limpa do produto NUNCA aparecia.
  const achados = extractStoreUrlsFromHtml(PAGINA_REAL)
  const urls = achados.map(a => a.url)
  assert.ok(urls.includes('https://link.amazon/B0aw9F5Mp'), urls.join(', '))
  assert.ok(urls.includes('https://www.amazon.com.br/dp/B088PNBKTR/'), urls.join(', '))
})

test('prefere a URL com ID de produto (a limpa), não o short link do concorrente', () => {
  const melhor = pickBestStoreUrl(extractStoreUrlsFromHtml(PAGINA_REAL))
  assert.equal(melhor.url, 'https://www.amazon.com.br/dp/B088PNBKTR/')
  assert.equal(melhor.platform, 'amazon')
})

test('desescapa o JSON do Next.js (\\/ e &amp;)', () => {
  const html = '{"link":"https:\\/\\/www.amazon.com.br\\/dp\\/B088PNBKTR\\/?th=1&amp;psc=1"}'
  const achados = extractStoreUrlsFromHtml(html)
  assert.equal(achados.length, 1)
  assert.match(achados[0].url, /^https:\/\/www\.amazon\.com\.br\/dp\/B088PNBKTR\//)
})

test('troca no texto o link próprio pela URL da loja', async () => {
  clearCustomDomainCache()
  const fetchImpl = async () => respostaHtml(PAGINA_REAL)
  const texto = `Skala Cremoso 1Kg\nR$ 11,99\n${LINK_PROPRIO}\nCorre!`
  const { text, resolved } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].platform, 'amazon')
  assert.ok(text.includes('https://www.amazon.com.br/dp/B088PNBKTR/'))
  assert.ok(!text.includes(LINK_PROPRIO))
  // O resto do texto não pode ser tocado — quem espelha é o pipeline de sempre.
  assert.ok(text.startsWith('Skala Cremoso 1Kg\nR$ 11,99\n'))
  assert.ok(text.endsWith('\nCorre!'))
})

test('segue redirect HTTP quando o domínio próprio só redireciona', async () => {
  clearCustomDomainCache()
  const chamadas = []
  const fetchImpl = async (url) => {
    chamadas.push(url)
    if (url === LINK_PROPRIO) {
      return {
        ok: false,
        status: 302,
        headers: new Headers({ location: 'https://www.amazon.com.br/dp/B088PNBKTR/' }),
        text: async () => '',
      }
    }
    return respostaHtml('<html><body>produto</body></html>')
  }
  const achado = await resolveStoreUrlFromCustomDomain(LINK_PROPRIO, { fetchImpl, useCache: false })
  assert.equal(achado.url, 'https://www.amazon.com.br/dp/B088PNBKTR/')
  // Parou no hop que já é a loja: não precisou baixar a página da Amazon.
  assert.deepEqual(chamadas, [LINK_PROPRIO])
})

test('fail-safe: erro de rede devolve o texto EXATAMENTE como veio', async () => {
  clearCustomDomainCache()
  const fetchImpl = async () => { throw new Error('timeout') }
  const texto = `oferta ${LINK_PROPRIO} hoje`
  const { text, resolved } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })
  assert.equal(text, texto)
  assert.deepEqual(resolved, [])
})

test('página sem link de loja não muda nada', async () => {
  clearCustomDomainCache()
  const fetchImpl = async () => respostaHtml('<html><body>sem oferta aqui</body></html>')
  const texto = `veja ${LINK_PROPRIO}`
  const { text, resolved } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })
  assert.equal(text, texto)
  assert.deepEqual(resolved, [])
})

test('fracasso NÃO é cacheado; sucesso é', async () => {
  clearCustomDomainCache()
  let chamadas = 0
  const falha = async () => { chamadas += 1; throw new Error('rede') }
  await resolveStoreUrlFromCustomDomain(LINK_PROPRIO, { fetchImpl: falha })
  await resolveStoreUrlFromCustomDomain(LINK_PROPRIO, { fetchImpl: falha })
  assert.equal(chamadas, 2, 'timeout de rede não pode virar "esse link não tem produto"')

  chamadas = 0
  const sucesso = async () => { chamadas += 1; return respostaHtml(PAGINA_REAL) }
  await resolveStoreUrlFromCustomDomain(LINK_PROPRIO, { fetchImpl: sucesso })
  await resolveStoreUrlFromCustomDomain(LINK_PROPRIO, { fetchImpl: sucesso })
  assert.equal(chamadas, 1, 'short link de domínio próprio é imutável — resolver uma vez basta')
  clearCustomDomainCache()
})

test('kill-switch: CUSTOM_DOMAIN_LINK_RESOLVE=false desliga sem tocar no texto', async () => {
  const antes = process.env.CUSTOM_DOMAIN_LINK_RESOLVE
  process.env.CUSTOM_DOMAIN_LINK_RESOLVE = 'false'
  try {
    let chamou = false
    const fetchImpl = async () => { chamou = true; return respostaHtml(PAGINA_REAL) }
    const texto = `oferta ${LINK_PROPRIO}`
    const { text, resolved } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })
    assert.equal(text, texto)
    assert.deepEqual(resolved, [])
    assert.equal(chamou, false, 'desligado não pode gastar rede')
  } finally {
    if (antes === undefined) delete process.env.CUSTOM_DOMAIN_LINK_RESOLVE
    else process.env.CUSTOM_DOMAIN_LINK_RESOLVE = antes
  }
})

test('guarda estrutural: o desembrulho roda ANTES do sanitizador no bot-worker', () => {
  const fonte = readFileSync(join(here, '..', 'src', 'bot-worker.js'), 'utf8')
  const posResolve = fonte.indexOf('unwrapCustomDomainOfferLinks(text,')
  const posSanitize = fonte.indexOf('sanitizeInviteLinks(textoParaEspelhar)')
  assert.ok(posResolve > 0, 'o desembrulho precisa estar ligado no pipeline')
  assert.ok(posSanitize > 0, 'o sanitizador precisa consumir o texto desembrulhado')
  // Invertido, o sanitizador apaga a URL de domínio próprio antes de alguém
  // conseguir desembrulhá-la — que é exatamente o estado anterior ao fix.
  assert.ok(posResolve < posSanitize, 'desembrulhar DEPOIS do sanitizador não funciona: a URL já foi apagada')
})

test('guarda: o motivo "loja não suportada" é decidido ANTES do sanitizador', () => {
  // RCA 13/09/2026: `hasGenericUrl` lia o texto já sanitizado, e o sanitizador
  // remove toda URL que não é de loja suportada. A mensagem que DEVERIA ganhar
  // o sufixo chegava sem URL nenhuma e a cliente lia "fora das regras de
  // encaminhamento que você configurou" — culpando a configuração dela por um
  // problema de cobertura de loja, e mandando mexer no lugar errado.
  const fonte = readFileSync(join(here, '..', 'src', 'bot-worker.js'), 'utf8')
  assert.match(
    fonte,
    /const hadUnsupportedStoreUrl = findCandidateLinks\(textoParaEspelhar\)\.length > 0/,
    'o motivo precisa olhar o texto de antes do sanitizador',
  )
  assert.match(
    fonte,
    /links\.length === 0 && \(hasGenericUrl \|\| hadUnsupportedStoreUrl\) \? ':unsupported_store'/,
    'link de loja desconhecida não pode voltar a ser lido como regra de encaminhamento',
  )
})

test('findCandidateLinks reconhece loja não suportada, mas não convite de grupo', () => {
  // É a mesma regra usada pelo desembrulho, de propósito: as duas pontas não
  // podem discordar sobre o que é "link de loja desconhecida".
  assert.equal(findCandidateLinks('confira https://www.netshoes.com.br/p/tenis-123').length, 1)
  assert.equal(findCandidateLinks('entra no grupo https://chat.whatsapp.com/ABC').length, 0)
})

test('o motivo da falha é devolvido, nunca só `null`', async () => {
  // RCA staging 2026-09-13: a resolução devolveu `null` com o código no ar, a
  // rede boa e a página trazendo o link — e não havia por onde começar a
  // investigar. Falha sem motivo custa uma investigação inteira por ocorrência.
  clearCustomDomainCache()

  const semLoja = await resolveStoreUrlFromCustomDomainDetailed(LINK_PROPRIO, {
    fetchImpl: async () => respostaHtml('<html><body>nada aqui</body></html>'),
    useCache: false,
  })
  assert.equal(semLoja.store, null)
  assert.equal(semLoja.reason, 'pagina_sem_link_de_loja')

  const recusado = await resolveStoreUrlFromCustomDomainDetailed(LINK_PROPRIO, {
    fetchImpl: async () => respostaHtml('', { status: 403 }),
    useCache: false,
  })
  assert.equal(recusado.reason, 'recusado_http_403')

  const estourou = await resolveStoreUrlFromCustomDomainDetailed(LINK_PROPRIO, {
    fetchImpl: async () => { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e },
    useCache: false,
  })
  assert.equal(estourou.reason, 'tempo_esgotado')

  const rede = await resolveStoreUrlFromCustomDomainDetailed(LINK_PROPRIO, {
    fetchImpl: async () => { const e = new Error('socket hang up'); e.name = 'TypeError'; throw e },
    useCache: false,
  })
  assert.match(rede.reason, /^erro_de_rede:/)
  assert.equal(rede.detail, 'socket hang up')

  const endereco = await resolveStoreUrlFromCustomDomainDetailed('http://127.0.0.1/x', { useCache: false })
  assert.equal(endereco.reason, 'endereco_recusado')
})

test('resolveCustomDomainLinks devolve as falhas para o robô registrar', async () => {
  clearCustomDomainCache()
  const fetchImpl = async () => respostaHtml('<html><body>sem oferta</body></html>')
  const { text, resolved, failures } = await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, { fetchImpl, useCache: false })
  assert.equal(text, `veja ${LINK_PROPRIO}`)
  assert.deepEqual(resolved, [])
  assert.equal(failures.length, 1)
  assert.equal(failures[0].url, LINK_PROPRIO)
  assert.equal(failures[0].reason, 'pagina_sem_link_de_loja')
})

test('guarda: o robô registra o motivo quando o link não resolve', () => {
  const fonte = readFileSync(join(here, '..', 'src', 'bot-worker.js'), 'utf8')
  assert.match(fonte, /desembrulhado\.failures\?\.length/)
  assert.match(fonte, /Link de domínio próprio NÃO resolveu até a loja/)
})

test('o tempo por link é generoso, mas a mensagem inteira tem teto', async () => {
  // Medido em staging (2026-09-13): o MESMO endereço respondeu em 568ms e
  // estourou 4s na chamada seguinte. Por link o tempo precisa ser folgado; na
  // mensagem inteira não, senão dois links comeriam o orçamento de 25s do
  // preparo, que ainda tem conversão e foto pela frente.
  assert.ok(CUSTOM_DOMAIN_FETCH_TIMEOUT_MS >= 8000, 'tempo por link curto demais para este site')
  assert.ok(CUSTOM_DOMAIN_TOTAL_BUDGET_MS <= 12000, 'orçamento total não pode ameaçar os 25s da mensagem')

  clearCustomDomainCache()
  const usados = []
  const fetchImpl = async (_url, opts) => {
    usados.push(opts?.signal ? 'com-limite' : 'sem-limite')
    await new Promise(r => setTimeout(r, 300))
    return respostaHtml('<html><body>sem oferta</body></html>')
  }
  const texto = ['https://dicasdeamigas.com.br/p/1', 'https://ofertasdaju.com.br/p/2'].join('\n')
  const { failures } = await resolveCustomDomainLinks(texto, {
    fetchImpl,
    useCache: false,
    totalBudgetMs: 1700,  // dá para o 1º link; o 2º já não cabe
    timeoutMs: 8000,
  })
  assert.equal(usados.length, 1, 'o segundo link não pode ser buscado sem orçamento')
  assert.equal(failures.at(-1).reason, 'sem_tempo_no_orcamento')
})
