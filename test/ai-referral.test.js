import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { REFERRER_KIND, classifyReferrer, shouldTrackReferral } from '../dashboard/lib/ai-referral.js'

const SELF = 'espelhagrupos.com.br'

test('reconhece os motores de resposta por IA', () => {
  const cases = [
    ['https://chatgpt.com/c/abc123', 'chatgpt'],
    ['https://chat.openai.com/', 'chatgpt'],
    ['https://www.perplexity.ai/search/algo', 'perplexity'],
    ['https://claude.ai/chat/xyz', 'claude'],
    ['https://gemini.google.com/app', 'gemini'],
    ['https://copilot.microsoft.com/', 'copilot'],
  ]
  for (const [referrer, source] of cases) {
    const got = classifyReferrer(referrer, SELF)
    assert.equal(got.kind, REFERRER_KIND.AI, referrer)
    assert.equal(got.source, source, referrer)
  }
})

test('separa busca tradicional de IA — são funis diferentes', () => {
  const google = classifyReferrer('https://www.google.com/search?q=shopee+afiliados', SELF)
  assert.equal(google.kind, REFERRER_KIND.SEARCH)
  assert.equal(google.source, 'google')

  // gemini.google.com é IA, não busca: a ordem de checagem tem que garantir isso
  const gemini = classifyReferrer('https://gemini.google.com/app', SELF)
  assert.equal(gemini.kind, REFERRER_KIND.AI)
})

test('reconhece o canal do YouTube como social', () => {
  const got = classifyReferrer('https://www.youtube.com/@botinhoafiliado', SELF)
  assert.equal(got.kind, REFERRER_KIND.SOCIAL)
  assert.equal(got.source, 'youtube')
})

test('NUNCA devolve a URL completa do referenciador, só o host', () => {
  // URL de buscador carrega o termo pesquisado. Isso é dado da pessoa e não
  // pode entrar no nosso banco — o guard existe para essa regressão.
  const got = classifyReferrer('https://www.google.com/search?q=termo+privado+da+pessoa', SELF)
  assert.equal(got.host, 'google.com')
  assert.ok(!JSON.stringify(got).includes('termo+privado'))
  assert.ok(!JSON.stringify(got).includes('?'))
  assert.ok(!JSON.stringify(got).includes('/search'))
})

test('navegação interna e acesso direto não são registrados', () => {
  const interno = classifyReferrer(`https://${SELF}/blog/algo`, SELF)
  assert.equal(interno.kind, REFERRER_KIND.INTERNAL)
  assert.equal(shouldTrackReferral(interno), false)

  const direto = classifyReferrer('', SELF)
  assert.equal(direto.kind, REFERRER_KIND.DIRECT)
  assert.equal(shouldTrackReferral(direto), false)

  // www. do próprio domínio também é interno
  const comWww = classifyReferrer(`https://www.${SELF}/`, SELF)
  assert.equal(comWww.kind, REFERRER_KIND.INTERNAL)
})

test('visita de fora é registrada, inclusive de origem desconhecida', () => {
  const ai = classifyReferrer('https://chatgpt.com/', SELF)
  assert.equal(shouldTrackReferral(ai), true)

  const desconhecido = classifyReferrer('https://blogaleatorio.com.br/post', SELF)
  assert.equal(desconhecido.kind, REFERRER_KIND.OTHER)
  assert.equal(desconhecido.source, 'other')
  assert.equal(shouldTrackReferral(desconhecido), true)
})

test('referenciador malformado não quebra nem vira registro', () => {
  for (const bad of [null, undefined, 'não-é-url', 'javascript:alert(1)', 'about:blank', 42, {}]) {
    const got = classifyReferrer(bad, SELF)
    assert.equal(got.kind, REFERRER_KIND.DIRECT, String(bad))
    assert.equal(shouldTrackReferral(got), false, String(bad))
  }
})

// Os dois testes abaixo leem o SOURCE em vez de importar `src/analytics.js`:
// esse módulo puxa `db.js` -> @prisma/client, e a suíte aqui é db-free.
const analyticsSource = fs.readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')

test('os campos do evento passam pelo filtro de metadados sensíveis', () => {
  // sanitizeAnalyticsMetadata descarta qualquer chave que case com o padrão
  // abaixo. Se alguém renomear os campos para algo como `referrer_url`, o dado
  // some EM SILÊNCIO e a métrica fica zerada sem ninguém perceber.
  const match = analyticsSource.match(/const SENSITIVE_KEY_PATTERN = (\/.+\/i)/)
  assert.ok(match, 'SENSITIVE_KEY_PATTERN não encontrado em src/analytics.js')
  const [body, flags] = [match[1].slice(1, -2), 'i']
  const pattern = new RegExp(body, flags)

  for (const key of ['referrer_kind', 'referrer_source', 'referrer_host']) {
    assert.equal(pattern.test(key), false, `${key} seria descartado pelo sanitizador`)
  }
})

test('referral_visit está nas DUAS allowlists do servidor', () => {
  // A rota pública valida contra PUBLIC_ANALYTICS_EVENTS; a gravação valida
  // contra ANALYTICS_EVENTS. Faltar em qualquer uma faz o evento sumir sem erro.
  // Atenção: 'PUBLIC_ANALYTICS_EVENTS' CONTÉM 'ANALYTICS_EVENTS' como
  // substring, então o marcador do segundo bloco precisa ser ancorado.
  const durableStart = analyticsSource.indexOf('export const ANALYTICS_EVENTS = new Set')
  const publicStart = analyticsSource.indexOf('export const PUBLIC_ANALYTICS_EVENTS = new Set')
  assert.ok(publicStart >= 0 && durableStart > publicStart, 'estrutura de src/analytics.js mudou')

  const publicList = analyticsSource.slice(publicStart, durableStart)
  const durableList = analyticsSource.slice(durableStart)

  assert.ok(publicList.includes("'referral_visit'"), 'falta em PUBLIC_ANALYTICS_EVENTS')
  assert.ok(durableList.includes("'referral_visit'"), 'falta em ANALYTICS_EVENTS')
})
