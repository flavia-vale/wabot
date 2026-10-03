import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { FILTROS_MOTIVO, filtrarPorMotivo, contarPorFiltro, filtroPorChave } from '../dashboard/lib/admin/inboxFiltros.js'
import { GRAVIDADE } from '../src/domain/admin/inboxPriority.js'

/*
 * Item 1 de docs/admin/prompts-fatias-restantes.md: o Início perdeu as abas
 * Online e Sucesso do Cliente. O que elas faziam tem destino: filtro por motivo
 * na caixa /admin/hoje e seções Robô/Atendimento na ficha do cliente.
 */

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const ficha = read('dashboard/app/admin/clientes/[id]/page.js')
const hoje = read('dashboard/app/admin/hoje/page.js')

test('filtros por motivo só usam motivos que a caixa realmente produz', () => {
  for (const filtro of FILTROS_MOTIVO) {
    for (const motivo of filtro.motivos) {
      assert.ok(GRAVIDADE[motivo], `${motivo} (filtro ${filtro.chave}) não existe em GRAVIDADE`)
    }
  }
})

test('todo motivo da caixa cai em exatamente um filtro, senão some do filtro', () => {
  const operacionais = ['robo-caido-agora', 'cega-agora']
  for (const motivo of [...Object.keys(GRAVIDADE), ...operacionais]) {
    const donos = FILTROS_MOTIVO.filter(f => f.motivos.includes(motivo))
    assert.equal(donos.length, 1, `${motivo} está em ${donos.length} filtros`)
  }
})

test('filtrarPorMotivo filtra, e chave vazia ou desconhecida mostra tudo', () => {
  const itens = [{ motivo: 'robo-caido-agora' }, { motivo: 'cega-agora' }, { motivo: 'cobranca-recusada' }]
  assert.deepEqual(filtrarPorMotivo(itens, 'robo').map(i => i.motivo), ['robo-caido-agora'])
  assert.deepEqual(filtrarPorMotivo(itens, 'cega').map(i => i.motivo), ['cega-agora'])
  assert.equal(filtrarPorMotivo(itens, '').length, 3)
  assert.equal(filtrarPorMotivo(itens, 'xyz').length, 3)
  assert.equal(filtrarPorMotivo(undefined, 'robo').length, 0)
  assert.equal(filtroPorChave('xyz'), null)
  assert.deepEqual(contarPorFiltro(itens), { robo: 1, cega: 1, cobranca: 1, vencendo: 0, 'sem-envio': 0 })
})

test('a caixa Hoje lê ?motivo= e os cards do semáforo apontam para chaves que existem', () => {
  assert.match(hoje, /URLSearchParams\(window\.location\.search\)\.get\('motivo'\)/)
  const inicio = read('dashboard/app/admin/page.js')
  for (const [, chave] of inicio.matchAll(/hoje\?motivo=([\w-]+)/g)) {
    assert.ok(filtroPorChave(chave), `card aponta para filtro inexistente: ${chave}`)
  }
})

test('as páginas apagadas não têm mais link em lugar nenhum do dashboard', () => {
  assert.ok(!existsSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url)))
  assert.ok(!existsSync(new URL('../dashboard/app/admin/sucesso-cliente/page.js', import.meta.url)))
  for (const rel of ['dashboard/app/admin/page.js', 'dashboard/app/admin/hoje/page.js', 'dashboard/app/admin/clientes/page.js', 'dashboard/app/admin/operacao/page.js', 'dashboard/app/admin/receita/page.js']) {
    assert.ok(!/["'`]\/admin\/(online|sucesso-cliente)\b/.test(read(rel)), `${rel} ainda aponta para tela apagada`)
  }
})

test('a ficha herdou as ações: reconectar, histórico de conexão, registrar contato e ajustar acesso', () => {
  assert.match(ficha, /\['robo', 'Robô'\]/)
  assert.match(ficha, /\['atendimento', 'Atendimento'\]/)
  assert.match(ficha, /api\.adminOnlineUser\(/)
  assert.match(ficha, /api\.adminOnlineReconnect\(/)
  assert.match(ficha, /api\.adminCreateContactLog\(/)
  assert.match(ficha, /api\.adminUpdateAccess\(/)
  assert.match(ficha, /Por que caiu/)
  assert.match(ficha, /Linha do tempo das quedas/)
})

test('a Gestão de clientes do Início abre a ficha em vez de um painel duplicado', () => {
  const inicio = read('dashboard/app/admin/page.js')
  assert.match(inicio, /href=\{`\/admin\/clientes\/\$\{user\?\.id\}`\}/)
  assert.doesNotMatch(inicio, /selectedUser|openUserDetail/)
})

test('a rota de detalhe de conexão devolve o motivo e se o clique de reconectar ajuda', () => {
  const rota = read('src/api/routes/admin.js')
  const detalhe = rota.slice(rota.indexOf('async function buildAdminOnlineUserDetail'), rota.indexOf('async function isRunningSafe'))
  assert.match(detalhe, /describeDisconnectReason\(/)
  assert.match(detalhe, /canAdminRetry: Boolean\(ownership\.canAdminRetry\)/)
})
