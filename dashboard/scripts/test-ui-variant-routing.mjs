import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classifyTree, resolveAppRedirect, ROUTE_MAP } from '../lib/ui-variant/routeMap.js'

test('classifyTree identifica cada árvore de app', () => {
  assert.equal(classifyTree('/m'), 'm')
  assert.equal(classifyTree('/m/op/offer'), 'm')
  assert.equal(classifyTree('/painel'), 'painel')
  assert.equal(classifyTree('/painel/grupos'), 'painel')
  assert.equal(classifyTree('/dashboard'), 'dashboard')
  assert.equal(classifyTree('/dashboard/logs'), 'dashboard')
})

test('classifyTree ignora rotas que não são de app', () => {
  assert.equal(classifyTree('/'), null)
  assert.equal(classifyTree('/login'), null)
  assert.equal(classifyTree('/blog/post'), null)
  assert.equal(classifyTree('/mapa'), null) // não confundir com /m
  assert.equal(classifyTree('/painelzinho'), null)
})

test('mobile em /painel/* redireciona para o equivalente /m', () => {
  assert.equal(resolveAppRedirect({ pathname: '/painel/grupos', variant: 'mobile' }), '/m/config/groups')
  assert.equal(resolveAppRedirect({ pathname: '/painel/criar-oferta', variant: 'mobile' }), '/m/op/offer')
  assert.equal(resolveAppRedirect({ pathname: '/painel/envios', variant: 'mobile' }), '/m/op/logs')
})

test('mobile em /dashboard/* redireciona para o equivalente /m', () => {
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/logs', variant: 'mobile' }), '/m/op/logs')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard', variant: 'mobile' }), '/m/config/whatsapp')
})

test('mobile em rota /painel/dashboard sem mapeamento cai na home /m', () => {
  assert.equal(resolveAppRedirect({ pathname: '/painel/rota-nova', variant: 'mobile' }), '/m')
})

test('mobile já em /m não redireciona', () => {
  assert.equal(resolveAppRedirect({ pathname: '/m', variant: 'mobile' }), null)
  assert.equal(resolveAppRedirect({ pathname: '/m/op/offer', variant: 'mobile' }), null)
})

test('web em /m/* com tela portada vai para /painel', () => {
  assert.equal(resolveAppRedirect({ pathname: '/m/op/offer', variant: 'web' }), '/painel/criar-oferta')
  assert.equal(resolveAppRedirect({ pathname: '/m/config/groups', variant: 'web' }), '/painel/grupos')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/logs', variant: 'web' }), '/painel/envios')
  assert.equal(resolveAppRedirect({ pathname: '/m/config/preservacao', variant: 'web' }), '/painel/preservacao')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/broadcast', variant: 'web' }), '/painel/envio')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/scheduled', variant: 'web' }), '/painel/agendados')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/converter', variant: 'web' }), '/painel/converte-links')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/espelhar', variant: 'web' }), '/painel/espelhamento')
  assert.equal(resolveAppRedirect({ pathname: '/m/tutorial', variant: 'web' }), '/painel/tutorial')
  assert.equal(resolveAppRedirect({ pathname: '/m/checklistespelhamento', variant: 'web' }), '/painel/checklist')
})

test('agendados mantém ponte de compatibilidade até a aba consolidada', () => {
  assert.equal(resolveAppRedirect({ pathname: '/m/op/scheduled', variant: 'web' }), '/painel/agendados')
  const legacyPage = readFileSync(new URL('../app/painel/agendados/page.js', import.meta.url), 'utf8')
  assert.match(legacyPage, /redirect\('\/painel\/envios\?view=scheduled'\)/)
})

test('web em /m/* usa destino consolidado ou cai na home /painel', () => {
  assert.equal(resolveAppRedirect({ pathname: '/m/account/variations', variant: 'web' }), '/painel/mensagens')
  assert.equal(resolveAppRedirect({ pathname: '/m/account', variant: 'web' }), '/painel')
})

test('mobile em /painel/* das telas novas volta para o /m equivalente', () => {
  assert.equal(resolveAppRedirect({ pathname: '/painel/envio', variant: 'mobile' }), '/m/op/broadcast')
  assert.equal(resolveAppRedirect({ pathname: '/painel/agendados', variant: 'mobile' }), '/m/op/scheduled')
  assert.equal(resolveAppRedirect({ pathname: '/painel/converte-links', variant: 'mobile' }), '/m/op/converter')
  assert.equal(resolveAppRedirect({ pathname: '/painel/espelhamento', variant: 'mobile' }), '/m/op/espelhar')
  assert.equal(resolveAppRedirect({ pathname: '/painel/tutorial', variant: 'mobile' }), '/m/tutorial')
  assert.equal(resolveAppRedirect({ pathname: '/painel/preservacao/monitoramento', variant: 'mobile' }), '/m/config/preservacao')
  assert.equal(resolveAppRedirect({ pathname: '/painel/preservacao/configuracoes', variant: 'mobile' }), '/m/config/preservacao')
})

test('web em /painel não redireciona', () => {
  assert.equal(resolveAppRedirect({ pathname: '/painel', variant: 'web' }), null)
  assert.equal(resolveAppRedirect({ pathname: '/painel/plano', variant: 'web' }), null)
})

test('web em /dashboard/* (legado aposentado) redireciona para /painel', () => {
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/logs', variant: 'web' }), '/painel/envios')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/preservacao', variant: 'web' }), '/painel/preservacao')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/envio', variant: 'web' }), '/painel/envio')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/gerar-oferta', variant: 'web' }), '/painel/criar-oferta')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard', variant: 'web' }), '/painel/whatsapp')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/pagamento/sucesso', variant: 'web' }), '/painel/pagamento/sucesso')
})

test('web em /dashboard/* sem mapeamento específico cai na home legada (whatsapp)', () => {
  // /dashboard (bare) era o hub de conexão; serve de catch-all para sub-rotas
  // legadas sem mapeamento próprio (ex.: /dashboard/planos, que redirecionava).
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/planos', variant: 'web' }), '/painel/whatsapp')
})

test('homes trocam corretamente entre fronts', () => {
  assert.equal(resolveAppRedirect({ pathname: '/painel', variant: 'mobile' }), '/m')
  assert.equal(resolveAppRedirect({ pathname: '/m', variant: 'web' }), '/painel')
})

test('sub-rotas casam pelo prefixo mais específico', () => {
  assert.equal(
    resolveAppRedirect({ pathname: '/dashboard/preservacao/monitoramento', variant: 'mobile' }),
    '/m/config/preservacao',
  )
  assert.equal(
    resolveAppRedirect({ pathname: '/m/config/preservacao/algo', variant: 'web' }),
    '/painel/preservacao',
  )
})

test('/dashboard bare casa whatsapp, não vaza para sub-rotas', () => {
  // bare /dashboard → whatsapp; /dashboard/grupos → grupos (prefixo mais longo)
  assert.equal(resolveAppRedirect({ pathname: '/dashboard', variant: 'mobile' }), '/m/config/whatsapp')
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/grupos', variant: 'mobile' }), '/m/config/groups')
})

test('rotas fora do app nunca redirecionam', () => {
  for (const variant of ['mobile', 'web']) {
    assert.equal(resolveAppRedirect({ pathname: '/', variant }), null)
    assert.equal(resolveAppRedirect({ pathname: '/login', variant }), null)
    assert.equal(resolveAppRedirect({ pathname: '/blog/x', variant }), null)
  }
})

test('sem loop: aplicar o redirect duas vezes é estável', () => {
  const cases = [
    { pathname: '/painel/grupos', variant: 'mobile' },
    { pathname: '/dashboard/logs', variant: 'mobile' },
    { pathname: '/m/op/offer', variant: 'web' },
    { pathname: '/m/config/preservacao', variant: 'web' },
    { pathname: '/m/op/espelhar', variant: 'web' },
    { pathname: '/dashboard/logs', variant: 'web' },
    { pathname: '/dashboard/pagamento/sucesso', variant: 'web' },
  ]
  for (const c of cases) {
    const first = resolveAppRedirect(c)
    assert.ok(first, `esperava redirect para ${JSON.stringify(c)}`)
    const second = resolveAppRedirect({ pathname: first, variant: c.variant })
    assert.equal(second, null, `redirect não estabilizou: ${c.pathname} → ${first} → ${second}`)
  }
})

test('rotas de origem são únicas e painel só compartilha o destino intencional de mensagens', () => {
  for (const tree of ['m', 'dashboard']) {
    const paths = ROUTE_MAP.map((e) => e[tree]).filter(Boolean)
    assert.equal(new Set(paths).size, paths.length, `colisão de caminhos na árvore ${tree}`)
  }

  const painelFeaturesByPath = new Map()
  for (const entry of ROUTE_MAP) {
    if (!entry.painel) continue
    const features = painelFeaturesByPath.get(entry.painel) ?? []
    features.push(entry.feature)
    painelFeaturesByPath.set(entry.painel, features)
  }

  const sharedPainelPaths = [...painelFeaturesByPath.entries()].filter(([, features]) => features.length > 1)
  assert.deepEqual(sharedPainelPaths, [['/painel/mensagens', ['messages', 'variations']]])
})
