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
  isRetryableCustomDomainFailure,
  CUSTOM_DOMAIN_FETCH_TIMEOUT_MS,
  CUSTOM_DOMAIN_TOTAL_BUDGET_MS,
  CUSTOM_DOMAIN_MIXED_BUDGET_MS,
  CUSTOM_DOMAIN_MAX_ATTEMPTS,
  MAX_CANDIDATES_PER_MESSAGE,
  hasStoreLink,
  countDistinctProducts,
  isListingPageAfterRedirect,
  allCandidatesFailedBecauseOfferEnded,
  OFFER_ENDED_REASON,
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

test('NÃO gasta rede quando todas as URLs já são de loja', () => {
  const texto = 'Oferta https://www.amazon.com.br/dp/B088PNBKTR/ e https://amzn.to/4gAbCdE'
  assert.deepEqual(findCandidateLinks(texto), [])
})

// RCA 2026-09-17: uma oferta com 3-4 produtos chegava ao grupo com só dois
// links; do terceiro em diante ficava o texto e nenhuma URL. Causa: um único
// link de loja no texto desligava o desembrulho da mensagem INTEIRA, e o
// sanitizador apagava em seguida os links de domínio próprio dos demais
// produtos. Não regredir: a decisão é por LINK.
test('oferta MISTA: desembrulha os links de domínio próprio mesmo havendo link de loja', () => {
  const texto = [
    '1) Air Fryer https://amzn.to/4gAbCdE',
    '2) Liquidificador https://s.shopee.com.br/BBB222',
    `3) Cafeteira ${LINK_PROPRIO}`,
  ].join('\n')
  assert.deepEqual(findCandidateLinks(texto), [LINK_PROPRIO])
})

test('link de loja nunca entra como candidato a desembrulho', () => {
  const texto = `https://amzn.to/4gAbCdE ${LINK_PROPRIO}`
  assert.equal(findCandidateLinks(texto).includes('https://amzn.to/4gAbCdE'), false)
})

test('hasStoreLink distingue mensagem mista de mensagem só com domínio próprio', () => {
  assert.equal(hasStoreLink(`https://amzn.to/4gAbCdE ${LINK_PROPRIO}`), true)
  assert.equal(hasStoreLink(LINK_PROPRIO), false)
  assert.equal(hasStoreLink('sem link nenhum'), false)
})

// O desembrulho de mensagem mista é um GANHO, nunca a diferença entre espelhar
// e não espelhar — a oferta sai pelos links de loja que já existem. Por isso
// ele não pode gastar o orçamento cheio dentro dos 25s de preparo da mensagem.
test('mensagem mista usa orçamento MENOR que o da mensagem sem link de loja', () => {
  assert.ok(CUSTOM_DOMAIN_MIXED_BUDGET_MS < CUSTOM_DOMAIN_TOTAL_BUDGET_MS)
})

// RCA 2026-09-18: o orçamento misto nasceu em 6s, MENOR que o teto de uma
// tentativa (8s). Um site lento consumia tudo e o segundo link embrulhado nem
// era tentado — a oferta chegava ao grupo com "Compre aqui:" vazio.
test('orçamento misto cabe ao menos UMA tentativa cheia', () => {
  assert.ok(CUSTOM_DOMAIN_MIXED_BUDGET_MS >= CUSTOM_DOMAIN_FETCH_TIMEOUT_MS)
})

test('link lento NÃO pode zerar a chance do link seguinte', async () => {
  const texto = [
    '👉 Compre aqui: https://www.amazon.com.br/dp/B0AAA11111',
    '👉 Compre aqui: https://dicasdeamigas.com.br/p/lento',
    '🔗 https://dicasdeamigas.com.br/p/rapido',
  ].join('\n')
  const tentados = []
  const fetchImpl = async (url, opts) => {
    tentados.push(url)
    if (!url.includes('/p/lento')) return respostaHtml(PAGINA_REAL)
    // Só termina quando o próprio teto aborta. O timer existe para segurar o
    // laço de eventos: o relógio de `AbortSignal.timeout` não o segura sozinho.
    return new Promise((_resolve, reject) => {
      const seguraOLaco = setTimeout(() => reject(new Error('nunca deveria chegar aqui')), 30_000)
      opts?.signal?.addEventListener?.('abort', () => {
        clearTimeout(seguraOLaco)
        reject(new Error('TimeoutError'))
      })
    })
  }

  const { text, resolved, failures } = await resolveCustomDomainLinks(texto, {
    fetchImpl,
    useCache: false,
    totalBudgetMs: 4000,
  })

  assert.equal(tentados.filter(u => u.includes('/p/rapido')).length, 1, 'o segundo link precisa ser tentado')
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].from, 'https://dicasdeamigas.com.br/p/rapido')
  assert.ok(text.includes('https://www.amazon.com.br/dp/B088PNBKTR/'), 'o segundo link vira link de loja')
  assert.ok(text.includes('https://www.amazon.com.br/dp/B0AAA11111'), 'o link de loja original fica intacto')
  assert.equal(failures.length, 1)
  assert.notEqual(failures[0].reason, 'sem_tempo_no_orcamento')
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
  const texto = Array.from({ length: MAX_CANDIDATES_PER_MESSAGE + 2 }, (_, i) =>
    `https://dicasdeamigas.com.br/p/${i}`).join('\n')
  assert.equal(findCandidateLinks(texto).length, MAX_CANDIDATES_PER_MESSAGE)
})

// RCA 2026-09-19: era ESTE teto a queixa "não converte mais de 2 links". O
// grupo de origem publica todos os produtos pelo site próprio, então a oferta
// de 3-4 produtos saía com os dois primeiros e o resto sem link nenhum.
test('oferta de 4 produtos pelo site próprio: NENHUM produto fica sem link', async () => {
  clearCustomDomainCache()
  const texto = [
    '👉Link do Sabonete : https://dicasdeamigas.com.br/p/aaa',
    '👉Link do Papel: https://dicasdeamigas.com.br/p/bbb',
    '👉Link do Livrinho : https://dicasdeamigas.com.br/p/ccc',
    '👉Link do Shampoo : https://dicasdeamigas.com.br/p/ddd',
  ].join('\n')
  const fetchImpl = async () => respostaHtml(PAGINA_REAL)

  const { text, resolved } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })

  assert.equal(resolved.length, 4)
  for (const trecho of ['/p/aaa', '/p/bbb', '/p/ccc', '/p/ddd']) {
    assert.ok(!text.includes(trecho), `${trecho} continuou embrulhado — o sanitizador vai apagá-lo`)
  }
  for (const rotulo of ['Sabonete', 'Papel', 'Livrinho', 'Shampoo']) {
    assert.ok(text.includes(rotulo), `perdeu a linha do ${rotulo}`)
  }
})

test('o teto não é mais o guarda de TEMPO: quem limita é o orçamento da mensagem', async () => {
  clearCustomDomainCache()
  const texto = Array.from({ length: MAX_CANDIDATES_PER_MESSAGE }, (_, i) =>
    `Produto ${i} https://dicasdeamigas.com.br/p/${i}`).join('\n')
  const tentados = []
  const fetchImpl = async (url, opts) => {
    tentados.push(url)
    return new Promise((_resolve, reject) => {
      const seguraOLaco = setTimeout(() => reject(new Error('nunca deveria chegar aqui')), 30_000)
      opts?.signal?.addEventListener?.('abort', () => {
        clearTimeout(seguraOLaco)
        reject(new Error('TimeoutError'))
      })
    })
  }

  const comecou = Date.now()
  const { text, failures } = await resolveCustomDomainLinks(texto, {
    fetchImpl,
    useCache: false,
    totalBudgetMs: 4000,
  })

  assert.ok(Date.now() - comecou < 6000, 'o orçamento da mensagem precisa limitar o tempo total')
  assert.equal(failures.length, MAX_CANDIDATES_PER_MESSAGE)
  assert.equal(text, texto, 'fail-safe: texto devolvido exatamente como veio')
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

test('oferta MISTA: os links de loja ficam intactos e o embrulhado vira link de loja', async () => {
  clearCustomDomainCache()
  const fetchImpl = async () => respostaHtml(PAGINA_REAL)
  const texto = [
    '1) Air Fryer https://amzn.to/4gAbCdE',
    '2) Liquidificador https://s.shopee.com.br/BBB222',
    `3) Cafeteira ${LINK_PROPRIO}`,
  ].join('\n')
  const { text, resolved } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })
  assert.equal(resolved.length, 1)
  // Os três produtos continuam com link — era o 3º que sumia.
  assert.ok(text.includes('https://amzn.to/4gAbCdE'))
  assert.ok(text.includes('https://s.shopee.com.br/BBB222'))
  assert.ok(text.includes('https://www.amazon.com.br/dp/B088PNBKTR/'))
  assert.ok(!text.includes(LINK_PROPRIO))
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
    /links\.length === 0 && \(hasGenericUrl \|\| hadUnsupportedStoreUrl\)\s*\n?\s*\? ':unsupported_store'/,
    'link de loja desconhecida não pode voltar a ser lido como regra de encaminhamento',
  )
  // RCA 19/09/2026: oferta ENCERRADA no site de origem precisa de motivo
  // próprio — sair como "não apoiamos essa loja" é falso (a loja é a Amazon) e
  // manda a cliente esperar por algo que já existe.
  assert.match(
    fonte,
    /allCandidatesFailedBecauseOfferEnded\(falhasDeDominioProprio\)/,
    'o motivo real da falha precisa chegar ao painel, não só ao log',
  )
  assert.match(fonte, /':offer_ended_at_source'/)
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

test('timeout transitório ganha uma segunda tentativa e o sucesso é observado', async () => {
  clearCustomDomainCache()
  let chamadas = 0
  const fetchImpl = async () => {
    chamadas += 1
    if (chamadas === 1) {
      const erro = new Error('DNS demorou demais')
      erro.name = 'TimeoutError'
      throw erro
    }
    return respostaHtml(PAGINA_REAL)
  }

  const { resolved, failures } = await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, {
    fetchImpl,
    useCache: false,
    totalBudgetMs: 13_000,
  })

  assert.equal(chamadas, 2)
  assert.deepEqual(failures, [])
  assert.equal(resolved[0].to, 'https://www.amazon.com.br/dp/B088PNBKTR/')
  assert.equal(resolved[0].recoveredByRetry, true)
  assert.deepEqual(resolved[0].attempts.map(a => a.reason), ['tempo_esgotado', null])
})

test('erro de rede transitório também ganha retry', async () => {
  clearCustomDomainCache()
  let chamadas = 0
  const fetchImpl = async () => {
    chamadas += 1
    if (chamadas === 1) {
      const erro = new Error('socket hang up')
      erro.name = 'TypeError'
      throw erro
    }
    return respostaHtml(PAGINA_REAL)
  }
  const { resolved } = await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, {
    fetchImpl,
    useCache: false,
  })
  assert.equal(chamadas, 2)
  assert.equal(resolved[0].recoveredByRetry, true)
})

test('respostas determinísticas NÃO são repetidas', async () => {
  for (const [nome, resposta, motivo] of [
    ['HTTP 403', respostaHtml('', { status: 403 }), 'recusado_http_403'],
    ['HTML sem loja', respostaHtml('<html><body>nada</body></html>'), 'pagina_sem_link_de_loja'],
  ]) {
    clearCustomDomainCache()
    let chamadas = 0
    const { failures } = await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, {
      fetchImpl: async () => { chamadas += 1; return resposta },
      useCache: false,
    })
    assert.equal(chamadas, 1, `${nome} não pode gastar uma segunda chamada`)
    assert.equal(failures[0].reason, motivo)
    assert.equal(failures[0].attempts.length, 1)
  }
})

test('duas falhas transitórias preservam o motivo e encerram no teto de tentativas', async () => {
  clearCustomDomainCache()
  let chamadas = 0
  const { failures } = await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, {
    fetchImpl: async () => {
      chamadas += 1
      const erro = new Error(`timeout ${chamadas}`)
      erro.name = 'TimeoutError'
      throw erro
    },
    useCache: false,
  })
  assert.equal(chamadas, 2)
  assert.equal(failures[0].reason, 'tempo_esgotado')
  assert.equal(failures[0].attempts.length, 2)
})

test('não inicia retry sem orçamento útil e mantém o teto global da mensagem', async () => {
  clearCustomDomainCache()
  let chamadas = 0
  const { failures } = await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, {
    fetchImpl: async () => {
      chamadas += 1
      await new Promise(resolve => setTimeout(resolve, 250))
      const erro = new Error('DNS demorou')
      erro.name = 'TimeoutError'
      throw erro
    },
    useCache: false,
    totalBudgetMs: 1700,
  })
  assert.equal(chamadas, 1, 'retry sem 1,5s livres ameaçaria o teto da mensagem')
  assert.equal(failures[0].reason, 'tempo_esgotado')
  assert.equal(failures[0].attempts.length, 1)
})

test('sucesso recuperado pelo retry entra no cache normalmente', async () => {
  clearCustomDomainCache()
  let chamadas = 0
  const fetchImpl = async () => {
    chamadas += 1
    if (chamadas === 1) {
      const erro = new Error('falha transitória')
      erro.name = 'TimeoutError'
      throw erro
    }
    return respostaHtml(PAGINA_REAL)
  }
  await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, { fetchImpl })
  await resolveCustomDomainLinks(`veja ${LINK_PROPRIO}`, { fetchImpl })
  assert.equal(chamadas, 2, 'a segunda mensagem deve reutilizar o sucesso recuperado')
  clearCustomDomainCache()
})

test('classificação de retry não repete erros determinísticos ou de segurança', () => {
  assert.equal(isRetryableCustomDomainFailure('tempo_esgotado'), true)
  assert.equal(isRetryableCustomDomainFailure('erro_de_rede:TypeError'), true)
  assert.equal(isRetryableCustomDomainFailure('recusado_http_403'), false)
  assert.equal(isRetryableCustomDomainFailure('pagina_sem_link_de_loja'), false)
  assert.equal(isRetryableCustomDomainFailure('endereco_recusado'), false)
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
  assert.equal(CUSTOM_DOMAIN_TOTAL_BUDGET_MS, 13000, '13s preservam 8s + uma recuperação curta')
  assert.equal(CUSTOM_DOMAIN_MAX_ATTEMPTS, 2, 'uma única repetição limita carga e latência')

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

// ── Sites de oferta que recusam a leitura do nosso servidor ──────────────
//
// Medido em produção (2026-09-16): `pechin.co` respondeu por 98 das 105
// recusas 403 do desembrulho. Ele redireciona 301 para `pechinchou.com.br`,
// que está atrás de Cloudflare e devolve 403 para o nosso IP em todos os
// cabeçalhos testados. Não perde oferta (essas mensagens já não eram
// espelhadas); para de gastar rede e reputação de IP num "não" garantido.
test('não tenta ler site que comprovadamente recusa o nosso servidor', () => {
  assert.equal(isSafeCandidateUrl('https://pechin.co/147544'), false)
  assert.equal(isSafeCandidateUrl('https://pechinchou.com.br/oferta/147544'), false)
  assert.equal(isSafeCandidateUrl('https://www.pechinchou.com.br/oferta/1'), false)
})

test('a lista de bloqueio é ancorada — não pega domínio parecido', () => {
  assert.equal(isSafeCandidateUrl('https://pechinchou.net/oferta/1'), true)
  assert.equal(isSafeCandidateUrl('https://pechin.com.br/1'), true)
  assert.equal(isSafeCandidateUrl('https://naopechin.co.uk/1'), true)
})

test('site bloqueado nem vira candidato no texto', () => {
  assert.deepEqual(findCandidateLinks('Olha essa https://pechin.co/147544'), [])
})

// ── RCA 2026-09-18 (segunda rodada): "não fazemos conversão para essa loja"
// numa oferta que convertia. ────────────────────────────────────────────────

test('marcador de formatação do WhatsApp não vira endereço inexistente', () => {
  assert.deepEqual(
    findCandidateLinks('👉 Compre aqui: *https://dicasdeamigas.com.br/p/D4m1TvZilb*'),
    ['https://dicasdeamigas.com.br/p/D4m1TvZilb'],
  )
  assert.deepEqual(
    findCandidateLinks('👉 _https://dicasdeamigas.com.br/p/abc_'),
    ['https://dicasdeamigas.com.br/p/abc'],
  )
  // O marcador que pertence à própria URL continua intacto (regra do detector).
  assert.deepEqual(
    findCandidateLinks('veja https://dicasdeamigas.com.br/p/abc_'),
    ['https://dicasdeamigas.com.br/p/abc_'],
  )
})

test('oferta ENCERRADA: redirect para página de lista não publica produto aleatório', async () => {
  clearCustomDomainCache()
  // Medido em produção (18/09/2026): /p/<slug> de oferta encerrada responde 307
  // para /promocao-encerrada, uma página com 13 produtos DIFERENTES.
  const listaDeOutrasOfertas = [
    '<a href="https://www.amazon.com.br/dp/B084353B4V/">a</a>',
    '<a href="https://www.amazon.com.br/dp/B00H2ZTJY4/">b</a>',
    '<a href="https://www.amazon.com.br/dp/B07RM7X6M4/">c</a>',
  ].join('')
  const fetchImpl = async (url) => {
    if (url.endsWith('/p/encerrada')) {
      return {
        ok: false,
        status: 307,
        headers: new Headers({ location: '/promocao-encerrada' }),
        text: async () => '',
      }
    }
    return respostaHtml(listaDeOutrasOfertas)
  }

  const { store, reason, detail } = await resolveStoreUrlFromCustomDomainDetailed(
    'https://dicasdeamigas.com.br/p/encerrada',
    { fetchImpl, useCache: false },
  )
  assert.equal(store, null, 'oferta enviada com o link errado é irreversível — na dúvida, não publica')
  assert.equal(reason, 'pagina_de_lista_apos_redirect')
  assert.match(String(detail), /3 produtos diferentes/)
})

test('página de oferta de verdade tem UM produto em dois endereços — continua resolvendo', async () => {
  clearCustomDomainCache()
  const paginaDaOferta = [
    '<a href="https://link.amazon/B03y5j4wc">curto</a>',
    '<a href="https://www.amazon.com.br/dp/B0CBDH19YL/">limpo</a>',
  ].join('')
  const fetchImpl = async (url) => {
    if (url.endsWith('/p/viva')) {
      return { ok: false, status: 307, headers: new Headers({ location: '/p/viva-2' }), text: async () => '' }
    }
    return respostaHtml(paginaDaOferta)
  }
  const { store, reason } = await resolveStoreUrlFromCustomDomainDetailed(
    'https://dicasdeamigas.com.br/p/viva',
    { fetchImpl, useCache: false },
  )
  assert.equal(reason, null)
  assert.equal(store.url, 'https://www.amazon.com.br/dp/B0CBDH19YL/')
})

test('SEM redirect, página com vários produtos segue escolhendo (não regride os sites que hoje funcionam)', () => {
  const varios = [
    { platform: 'amazon', url: 'https://www.amazon.com.br/dp/B084353B4V/' },
    { platform: 'amazon', url: 'https://www.amazon.com.br/dp/B00H2ZTJY4/' },
  ]
  assert.equal(countDistinctProducts(varios), 2)
  assert.equal(isListingPageAfterRedirect(varios, { redirected: false }), false)
  assert.equal(isListingPageAfterRedirect(varios, { redirected: true }), true)
})

test('duas URLs do MESMO produto não contam como lista', () => {
  assert.equal(countDistinctProducts([
    { platform: 'amazon', url: 'https://www.amazon.com.br/dp/B0CBDH19YL/' },
    { platform: 'amazon', url: 'https://www.amazon.com.br/PRODUTO-X/dp/B0CBDH19YL' },
  ]), 1)
})

test('com DOIS candidatos o retry continua existindo (a fatia por link não pode matá-lo)', async () => {
  clearCustomDomainCache()
  // Falha transitória (DNS IPv6 da Hetzner, medido em 14/09) no PRIMEIRO
  // candidato. Com a fatia por link virando prazo da tentativa, a segunda
  // tentativa nascia zerada e os DOIS links caíam — a oferta ficava sem link
  // de loja nenhum e o painel dizia "não fazemos conversão para essa loja".
  const chamadasPorUrl = new Map()
  const fetchImpl = async (url, opts) => {
    const n = (chamadasPorUrl.get(url) || 0) + 1
    chamadasPorUrl.set(url, n)
    if (url.endsWith('/p/um') && n === 1) {
      // Estoura de verdade: a tentativa CONSOME a fatia inteira do link, como um
      // DNS travado. É isso que matava o retry — falha instantânea não reproduz.
      return new Promise((_resolve, reject) => {
        const seguraOLaco = setTimeout(() => reject(new Error('nunca deveria chegar aqui')), 30_000)
        opts?.signal?.addEventListener?.('abort', () => {
          clearTimeout(seguraOLaco)
          const erro = new Error('DNS piscou')
          erro.name = 'TimeoutError'
          reject(erro)
        })
      })
    }
    return respostaHtml(PAGINA_REAL)
  }

  const texto = 'a https://dicasdeamigas.com.br/p/um\nb https://dicasdeamigas.com.br/p/dois'
  const { resolved, failures } = await resolveCustomDomainLinks(texto, { fetchImpl, useCache: false })

  assert.equal(failures.length, 0, 'falha transitória num link não pode derrubar a oferta inteira')
  assert.equal(resolved.length, 2)
  assert.equal(chamadasPorUrl.get('https://dicasdeamigas.com.br/p/um'), 2, 'o primeiro link precisa de segunda chance')
  assert.ok(resolved.find(r => r.from.endsWith('/p/um')).recoveredByRetry)
})

// ── RCA 2026-09-19: oferta ENCERRADA no site de origem. ─────────────────────



test('oferta encerrada na origem NÃO pode sair como "loja sem suporte"', () => {
  const encerrada = [{ reason: OFFER_ENDED_REASON }, { reason: OFFER_ENDED_REASON }]
  assert.equal(allCandidatesFailedBecauseOfferEnded(encerrada), true)
  // Um link que falhou por outro motivo significa que a oferta não acabou.
  assert.equal(
    allCandidatesFailedBecauseOfferEnded([{ reason: OFFER_ENDED_REASON }, { reason: 'tempo_esgotado' }]),
    false,
  )
  assert.equal(allCandidatesFailedBecauseOfferEnded([]), false)
  assert.equal(allCandidatesFailedBecauseOfferEnded(null), false)
})
