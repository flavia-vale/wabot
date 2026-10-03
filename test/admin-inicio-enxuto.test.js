import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// G2 da auditoria do painel (2026-10-02): o Início não pode voltar a ser o
// arquivo de 3.800 linhas que carregava 20 consultas no boot. Financeiro mora
// em /admin/receita e o técnico/conteúdo em /admin/operacao.

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const inicio = read('dashboard/app/admin/page.js')
const receita = read('dashboard/app/admin/receita/page.js')
const operacao = read('dashboard/app/admin/operacao/page.js')

test('o Início não tem mais as abas Financeiro e Configurações', () => {
  assert.ok(!inicio.includes("['financeiro', 'Financeiro']"))
  assert.ok(!inicio.includes("['config', 'Configurações']"))
  assert.ok(!inicio.includes("tab === 'observabilidade'"), 'a aba oculta técnica foi para a Operação')
  assert.ok(!inicio.includes('function RoiPanel('))
  assert.ok(!inicio.includes('function ManualPaymentModal('))
  assert.ok(!inicio.includes('function StagingPowerCard('))
  assert.ok(!inicio.includes('function TermsEditor('))
})

test('o menu do Início leva às duas páginas novas, por permissão', () => {
  assert.match(inicio, /permissions\?\.includes\('billing:read'\) && <Link href="\/admin\/receita"/)
  assert.match(inicio, /permissions\?\.includes\('tech:read'\) && <Link href="\/admin\/operacao"/)
})

test('o boot do Início não carrega mais o que só as outras páginas mostram', () => {
  for (const chamada of ['api.adminSessions(', 'api.adminSessionTelemetry(', 'api.adminLogs(', 'api.adminLogsSummary(', 'api.adminPayments(', 'api.adminSubscriptions(', 'api.adminSystemHealth(', 'api.adminLpContent(', 'api.adminLegalTerms(']) {
    assert.ok(!inicio.includes(chamada), `${chamada} ainda é chamado pelo Início`)
  }
  // O resumo financeiro continua, mas só para os dois cards da aba Afiliados.
  assert.equal((inicio.match(/api\.adminFinanceOverview\(/g) ?? []).length, 1)
})

test('cada página carrega só o que ela mesma mostra', () => {
  for (const chamada of ['api.adminFinanceOverview(', 'api.adminPayments(', 'api.adminSubscriptions(', 'api.adminFinanceRoi(', 'api.adminSubscriptionCharges(']) {
    assert.ok(receita.includes(chamada), `Receita sem ${chamada}`)
  }
  assert.ok(!receita.includes('api.adminOnline('), 'Receita não precisa da frota')
  for (const chamada of ['api.adminSystemHealth(', 'api.adminSessions(', 'api.adminLogs(', 'api.adminLpContent(', 'api.adminLegalTerms(', 'api.adminStagingStatus(']) {
    assert.ok(operacao.includes(chamada), `Operação sem ${chamada}`)
  }
  assert.ok(!operacao.includes('api.adminFinanceOverview('), 'Operação não mostra dinheiro')
})

test('clicar numa cliente na Receita abre a ficha, sem painel duplicado', () => {
  assert.match(receita, /router\.push\(`\/admin\/clientes\/\$\{id\}`\)/)
  assert.ok(!receita.includes('function DetailPanel('))
})

test('nenhuma das três telas volta a crescer sem decisão', () => {
  const linhas = (fonte) => fonte.split('\n').length
  assert.ok(linhas(inicio) <= 1200, `Início com ${linhas(inicio)} linhas (teto 1200 — Online/Sucesso já viraram a caixa Hoje e a ficha)`)
  assert.ok(linhas(receita) <= 1400, `Receita com ${linhas(receita)} linhas`)
  assert.ok(linhas(operacao) <= 1100, `Operação com ${linhas(operacao)} linhas`)
})

test('o boot do Início faz no máximo 7 consultas distintas', () => {
  // adminMe (porteiro) + as 6 do corpo. Afiliados só carrega quando a aba abre.
  const boot = inicio.slice(inicio.indexOf('function fetchPainel'), inicio.indexOf('const [usersSort'))
  const chamadas = new Set([...(boot + inicio.slice(inicio.indexOf('api.adminMe()'), inicio.indexOf('api.adminMe()') + 40)).matchAll(/api\.(admin\w+)\(/g)].map(m => m[1]))
  assert.ok(chamadas.size <= 7, `boot com ${chamadas.size} consultas: ${[...chamadas].join(', ')}`)
  for (const removida of ['adminSuccessOverview', 'adminSuccessQueue', 'adminWaDisconnectedUsers']) {
    assert.ok(!inicio.includes(`api.${removida}(`), `${removida} voltou ao Início`)
  }
})

test('as páginas /admin/online e /admin/sucesso-cliente foram apagadas e nada aponta para elas', () => {
  assert.ok(!existsSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url)))
  assert.ok(!existsSync(new URL('../dashboard/app/admin/sucesso-cliente/page.js', import.meta.url)))
  for (const [nome, fonte] of Object.entries({ inicio, receita, operacao })) {
    assert.ok(!/href="\/admin\/(online|sucesso-cliente)"/.test(fonte), `${nome} ainda linka para página apagada`)
  }
})
