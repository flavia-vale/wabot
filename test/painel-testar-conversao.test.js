/* Guarda da tela "Testar conversão" (2026-09-19).
 *
 * O que estes testes travam é a LEITURA HONESTA do resultado. A tela existe
 * para responder "o link está saindo com a minha identificação?" — e as duas
 * formas de errar essa resposta mandam a cliente mexer na coisa errada:
 *
 * 1. chamar de "credencial" o que é link fora do teste ou demora da loja;
 * 2. pintar de verde uma conversão que saiu pelo plano B com o código de
 *    acesso vencido.
 *
 * Trava também que a ressalva não pode dizer que a comissão se perdeu (no
 * plano B do ML e da Amazon ela continua sendo da cliente).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  VEREDITO,
  describeConversionRequestFailure,
  describeConversionTest,
} from '../src/domain/painel/conversionTest.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const page = read('../dashboard/app/painel/converte-links/page.js')
const nav = read('../dashboard/app/painel/nav.js')
const css = read('../dashboard/app/painel/painel.css')

test('conversão limpa é o único "tudo certo"', () => {
  const v = describeConversionTest({ status: 'converted', label: 'Mercado Livre', warning: null })
  assert.equal(v.veredito, VEREDITO.OK)
  assert.equal(v.mostrarCredenciais, false)
  assert.match(v.texto, /Mercado Livre/)
})

test('link que já é da própria afiliada tem veredito e mensagem próprios', () => {
  const v = describeConversionTest({ status: 'already_own_link', label: 'Amazon' })
  assert.equal(v.veredito, VEREDITO.PROPRIO)
  assert.equal(v.mostrarCredenciais, false)
  assert.match(v.titulo, /já é seu link de afiliado/i)
})

test('código de acesso vencido NÃO é verde — o link saiu, mas há o que fazer', () => {
  // ML e Amazon publicam pelo plano B com o código vencido. Verde aqui
  // esconderia exatamente o que a tela foi feita para mostrar.
  for (const aviso of ['ml_ssid_expired', 'amazon_cookies_expired']) {
    const v = describeConversionTest({ status: 'converted', label: 'Amazon', warning: aviso })
    assert.equal(v.veredito, VEREDITO.RESSALVA, aviso)
    assert.equal(v.mostrarCredenciais, true, `${aviso} precisa levar ao cadastro`)
  }
})

test('a ressalva do código vencido NUNCA diz que a comissão se perdeu', () => {
  // AGENTS.md: "não voltar a dizer que o envio está pausado quando o código
  // vence" — o plano B continua publicando e a comissão continua dela.
  for (const aviso of ['ml_ssid_expired', 'amazon_cookies_expired']) {
    const v = describeConversionTest({ status: 'converted', label: 'Amazon', warning: aviso })
    assert.match(v.texto, /comissão continua sua/i, aviso)
    assert.doesNotMatch(v.texto, /sem o seu código|não est(á|a) saindo|pausad|perde/i, aviso)
  }
})

test('limite passageiro do ML não manda mexer no cadastro', () => {
  for (const aviso of ['ml_affiliate_rate_limited', 'ml_affiliate_busy']) {
    const v = describeConversionTest({ status: 'converted', label: 'Mercado Livre', warning: aviso })
    assert.equal(v.veredito, VEREDITO.RESSALVA, aviso)
    assert.equal(v.mostrarCredenciais, false, `${aviso} não é problema de credencial`)
  }
})

test('endereço recusado pelo ML é a ÚNICA ressalva que não promete comissão', () => {
  // RCA 2026-08-15: partner_id pendurado em endereço recusado não credita.
  const v = describeConversionTest({ status: 'converted', label: 'Mercado Livre', warning: 'ml_url_not_supported' })
  assert.equal(v.veredito, VEREDITO.RESSALVA)
  assert.match(v.texto, /pode não ser creditada/i)
  assert.doesNotMatch(v.texto, /comissão continua sua/i)
})

test('aviso ainda não mapeado não vira alarme nem "tudo certo" em silêncio', () => {
  const v = describeConversionTest({ status: 'converted', label: 'Shopee', warning: 'algo_novo_da_loja' })
  assert.equal(v.veredito, VEREDITO.RESSALVA)
  assert.equal(v.mostrarCredenciais, false)
  assert.equal(v.avisoTecnico, 'algo_novo_da_loja')
})

test('falta de cadastro é o caso que leva ao cadastro', () => {
  const v = describeConversionTest({ status: 'error', code: 'MISSING_CREDENTIALS', label: 'Shopee', error: 'faltam dados' })
  assert.equal(v.veredito, VEREDITO.CREDENCIAL)
  assert.equal(v.mostrarCredenciais, true)
})

test('link fora do teste e demora da loja NÃO são chamados de credencial', () => {
  const linkRuim = describeConversionTest({ status: 'error', code: 'CONVERSION_FAILED', error: 'Link não suportado' })
  assert.equal(linkRuim.veredito, VEREDITO.LINK)
  assert.equal(linkRuim.mostrarCredenciais, false)

  const demora = describeConversionTest({ status: 'error', code: 'CONVERSION_FAILED', error: 'Tempo limite de conversão excedido' })
  assert.equal(demora.veredito, VEREDITO.TEMPORARIO)
  assert.equal(demora.mostrarCredenciais, false)
})

test('falha da própria chamada é classificada pelo código da rota', () => {
  assert.equal(describeConversionRequestFailure({ code: 'LINK_CONVERSION_NO_LINKS' }).veredito, VEREDITO.LINK)
  assert.equal(describeConversionRequestFailure({ code: 'LINK_CONVERSION_LIMIT_EXCEEDED' }).veredito, VEREDITO.LINK)
  assert.equal(describeConversionRequestFailure({ code: 'LINK_CONVERSION_RATE_LIMITED' }).veredito, VEREDITO.TEMPORARIO)
  // Nenhuma delas pode empurrar a cliente para o cadastro.
  for (const code of ['LINK_CONVERSION_NO_LINKS', 'LINK_CONVERSION_LIMIT_EXCEEDED', 'LINK_CONVERSION_RATE_LIMITED']) {
    assert.equal(describeConversionRequestFailure({ code }).mostrarCredenciais, false, code)
  }
})

test('a tela não decide o veredito sozinha — ela consome a regra', () => {
  assert.ok(page.includes('describeConversionTest'), 'a tela precisa usar a regra pura')
  assert.ok(page.includes('describeConversionRequestFailure'), 'a falha de chamada também passa pela regra')
  // Texto de veredito na tela faria painel e regra discordarem sobre o mesmo
  // resultado — mesmo motivo de o texto da assinatura morar no backend.
  assert.doesNotMatch(page, /Credenciais (válidas|inválidas)/i, 'veredito escrito na tela')
})

test('a detecção da loja reusa o detector do robô, sem cópia da lista', () => {
  // A cópia que vivia aqui já divergiu uma vez (T071) e fazia a tela dizer
  // "não suportado" para link que o espelhamento convertia.
  assert.ok(page.includes('detectLinks'), 'a tela precisa usar detectLinks')
  assert.doesNotMatch(page, /mercadolivre\\\.com\\\.br\|/, 'regex de lojas duplicada voltou para a tela')
  assert.doesNotMatch(page, /SUPPORTED_LINK_RE/, 'lista de endereços duplicada voltou para a tela')
})

test('a tela tem duas colunas: o link e o resultado', () => {
  const jsx = page.slice(page.indexOf('return ('))
  const form = jsx.indexOf('tc-form')
  const resultado = jsx.indexOf('tc-resultado')
  assert.ok(form > -1 && resultado > -1)
  assert.ok(form < resultado, 'o campo do link vem antes do resultado')
  assert.ok(/\.tc-cols\s*\{[^}]*grid-template-columns:\s*minmax/.test(css), 'faltam as duas colunas no CSS')
  assert.ok(/@media \(max-width: 900px\)[^@]*\.tc-cols\s*\{[^}]*grid-template-columns:\s*1fr/.test(css), 'no celular precisa virar uma coluna')
})

test('"Testar conversão" está na sidebar, em Configuração', () => {
  assert.ok(nav.includes("label: 'Testar conversão'"), 'item sumiu da sidebar')
  assert.ok(nav.includes("href: '/painel/converte-links'"), 'caminho errado')
  const credenciais = nav.indexOf("label: 'Minhas credenciais'")
  const testar = nav.indexOf("label: 'Testar conversão'")
  const conta = nav.indexOf("title: 'Conta'")
  assert.ok(credenciais > -1 && testar > credenciais, 'deve vir depois de Minhas credenciais')
  assert.ok(testar < conta, 'deve ficar no grupo Configuração, não em Conta')
})

test('linguagem leiga: nada de jargão na tela', () => {
  for (const jargao of ['payload', 'endpoint', 'API', 'token', 'cookie', 'scrape', 'SSID']) {
    assert.ok(!page.includes(jargao), `jargão "${jargao}" chegou à tela`)
  }
})
