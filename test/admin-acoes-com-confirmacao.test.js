import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/*
 * Auditoria do admin (docs/admin/auditoria-painel-admin.md, Q4): cinco ações
 * que mexem na conta da cliente, em pagamento ou em dinheiro saíam sem
 * nenhuma confirmação. Este teste trava que cada handler pergunta antes.
 */

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

function corpoDaFuncao(fonte, assinatura) {
  const inicio = fonte.indexOf(assinatura)
  assert.ok(inicio >= 0, `não achei ${assinatura}`)
  return fonte.slice(inicio, fonte.indexOf('\n  }\n', inicio))
}

const CASOS = [
  ['dashboard/app/admin/clientes/[id]/page.js', 'async function reconnect(id)', 'adminOnlineReconnect'],
  ['dashboard/app/admin/hoje/page.js', 'async function reconectar(item)', 'adminOnlineReconnect'],
  ['dashboard/app/admin/clientes/[id]/page.js', 'async function submit(e)', 'adminUpdateAccess'],
  ['dashboard/components/SaudeSection.js', 'async function runReprocess()', 'adminPaymentDlqReprocess'],
  ['dashboard/app/admin/afiliados/page.js', 'async function handleMarkAllPaid()', 'adminAffiliateCycleMarkAllPaid'],
  ['dashboard/components/AdminContato.js', 'async function enviarIndividual()', 'adminWhatsappSend('],
]

for (const [arquivo, assinatura, chamada] of CASOS) {
  test(`${arquivo}: ${assinatura} confirma ANTES de chamar ${chamada}`, () => {
    const corpo = corpoDaFuncao(read(arquivo), assinatura)
    const posConfirm = corpo.indexOf('window.confirm(')
    const posChamada = corpo.indexOf(chamada)
    assert.ok(posConfirm >= 0, 'sem window.confirm')
    assert.ok(posChamada > posConfirm, 'a chamada à API vem antes da confirmação')
    assert.match(corpo.slice(0, posChamada), /if \(!window\.confirm\(/, 'a confirmação precisa interromper quando a dona cancela')
  })
}

test('pagar elegíveis do mês diz QUANTAS e QUANTO antes de sair dinheiro', () => {
  const corpo = corpoDaFuncao(read('dashboard/app/admin/afiliados/page.js'), 'async function handleMarkAllPaid()')
  assert.match(corpo, /pagaveis\.length/)
  assert.match(corpo, /formatCurrency\(total\)/)
  assert.match(corpo, /\['eligible', 'approved'\]/, 'mesmos status pagáveis do backend (COMMISSION_PAYABLE_STATUSES)')
})

test('WhatsApp individual diz PARA QUEM vai a mensagem', () => {
  const corpo = corpoDaFuncao(read('dashboard/components/AdminContato.js'), 'async function enviarIndividual()')
  assert.match(corpo, /\$\{quem\}/)
})

test('os textos de confirmação são leigos (sem jargão)', () => {
  for (const [arquivo, assinatura] of CASOS) {
    const corpo = corpoDaFuncao(read(arquivo), assinatura)
    // Só o TEXTO que a dona lê: da abertura do confirm até o fim da linha.
    const inicio = corpo.indexOf('window.confirm(')
    const texto = corpo.slice(inicio, corpo.indexOf('\n', inicio))
    for (const jargao of ['DLQ', 'jid', 'endpoint', 'payload', 'retry']) {
      assert.ok(!texto.includes(jargao), `${arquivo}: "${jargao}" chegou ao texto de confirmação`)
    }
  }
})
