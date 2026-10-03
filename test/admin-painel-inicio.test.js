import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CARD_HELP } from '../dashboard/lib/admin/cardHelp.js'

const painel = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
// O card do robô do Telegram foi para a página Operação (G2 da auditoria).
const operacao = readFileSync(new URL('../dashboard/app/admin/operacao/page.js', import.meta.url), 'utf8')

test('as abas Online e Sucesso do Cliente não voltam para o Início', () => {
  // G2 (corte final do Início): a fila de atendimento virou a caixa /admin/hoje
  // e o detalhe de conexão virou a seção Robô da ficha do cliente.
  assert.doesNotMatch(painel, /\['online', 'Online'\]/)
  assert.doesNotMatch(painel, /\['sucesso', 'Sucesso do Cliente'\]/)
  assert.doesNotMatch(painel, /tab === 'sucesso'/)
  assert.doesNotMatch(painel, /api\.adminSuccessOverview\(|api\.adminSuccessQueue\(|api\.adminWaDisconnectedUsers\(/)
  assert.doesNotMatch(painel, /function (OnlineDetailDrawer|WhatsAppDisconnectedTable|DetailPanel|ManualAccessEditor)\(/)
})

test('os cards do semáforo que têm lista levam à caixa Hoje; o resto não finge ser clicável', () => {
  assert.match(painel, /router\.push\('\/admin\/hoje\?motivo=robo'\)/)
  assert.match(painel, /router\.push\('\/admin\/hoje\?motivo=cega'\)/)
  assert.match(painel, /router\.push\('\/admin\/erros'\)/)
  assert.doesNotMatch(painel, /openScenario|openWaStatus|openErrorsDrilldown/)
})

test('os cards técnicos abrem o detalhe do que está pendente', () => {
  assert.match(painel, /setTechDrilldown\('infra'\)/)
  assert.match(painel, /setTechDrilldown\('filas'\)/)
  assert.match(painel, /function TechDrilldownModal/)
})

test('todo card do painel tem explicação atrás do "?"', () => {
  const usados = [...(painel + operacao).matchAll(/CARD_HELP\.(\w+)/g)].map(match => match[1])
  const esperados = Object.keys(CARD_HELP)
  for (const chave of esperados) {
    assert.ok(usados.includes(chave), `card sem ajuda ligada na tela: ${chave}`)
  }
})

test('a explicação responde às três perguntas, em linguagem leiga', () => {
  const proibido = /\bDLQ\b|worker|socket|Baileys|endpoint|payload/i
  for (const [chave, ajuda] of Object.entries(CARD_HELP)) {
    assert.ok(ajuda.title, `${chave} sem título`)
    assert.ok(ajuda.oQueE, `${chave} não diz o que é`)
    assert.ok(ajuda.impacto, `${chave} não diz qual o impacto`)
    assert.ok(ajuda.comoResolver, `${chave} não diz como resolver`)
    for (const campo of ['title', 'oQueE', 'impacto', 'comoResolver']) {
      assert.doesNotMatch(ajuda[campo], proibido, `${chave}.${campo} com jargão`)
    }
  }
})

test('a ficha do cliente mostra POR QUE caiu, não só o código', () => {
  const ficha = readFileSync(new URL('../dashboard/app/admin/clientes/[id]/page.js', import.meta.url), 'utf8')
  assert.match(ficha, /Por que caiu/)
  assert.match(ficha, /detail\?\.disconnectReason/)
  const rota = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const detalhe = rota.slice(rota.indexOf('async function buildAdminOnlineUserDetail'), rota.indexOf('async function isRunningSafe'))
  assert.match(detalhe, /disconnectReason/)
  assert.match(detalhe, /canAdminRetry: Boolean\(ownership\.canAdminRetry\)/)
})

test('a tag de pagante aparece nas tabelas de cliente do painel', () => {
  const ocorrencias = painel.match(/<PayingTag/g) ?? []
  assert.ok(ocorrencias.length >= 1, `esperava a tag na Gestão de clientes, achei ${ocorrencias.length}`)
})

// --- Funil em pipeline (2026-09-05) ---

const funilPage = readFileSync(new URL('../dashboard/app/admin/funil/page.js', import.meta.url), 'utf8')

test('o funil é desenhado como jornada em colunas, não como lista de blocos', () => {
  assert.match(funilPage, /function Pipeline/)
  assert.match(funilPage, /A jornada, passo a passo/)
  // Colunas lado a lado com a perda entre elas.
  assert.match(funilPage, /lostFromPrevious/)
  assert.match(funilPage, /Passo \{step\.position/)
})

test('a lista antiga continua acessível, recolhida', () => {
  assert.match(funilPage, /Ver a mesma coisa em lista/)
})
