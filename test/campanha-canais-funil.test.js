// P1 da campanha Canais + Preservação (2026-09-29): medição real.
//
// Três furos achados e fechados — cada um descartava dado em silêncio:
//  1. diagnostic_result_viewed / diagnostic_form_submitted / diagnostic_cta_clicked
//     eram ENVIADOS pelo navegador e a API respondia 400 (fora das allowlists
//     de src/analytics.js) — o funil não tinha a etapa do meio;
//  2. diagnostic_score_band / risk_score_band / segmento chegavam na URL do
//     /login e eram descartados (fora de ATTRIBUTION_QUERY_KEYS e do cadastro);
//  3. a UTM do post que trouxe a pessoa só sobrevivia dentro do landing_page
//     saneado e cortado em 80 caracteres — o utm_content se perdia.
// E a leitura: GET /api/admin/marketing/campanha-canais + scripts/diag-funil-antiban.mjs.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parseEntryUtm, landingPath, campaignSignupFields } from '../src/domain/signup/entryUtm.js'
import { parseEntryUtm as parseEntryUtmNavegador, readAttributionFromSearchParams, ATTRIBUTION_QUERY_KEYS } from '../dashboard/lib/marketing-attribution.js'
import { buildCampaignFunnel, boundedRange, campaignPage, CAMPAIGN_PAGES, MAX_RANGE_DAYS } from '../src/domain/admin/campaignFunnel.js'

const raiz = new URL('..', import.meta.url)
const ler = (rel) => fs.readFileSync(new URL(rel, raiz), 'utf8')
const EVENTOS_DIAGNOSTICO = ['diagnostic_result_viewed', 'diagnostic_form_submitted', 'diagnostic_cta_clicked']

test('eventos do diagnóstico/calculadora estão nas TRÊS allowlists (navegador, rota pública, banco)', async () => {
  const navegador = ler('dashboard/lib/analytics.js')
  const { PUBLIC_ANALYTICS_EVENTS, ANALYTICS_EVENTS } = await import('../src/analytics.js')
  for (const evento of EVENTOS_DIAGNOSTICO) {
    assert.match(navegador, new RegExp(`DIAGNOSTIC_[A-Z_]+: '${evento}'`), `${evento} fora de TRACKING_EVENTS`)
    assert.ok(PUBLIC_ANALYTICS_EVENTS.has(evento), `${evento} fora de PUBLIC_ANALYTICS_EVENTS — a rota responde 400`)
    assert.ok(ANALYTICS_EVENTS.has(evento), `${evento} fora de ANALYTICS_EVENTS — o banco não grava`)
  }
  assert.match(navegador, /TRACKING_EVENTS\.DIAGNOSTIC_RESULT_VIEWED,[\s\S]*TRACKING_EVENTS\.DIAGNOSTIC_FORM_SUBMITTED,[\s\S]*TRACKING_EVENTS\.DIAGNOSTIC_CTA_CLICKED,/)
})

test('rota pública aceita e grava o evento do diagnóstico com a UTM de entrada', async () => {
  const { default: Fastify } = await import('fastify')
  const { publicRoutes, clearPublicAnalyticsAttempts } = await import('../src/api/routes/public.js')
  const { default: db } = await import('../src/db.js')
  clearPublicAnalyticsAttempts()
  const app = Fastify({ logger: false })
  await app.register(publicRoutes)
  const marca = `teste-${Date.now()}`
  const res = await app.inject({
    method: 'POST',
    url: '/v1/analytics',
    payload: {
      event: 'diagnostic_result_viewed',
      metadata: { pathname: '/diagnostico-antiban-whatsapp', origin: 'diagnostico_antiban_whatsapp', score_band: 'alto', entry_utm_source: 'instagram', entry_utm_content: marca },
    },
  })
  assert.equal(res.statusCode, 202)
  const gravado = await db.analyticsEvent.findFirst({ where: { event: 'diagnostic_result_viewed', metadata: { contains: marca } } })
  assert.ok(gravado, 'evento não foi gravado')
  const meta = JSON.parse(gravado.metadata)
  assert.equal(meta.page_path, '/diagnostico-antiban-whatsapp')
  assert.equal(meta.score_band, 'alto')
  assert.equal(meta.entry_utm_source, 'instagram')
  await db.analyticsEvent.deleteMany({ where: { metadata: { contains: marca } } })
  await app.close()
})

test('UTM de entrada: lê a URL crua e o formato saneado do cookie de primeiro toque', () => {
  const crua = '/bot-canais-whatsapp?utm_source=instagram&utm_medium=social&utm_campaign=canais-preservacao&utm_content=post3_checklist&fbclid=abc'
  assert.deepEqual(parseEntryUtm(crua), {
    entry_utm_source: 'instagram',
    entry_utm_medium: 'social',
    entry_utm_campaign: 'canais-preservacao',
    entry_utm_content: 'post3_checklist',
  })
  const saneada = '/bot-canais-whatsapp-utm_source-instagram-utm_medium-social-utm_campaign-canais-preservacao-utm_content-post3_checklist-fbclid-abc'
  assert.deepEqual(parseEntryUtm(saneada), parseEntryUtm(crua))
  assert.deepEqual(parseEntryUtm('/blog/x'), {})
  assert.deepEqual(parseEntryUtm(''), {})
  assert.deepEqual(parseEntryUtm(null), {})
  assert.equal(landingPath(saneada), '/bot-canais-whatsapp')
  assert.equal(landingPath(crua), '/bot-canais-whatsapp')
  assert.equal(landingPath('/faq-antiban-whatsapp/'), '/faq-antiban-whatsapp')
})

test('UTM de entrada: navegador e servidor usam a MESMA regra', () => {
  const casos = [
    '/bot-canais-whatsapp?utm_source=linkedin&utm_campaign=canais-preservacao&utm_content=post1_grupo_cair',
    '/diagnostico-antiban-whatsapp-utm_source-x-utm_medium-social-utm_campaign-canais-preservacao-utm_content-post2_antiban_honesto',
    '/materiais/checklist-antiban-whatsapp-source-materiais-utm_source-tiktok',
    '/', '', '/login?mode=register',
  ]
  for (const caso of casos) assert.deepEqual(parseEntryUtmNavegador(caso), parseEntryUtm(caso), caso)
})

test('campos da campanha no cadastro: só valores curtos e no formato esperado', () => {
  assert.deepEqual(campaignSignupFields({ diagnostic_score_band: 'alto', risk_score_band: 'critico', segmento: 'admin-canais' }), {
    diagnostic_score_band: 'alto', risk_score_band: 'critico', segmento: 'admin-canais',
  })
  assert.deepEqual(campaignSignupFields({ diagnostic_score_band: '<script>', segmento: '' }), { diagnostic_score_band: 'script' })
  assert.deepEqual(campaignSignupFields({ risk_score_band: '123' }), {})
  assert.deepEqual(campaignSignupFields(), {})
})

test('/login repassa faixa do diagnóstico, faixa da calculadora e segmento ao cadastro', () => {
  for (const chave of ['diagnostic_score_band', 'risk_score_band', 'segmento']) {
    assert.ok(ATTRIBUTION_QUERY_KEYS.includes(chave), `${chave} fora de ATTRIBUTION_QUERY_KEYS — o /login descarta`)
  }
  const params = new URLSearchParams('mode=register&utm_campaign=canais-preservacao&diagnostic_score_band=alto&segmento=admin-canais&risk_score_band=moderado')
  const attr = readAttributionFromSearchParams(params)
  assert.equal(attr.diagnostic_score_band, 'alto')
  assert.equal(attr.risk_score_band, 'moderado')
  assert.equal(attr.segmento, 'admin-canais')
  // O login espalha a atribuição no api.register.
  assert.match(ler('dashboard/app/login/page.js'), /api\.register\([^)]*\.\.\.signupAttribution/)
})

test('todo evento público persistido leva a UTM de entrada (sem sobrescrever o que o evento mandou)', () => {
  const navegador = ler('dashboard/lib/analytics.js')
  assert.match(navegador, /metadata: \{ \.\.\.readEntryUtm\(\), \.\.\.payload \}/)
})

test('signup_created grava faixa, segmento e UTM de entrada (cadastro real no banco de teste)', async () => {
  const { default: Fastify } = await import('fastify')
  const fastifyJwt = (await import('@fastify/jwt')).default
  const { authRoutes } = await import('../src/api/routes/auth.js')
  const { default: db } = await import('../src/db.js')
  const app = Fastify({ logger: false })
  await app.register(fastifyJwt, { secret: 'segredo-de-teste' })
  app.decorate('authenticate', async () => {})
  await app.register(authRoutes, { prefix: '/api/auth' })
  const agora = Date.now()
  const email = `campanha-${agora}@t.local`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      name: 'Teste Campanha',
      email,
      password: 'senha-forte-123',
      contactPhone: `1199${String(agora).slice(-7)}`,
      termsAccepted: true,
      source: 'diagnostico_antiban_whatsapp',
      utm_source: 'seo',
      utm_medium: 'diagnostic',
      utm_campaign: 'canais-preservacao',
      utm_content: 'resultado_alto',
      diagnostic_score_band: 'alto',
      segmento: 'admin-canais',
      landingPage: '/bot-canais-whatsapp-utm_source-instagram-utm_medium-social-utm_campaign-canais-preservacao-utm_content-post3_checklist',
    },
  })
  assert.equal(res.statusCode < 300, true, `cadastro falhou: ${res.statusCode} ${res.body}`)
  const user = await db.user.findFirst({ where: { email } })
  let evento = null
  for (let i = 0; i < 40 && !evento; i++) {
    evento = await db.analyticsEvent.findFirst({ where: { userId: user.id, event: 'signup_created' } })
    if (!evento) await new Promise((r) => setTimeout(r, 25))
  }
  assert.ok(evento, 'signup_created não foi gravado')
  const meta = JSON.parse(evento.metadata)
  assert.equal(meta.diagnostic_score_band, 'alto')
  assert.equal(meta.segmento, 'admin-canais')
  assert.equal(meta.utm_content, 'resultado_alto')
  assert.equal(meta.entry_utm_source, 'instagram')
  assert.equal(meta.entry_utm_content, 'post3_checklist')
  await new Promise((r) => setTimeout(r, 100))
  await db.analyticsEvent.deleteMany({ where: { userId: user.id } }).catch(() => {})
  await db.user.deleteMany({ where: { id: user.id } }).catch(() => {})
  await app.close()
})

test('funil: janela limitada a 90 dias (padrão 30) e nunca no futuro', () => {
  const now = new Date('2026-09-29T12:00:00Z')
  const padrao = boundedRange({}, now)
  assert.equal(Math.round((padrao.to - padrao.from) / 864e5), 30)
  const longa = boundedRange({ from: '2025-01-01T00:00:00Z' }, now)
  assert.equal(Math.round((longa.to - longa.from) / 864e5), MAX_RANGE_DAYS)
  const futuro = boundedRange({ to: '2030-01-01T00:00:00Z' }, now)
  assert.equal(futuro.to.getTime(), now.getTime())
  const lixo = boundedRange({ from: 'x', to: 'y' }, now)
  assert.equal(Math.round((lixo.to - lixo.from) / 864e5), 30)
})

test('funil: rota antiga (redirect) conta na página nova; página fora da campanha não entra', () => {
  assert.equal(campaignPage('/bot-comum-vs-botinho'), '/bot-comum-vs-espelha-grupos')
  assert.equal(campaignPage('/protecao-antiban-botinho-utm_source-x'), '/protecao-antiban-espelha-grupos')
  assert.equal(campaignPage('/blog/qualquer'), null)
  assert.equal(CAMPAIGN_PAGES.length, 8)
})

test('funil: monta página → clique → diagnóstico → calculadora → cadastro, faixa e botão', () => {
  const r = buildCampaignFunnel({
    eventRows: [
      { event: 'organic_page_view', page: '/bot-canais-whatsapp', entry_utm_source: 'instagram', entry_utm_campaign: 'canais-preservacao', entry_utm_content: 'post3', total: 100 },
      { event: 'organic_page_view', page: '/blog/fora-da-campanha', total: 999 },
      { event: 'organic_cta_click', page: '/bot-canais-whatsapp', cta: 'diagnostico_preservacao', cta_destination: 'diagnostic', entry_utm_source: 'instagram', entry_utm_campaign: 'canais-preservacao', entry_utm_content: 'post3', total: 20 },
      { event: 'diagnostic_result_viewed', page: '/diagnostico-antiban-whatsapp', band: 'alto', total: 15 },
      { event: 'diagnostic_form_submitted', page: '/diagnostico-antiban-whatsapp', band: 'alto', total: 5 },
      { event: 'diagnostic_cta_clicked', page: '/ferramentas/calculadora-risco-whatsapp', origin: 'calculadora_risco_whatsapp', band: 'critico', total: 4 },
      { event: 'diagnostic_cta_clicked', page: '/diagnostico-antiban-whatsapp', origin: 'diagnostico_antiban_whatsapp', total: 7 },
    ],
    signupRows: [
      { landing_page: '/bot-canais-whatsapp-utm_source-instagram', utm_campaign: 'canais-preservacao', utm_content: 'resultado_alto', entry_utm_source: 'instagram', entry_utm_campaign: 'canais-preservacao', entry_utm_content: 'post3', diagnostic_score_band: 'alto', segmento: 'admin-canais', source: 'diagnostico_antiban_whatsapp', total: 2 },
      { landing_page: '/', utm_campaign: 'outra', total: 50 },
    ],
  })
  assert.deepEqual(r.totals, { views: 100, ctaClicks: 20, diagnosticViewed: 15, diagnosticSubmitted: 5, calculatorClicks: 4, signups: 2 })
  const landing = r.byPage.find((p) => p.page === '/bot-canais-whatsapp')
  assert.equal(landing.signups, 2)
  assert.equal(landing.ctaRate, 20)
  assert.equal(r.byPage.length, 8, 'as 8 páginas aparecem mesmo zeradas')
  assert.deepEqual(r.signupsByCta, [{ key: 'resultado_alto', signups: 2 }])
  assert.deepEqual(r.ctaClicks, [{ page: '/bot-canais-whatsapp', cta: 'diagnostico_preservacao', destination: 'diagnostic', clicks: 20 }])
  const alto = r.bands.find((b) => b.kind === 'diagnóstico' && b.band === 'alto')
  assert.equal(alto.diagnosticSubmitted, 5)
  assert.equal(alto.signups, 2)
  assert.equal(alto.signupRate, 40)
  assert.ok(r.bands.find((b) => b.kind === 'calculadora' && b.band === 'critico'))
  const post3 = r.byUtm.find((u) => u.utm_content === 'post3')
  assert.equal(post3.views, 100)
  assert.equal(post3.signups, 2)
  assert.deepEqual(r.segmentos, [{ key: 'admin-canais', signups: 2 }])
  assert.equal(r.truncated, false)
})

test('funil: a consulta agrega no banco de teste e respeita a janela', async () => {
  const { default: db } = await import('../src/db.js')
  const { loadCampaignFunnel } = await import('../src/domain/admin/campaignFunnelQuery.js')
  const marca = `funil-${Date.now()}`
  const agora = new Date()
  const base = { event: 'organic_page_view', createdAt: agora }
  const linhas = [
    { ...base, id: `${marca}-1`, metadata: JSON.stringify({ path: '/faq-antiban-whatsapp', entry_utm_source: 'x', entry_utm_content: marca }) },
    { ...base, id: `${marca}-2`, metadata: JSON.stringify({ path: '/faq-antiban-whatsapp', entry_utm_source: 'x', entry_utm_content: marca }) },
    { ...base, id: `${marca}-3`, metadata: JSON.stringify({ path: '/faq-antiban-whatsapp', entry_utm_content: marca }), createdAt: new Date(agora.getTime() - 200 * 864e5) },
    { id: `${marca}-4`, event: 'signup_created', createdAt: agora, metadata: JSON.stringify({ landing_page: '/faq-antiban-whatsapp', utm_campaign: 'canais-preservacao', utm_content: `p2_signup_${marca}`, risk_score_band: 'alto' }) },
  ]
  for (const data of linhas) await db.analyticsEvent.create({ data })
  try {
    const r = await loadCampaignFunnel(db, boundedRange({}, new Date(agora.getTime() + 1000)))
    const utm = r.byUtm.find((u) => u.utm_content === marca)
    assert.equal(utm?.views, 2, 'a linha de 200 dias atrás não pode entrar')
    assert.ok(r.signupsByCta.find((c) => c.key === `p2_signup_${marca}`))
    assert.ok(r.bands.find((b) => b.kind === 'calculadora' && b.band === 'alto' && b.signups >= 1))
    assert.equal(typeof r.totals.views, 'number')
    assert.doesNotThrow(() => JSON.stringify(r), 'resposta precisa ser serializável (sem BigInt)')
  } finally {
    await db.analyticsEvent.deleteMany({ where: { id: { startsWith: marca } } })
  }
})

test('rota do admin: só leitura, exige admin, janela limitada, auditada', () => {
  const admin = ler('src/api/routes/admin.js')
  const i = admin.indexOf("app.get('/marketing/campanha-canais'")
  assert.ok(i !== -1, 'rota /marketing/campanha-canais não encontrada')
  const bloco = admin.slice(i, admin.indexOf('app.get(', i + 10))
  assert.match(bloco, /requireAdmin\(req, reply, 'admin:read'\)/)
  assert.match(bloco, /boundedCampaignRange\(/)
  assert.match(bloco, /writeAdminAuditLog/)
  const consulta = ler('src/domain/admin/campaignFunnelQuery.js')
  assert.equal((consulta.match(/LIMIT \$\{ROW_LIMIT\}/g) || []).length, 2, 'as duas consultas precisam de LIMIT')
  assert.equal((consulta.match(/GROUP BY 1,/g) || []).length, 2, 'as duas consultas precisam agregar no banco')
  assert.doesNotMatch(consulta, /findMany/, 'nada de trazer linha a linha para o Node')
})

test('tela do admin usa só tokens do design system (sem hex solto) e mostra as três perguntas', () => {
  const tela = ler('dashboard/app/admin/marketing-growth/CampanhaCanaisFunil.js')
  assert.doesNotMatch(tela, /#[0-9a-fA-F]{3,8}\b/, 'cor em hex solto — usar var(--token)')
  assert.match(tela, /var\(--accent-strong\)/)
  for (const pergunta of ['Qual página trouxe lead?', 'Qual botão gerou cadastro?', 'Qual faixa de risco converte melhor?']) {
    assert.ok(tela.includes(pergunta), `falta a seção "${pergunta}"`)
  }
  assert.match(ler('dashboard/app/admin/marketing-growth/page.js'), /<CampanhaCanaisFunil \/>/)
  assert.match(ler('dashboard/lib/api.js'), /adminMarketingCampanhaCanais/)
})

test('diag-funil-antiban: read-only, janela máx. 90 dias, imprime sem banco', async () => {
  const fonte = ler('scripts/diag-funil-antiban.mjs')
  assert.doesNotMatch(fonte, /\.(create|update|upsert|delete|deleteMany|updateMany|executeRaw)\(/, 'diagnóstico não escreve')
  assert.match(fonte, /loadCampaignFunnel/, 'script e tela usam a mesma montagem')
  const { periodoDosArgs, imprimirRelatorio } = await import('../scripts/diag-funil-antiban.mjs')
  const now = new Date('2026-09-29T12:00:00Z')
  const semana = periodoDosArgs([], now)
  assert.equal(Math.round((semana.to - semana.from) / 864e5), 7)
  const muito = periodoDosArgs(['--dias', '400'], now)
  assert.equal(Math.round((muito.to - muito.from) / 864e5), 90)
  const saida = []
  const original = console.log
  console.log = (...a) => saida.push(a.join(' '))
  try {
    imprimirRelatorio(buildCampaignFunnel({ from: semana.from, to: semana.to }))
  } finally {
    console.log = original
  }
  assert.match(saida.join('\n'), /PÁGINA DE ENTRADA/)
  assert.match(saida.join('\n'), /FAIXA DE RISCO/)
  assert.match(saida.join('\n'), /ABANDONO/)
})
