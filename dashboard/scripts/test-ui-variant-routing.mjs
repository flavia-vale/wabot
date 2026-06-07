import test from 'node:test'
import assert from 'node:assert/strict'
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
})

test('web em /m/* sem tela no painel cai no /dashboard legado', () => {
  assert.equal(resolveAppRedirect({ pathname: '/m/config/preservacao', variant: 'web' }), '/dashboard/preservacao')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/broadcast', variant: 'web' }), '/dashboard/envio')
  assert.equal(resolveAppRedirect({ pathname: '/m/op/converter', variant: 'web' }), '/dashboard/converte-links')
})

test('web em /m/* sem equivalente nenhum cai na home /painel', () => {
  assert.equal(resolveAppRedirect({ pathname: '/m/op/espelhar', variant: 'web' }), '/painel')
  assert.equal(resolveAppRedirect({ pathname: '/m/account/variations', variant: 'web' }), '/painel')
})

test('web em /painel não redireciona', () => {
  assert.equal(resolveAppRedirect({ pathname: '/painel', variant: 'web' }), null)
  assert.equal(resolveAppRedirect({ pathname: '/painel/plano', variant: 'web' }), null)
})

test('web em /dashboard NÃO redireciona na Fase 1 (legado segue como fallback)', () => {
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/logs', variant: 'web' }), null)
  assert.equal(resolveAppRedirect({ pathname: '/dashboard/preservacao', variant: 'web' }), null)
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
    '/dashboard/preservacao',
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
  ]
  for (const c of cases) {
    const first = resolveAppRedirect(c)
    assert.ok(first, `esperava redirect para ${JSON.stringify(c)}`)
    const second = resolveAppRedirect({ pathname: first, variant: c.variant })
    assert.equal(second, null, `redirect não estabilizou: ${c.pathname} → ${first} → ${second}`)
  }
})

test('caminhos não-nulos são únicos por árvore (sem ambiguidade de origem)', () => {
  for (const tree of ['m', 'painel', 'dashboard']) {
    const paths = ROUTE_MAP.map((e) => e[tree]).filter(Boolean)
    assert.equal(new Set(paths).size, paths.length, `colisão de caminhos na árvore ${tree}`)
  }
})
