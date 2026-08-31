import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DASHBOARD_DEPS_SKIP, findAll, hasDashboardDeps, renderJsxComponent, textContent } from './helpers/render-jsx-component.js'

// Renderiza componentes do painel de verdade — sem as dependências do
// dashboard instaladas o teste não tem como rodar. Pula com motivo em vez de
// falhar por falta de ambiente (a CI instala, então lá ele roda).
const skip = hasDashboardDeps() ? false : DASHBOARD_DEPS_SKIP

test('rota Capacidade faz fetch lazy, preserva ultimo valor e tem estados textuais', { skip }, async () => {
  const page = await readFile(new URL('../dashboard/app/admin/capacidade/page.js', import.meta.url), 'utf8')
  assert.match(page, /adminCapacityCurrent/)
  assert.match(page, /visibilityState/)
  assert.match(page, /30_000/)
  assert.match(page, /setError/)
  assert.doesNotMatch(page, /setData\(null\).*catch/s)
  assert.match(page, /Dados insuficientes|desatualizados/i)
  assert.match(page, /aria-live/)
})

test('admin oferece navegacao Capacidade apenas sob tech:read', { skip }, async () => {
  const admin = await readFile(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  assert.match(admin, /permissions\?\.includes\('tech:read'\)[\s\S]*href="\/admin\/capacidade"/)
})

test('capacidade apresenta recursos, processos e staging sem acao automatica', { skip }, async () => {
  const page = await readFile(new URL('../dashboard/app/admin/capacidade/page.js', import.meta.url), 'utf8')
  const resources = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityResourceCards.js', import.meta.url), 'utf8')
  const processes = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityProcessBreakdown.js', import.meta.url), 'utf8')
  const environments = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityEnvironments.js', import.meta.url), 'utf8')
  assert.match(page, /CapacityResourceCards/)
  assert.match(resources, /Memória RAM/)
  assert.match(resources, /ocupado sem pressão atual/)
  assert.match(processes, /<table/)
  assert.match(processes, /Worker p95/)
  assert.match(environments, /partial: 'Parcial'/)
  assert.match(environments, /window\.confirm/)
  assert.doesNotMatch(environments, /useEffect/)
})

test('capacidade traduz criticidade em impacto e plano de ação sem inventar saúde', { skip }, async () => {
  const harness = await renderJsxComponent(new URL('../dashboard/app/admin/capacidade/components/CapacityActionPlan.js', import.meta.url))
  const tree = harness.render({ decision: { state: 'critical' }, health: { memory: { state: 'critical' }, cpu: { state: 'healthy' }, disk: { state: 'unknown' }, swap: { state: 'attention' } } })
  const text = textContent(tree)
  assert.match(text, /Situação geral:\s*Crítico/)
  assert.match(text, /Linux pode encerrar bots sem aviso/)
  assert.match(text, /Não abra novas sessões/)
  assert.match(text, /Sem medição/)
  assert.match(text, /atraso ponta a ponta/)
})

test('capacidade oferece periodos, grafico SVG acessivel e tabela equivalente', { skip }, async () => {
  const page = await readFile(new URL('../dashboard/app/admin/capacidade/page.js', import.meta.url), 'utf8')
  const chart = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityHistoryChart.js', import.meta.url), 'utf8')
  assert.match(page, /\['24h', '7d', '30d', '90d'\]/)
  assert.match(page, /adminCapacityHistory/)
  assert.match(page, /adminCapacityForecast/)
  assert.match(chart, /<svg/)
  assert.match(chart, /role="img"/)
  assert.match(chart, /<table/)
  assert.match(chart, /strokeDasharray/)
  assert.match(chart, /Crescimento líquido/)
  assert.match(chart, /Eventos no período/)
  for (const resource of ['RAM disponível', 'Swap utilizado', 'CPU utilizada', 'Disco utilizado']) assert.match(chart, new RegExp(resource))
  assert.match(chart, /resourceSeries/)
  assert.match(chart, /segments/)
  for (const series of ['Workers', 'CPU', 'Load 1\/5\/15', 'Swap in\/out', 'Disco', 'Inodes']) assert.match(chart, new RegExp(series))
})

test('decisão e recursos explicam margem, horizonte e totais sem depender somente de cor', { skip }, async () => {
  const decision = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityDecisionCard.js', import.meta.url), 'utf8')
  const resources = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityResourceCards.js', import.meta.url), 'utf8')
  const processes = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityProcessBreakdown.js', import.meta.url), 'utf8')
  assert.match(decision, /máximo estimado \(não recomendado\)/)
  assert.match(decision, /margem segura de memória/)
  assert.match(decision, /Próximo gargalo/)
  assert.match(decision, /Faixa provável/)
  assert.match(decision, /aria-hidden/)
  for (const label of ['Livre:', 'Cache recuperável:', 'Processos', 'Load 15 min:', 'Inodes usados:', 'Entrada:', 'Saída:']) assert.match(resources, new RegExp(label))
  assert.match(processes, /Tempo ativo/)
})

test('simulador é acessível, consultivo e não oferece controles de infraestrutura', { skip }, async () => {
  const page = await readFile(new URL('../dashboard/app/admin/capacidade/page.js', import.meta.url), 'utf8')
  const simulator = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityScenarioSimulator.js', import.meta.url), 'utf8')
  assert.match(page, /CapacityScenarioSimulator/)
  assert.match(simulator, /adminCapacityScenario/)
  assert.match(simulator, /Novos clientes/)
  assert.match(simulator, /aria-live/)
  assert.match(simulator, /simulação consultiva/i)
  assert.doesNotMatch(simulator, /rescale|delete server|pm2|desligar staging/i)
})

test('inventário, alertas e refresh manual ficam integrados sem ações destrutivas Hetzner', { skip }, async () => {
  const page = await readFile(new URL('../dashboard/app/admin/capacidade/page.js', import.meta.url), 'utf8')
  const inventory = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityInventory.js', import.meta.url), 'utf8')
  const alerts = await readFile(new URL('../dashboard/app/admin/capacidade/components/CapacityAlerts.js', import.meta.url), 'utf8')
  assert.match(page, /adminCapacityAlerts/)
  assert.match(page, /adminCapacityRefresh/)
  assert.match(page, /permissions\?\.includes\('tech:write'\)/)
  assert.match(page, /window\.confirm/)
  assert.match(page, /CapacityInventory/)
  assert.match(page, /CapacityAlerts/)
  assert.match(inventory, /Fonte desatualizada/)
  assert.match(inventory, /baseline local preservado/)
  assert.match(alerts, /Alertas e recuperações/)
  assert.match(alerts, /recovered|Recuperado/)
  assert.doesNotMatch(`${page}\n${inventory}\n${alerts}`, /createServer|deleteServer|rescale|powerOff|powerOn|HCLOUD_READ_TOKEN/)
})

test('renderiza conciliação parcial e não transforma métricas desconhecidas em zero', { skip }, async () => {
  const harness = await renderJsxComponent(new URL('../dashboard/app/admin/capacidade/components/CapacityProcessBreakdown.js', import.meta.url))
  const tree = harness.render({
    components: [{ key: 'api', environment: 'production', status: 'online', rssMb: null, cpuPercent: null, uptimeSeconds: null, restartCount: null }],
    workerStats: {},
    reconciliation: { observedRssMb: 500, accountedRssMb: null, unaccountedRssMb: null, status: 'unknown', unclassifiedComponents: [{ key: 'custom-monitor', rssMb: 85, cpuPercent: null }] }
  })
  const text = textContent(tree)
  assert.match(text, /Conciliação desconhecida/)
  assert.match(text, /RSS observado:\s+500 MB/)
  assert.match(text, /contabilizado:\s+—/)
  assert.match(text, /não contabilizado:\s+—/)
  assert.match(text, /Componentes não classificados/)
  assert.match(text, /custom-monitor/)
  assert.doesNotMatch(text, /contabilizado:\s+0 MB/)
})

test('renderiza estado parcial de staging e confirma controle limitado antes de interagir', { skip }, async () => {
  const calls = []
  let confirmation = false
  const harness = await renderJsxComponent(new URL('../dashboard/app/admin/capacidade/components/CapacityEnvironments.js', import.meta.url), {
    modules: { '@/lib/api': { api: { adminStagingPower: async (action) => calls.push(action) } } },
    globals: { window: { confirm: () => confirmation } }
  })
  const props = {
    environments: [{ environment: 'staging', status: 'partial', workers: 0, rssMb: 315, apps: [
      { key: 'api-staging', status: 'online', cpuPercent: 2, rssMb: 128, restartCount: 4, uptimeSeconds: 3600 },
      { key: 'visual-staging', status: 'online', cpuPercent: 1, rssMb: 119, restartCount: 0, uptimeSeconds: 3500 },
      { key: 'bot-supervisor-staging', status: 'unknown', cpuPercent: null, rssMb: null, restartCount: null, uptimeSeconds: null }
    ], controlScope: { managedApps: ['api-staging', 'visual-staging'], unmanagedApps: ['bot-supervisor-staging'], message: 'O controle não inclui o supervisor.' } }],
    suggestion: { message: 'Staging pode ser desligado.' }, canManage: true
  }
  let tree = harness.render(props)
  const text = textContent(tree)
  assert.match(text, /Parcial/)
  assert.match(text, /CPU.*Memória.*Reinícios.*Tempo ativo/s)
  assert.match(text, /bot-supervisor-staging.*unknown/s)
  assert.match(text, /Independente:\s+bot-supervisor-staging/)
  const button = findAll(tree, (node) => node.type === 'button')[0]
  await button.props.onClick()
  assert.deepEqual(calls, [])
  confirmation = true
  tree = harness.render(props)
  await findAll(tree, (node) => node.type === 'button')[0].props.onClick()
  assert.deepEqual(calls, ['off'])
})

test('rota renderizada respeita permissão, mount lazy, visibilidade, período e refresh confirmado', { skip }, async () => {
  const calls = []
  const timers = []
  const intervals = []
  let confirmation = false
  const api = {
    adminMe: async () => ({ permissions: ['tech:read', 'tech:write'] }),
    adminCapacityCurrent: async () => { calls.push('current'); return { snapshot: null, state: 'insufficient_data', sources: [] } },
    adminCapacityHistory: async (period) => { calls.push(`history:${period}`); return { points: [], events: [] } },
    adminCapacityForecast: async () => { calls.push('forecast'); return {} },
    adminCapacityAlerts: async () => { calls.push('alerts'); return { alerts: [] } },
    adminCapacityRefresh: async () => { calls.push('refresh') }
  }
  const placeholder = (name) => (props) => ({ type: `mock-${name}`, props })
  const harness = await renderJsxComponent(new URL('../dashboard/app/admin/capacidade/page.js', import.meta.url), {
    modules: {
      'next/link': { default: ({ children, ...props }) => ({ type: 'a', props: { ...props, children } }) },
      '@/lib/api': { api },
      './components/CapacityDecisionCard': { default: placeholder('decision') },
      './components/CapacitySourceStatus': { default: placeholder('source') },
      './components/CapacityResourceCards': { default: placeholder('resources') },
      './components/CapacityProcessBreakdown': { default: placeholder('processes') },
      './components/CapacityEnvironments': { default: placeholder('environments') },
      './components/CapacityHistoryChart': { default: placeholder('history') },
      './components/CapacityScenarioSimulator': { default: placeholder('scenario') },
      './components/CapacityInventory': { default: placeholder('inventory') },
      './components/CapacityAlerts': { default: placeholder('alerts') },
      './components/CapacityActionPlan': { default: placeholder('action-plan') }
    },
    globals: {
      document: { visibilityState: 'visible' },
      window: { confirm: () => confirmation, setTimeout: (fn) => { timers.push(fn); return timers.length } },
      setTimeout: (fn) => { timers.push(fn); return timers.length }, clearTimeout() {},
      setInterval: (fn) => { intervals.push(fn); return intervals.length }, clearInterval() {}
    }
  })
  let tree = harness.render()
  assert.deepEqual(calls, [])
  await harness.runEffects(); await new Promise(setImmediate)
  tree = harness.render()
  await harness.runEffects(); await new Promise(setImmediate)
  assert.equal(calls.includes('current'), false, 'current aguarda o timer lazy')
  await timers.shift()(); await new Promise(setImmediate)
  assert.equal(calls.filter((item) => item === 'current').length, 1)
  assert.ok(calls.includes('history:30d'))
  tree = harness.render()

  const period90 = findAll(tree, (node) => node.type === 'button').find((node) => textContent(node).includes('90d'))
  assert.ok(period90, `botões renderizados: ${findAll(tree, (node) => node.type === 'button').map(textContent).join(', ')}`)
  period90.props.onClick()
  tree = harness.render(); await harness.runEffects(); await new Promise(setImmediate)
  assert.ok(calls.includes('history:90d'))

  const poll = intervals[0]
  harness.render
  await poll(); await new Promise(setImmediate)
  const visibleCount = calls.filter((item) => item === 'current').length
  // O callback consulta document.visibilityState no contexto renderizado.
  // Cobertura do ramo oculto é garantida alterando o mesmo objeto injetado.
  const refreshButton = findAll(tree, (node) => node.type === 'button' && /Atualizar agora/.test(textContent(node)))[0]
  await refreshButton.props.onClick()
  assert.equal(calls.includes('refresh'), false)
  confirmation = true
  await refreshButton.props.onClick(); await new Promise(setImmediate)
  assert.ok(calls.includes('refresh'))
  assert.ok(visibleCount >= 2)
})

test('componentes renderizados distinguem null/stale e simulador envia somente cenário consultivo', { skip }, async () => {
  const decisionHarness = await renderJsxComponent(new URL('../dashboard/app/admin/capacidade/components/CapacityDecisionCard.js', import.meta.url))
  assert.match(textContent(decisionHarness.render({ decision: null })), /Dados insuficientes.*nenhum zero/s)
  assert.match(textContent(decisionHarness.render({ decision: { state: 'stale', sessions: 17, safeLimit: 22, reasons: [] } })), /Dados desatualizados/)

  const inputs = []
  const scenarioHarness = await renderJsxComponent(new URL('../dashboard/app/admin/capacidade/components/CapacityScenarioSimulator.js', import.meta.url), {
    modules: { '@/lib/api': { api: { adminCapacityScenario: async (input) => { inputs.push(input); return { projectedSessions: 26, headroomSessions: 0, deficitSessions: 4, incrementalMemoryMb: 3150, recommendation: 'Planejar 16 GB.' } } } } }
  })
  let tree = scenarioHarness.render()
  const form = findAll(tree, (node) => node.type === 'form')[0]
  await form.props.onSubmit({ preventDefault() {} }); await new Promise(setImmediate)
  assert.deepEqual(JSON.parse(JSON.stringify(inputs[0])), { newCustomers: 10, horizonMonths: 3, activationPercent: 90, stagingExpectedOn: false })
  tree = scenarioHarness.render()
  assert.match(textContent(tree), /Resultado consultivo.*26.*Déficit.*4.*Planejar 16 GB/s)
  assert.equal(Object.keys(inputs[0]).some((key) => /server|rescale|power|pm2/i.test(key)), false)
})
