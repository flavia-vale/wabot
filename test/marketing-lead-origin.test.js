import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEAD_ORIGINS,
  classifySignupOrigin,
  parseEventMetadata,
  summarizeLeadOrigins,
} from '../src/marketing/leadOrigin.js'

test('utm_medium=organic NAO significa busca organica', () => {
  // Este é o caso que inverteria a conclusão: os botões do próprio site
  // carimbam utm_medium=organic (buildRegisterHref), então um cadastro vindo
  // de indicação chega com essa marca. Se a classificação olhasse utm, este
  // lead viraria "SEO" — e o investimento iria para o canal errado.
  const { origin } = classifySignupOrigin({
    utm_source: 'landing',
    utm_medium: 'organic',
    utm_campaign: 'home-hero',
    ref: 'abc123',
    landing_page: '/',
  })
  assert.equal(origin, LEAD_ORIGINS.REFERRAL)
})

test('codigo de parceiro tem precedencia sobre a primeira pagina', () => {
  const { origin } = classifySignupOrigin({
    aff_code: 'ABCD1234',
    landing_page: '/blog/como-ser-afiliado-shopee-whatsapp',
  })
  assert.equal(origin, LEAD_ORIGINS.PARTNER)
})

test('primeira pagina em conteudo = sinal de descoberta por busca', () => {
  const { origin, landingPath } = classifySignupOrigin({
    landing_page: '/blog/como-ser-afiliado-shopee-whatsapp?utm_source=x',
  })
  assert.equal(origin, LEAD_ORIGINS.CONTENT)
  assert.equal(landingPath, '/blog/como-ser-afiliado-shopee-whatsapp', 'query nao entra no agrupamento')
})

test('primeira pagina na home nao conta como conteudo', () => {
  for (const landing of ['/', '/login', '/cadastro']) {
    const { origin } = classifySignupOrigin({ landing_page: landing })
    assert.equal(origin, LEAD_ORIGINS.HOME, `${landing} deveria cair em home`)
  }
})

test('sem landing_page vira sem_atribuicao, nunca conteudo', () => {
  // Cadastro anterior ao rastreio não pode ser contado como SEO — inflaria o
  // canal e é justamente o erro que a analise existe para evitar.
  for (const metadata of [{}, { landing_page: '' }, { landing_page: null }, { landing_page: 'nao-e-caminho' }]) {
    assert.equal(classifySignupOrigin(metadata).origin, LEAD_ORIGINS.UNKNOWN)
  }
})

test('barra final nao cria balde duplicado', () => {
  const a = classifySignupOrigin({ landing_page: '/bot-afiliados-whatsapp/' })
  const b = classifySignupOrigin({ landing_page: '/bot-afiliados-whatsapp' })
  assert.equal(a.landingPath, b.landingPath)
})

test('parseEventMetadata tolera lixo sem lancar', () => {
  assert.deepEqual(parseEventMetadata('{"a":1}'), { a: 1 })
  assert.deepEqual(parseEventMetadata('nao é json'), {})
  assert.deepEqual(parseEventMetadata(null), {})
  assert.deepEqual(parseEventMetadata('[1,2]'), [1, 2])
})

test('summarizeLeadOrigins cruza cadastro, ativacao e pagamento', () => {
  const signups = [
    { userId: 'u1', metadata: { landing_page: '/blog/como-ser-afiliado-shopee-whatsapp' } },
    { userId: 'u2', metadata: { landing_page: '/blog/como-ser-afiliado-shopee-whatsapp' } },
    { userId: 'u3', metadata: { landing_page: '/bot-afiliados-whatsapp' } },
    { userId: 'u4', metadata: { ref: 'xyz' } },
    { userId: 'u5', metadata: {} },
  ]
  const summary = summarizeLeadOrigins(signups, new Set(['u1', 'u3', 'u4']), new Set(['u1']))

  const content = summary.find((row) => row.origin === LEAD_ORIGINS.CONTENT)
  assert.equal(content.signups, 3)
  assert.equal(content.activated, 2)
  assert.equal(content.paying, 1)
  assert.equal(content.landingPages[0].path, '/blog/como-ser-afiliado-shopee-whatsapp')
  assert.equal(content.landingPages[0].count, 2, 'pagina mais frequente vem primeiro')

  assert.equal(summary.find((row) => row.origin === LEAD_ORIGINS.REFERRAL).signups, 1)
  assert.equal(summary.find((row) => row.origin === LEAD_ORIGINS.UNKNOWN).signups, 1)
  assert.equal(summary[0].origin, LEAD_ORIGINS.CONTENT, 'ordenado por volume')
})
