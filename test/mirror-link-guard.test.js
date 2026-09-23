import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { decideMirrorConversions, findUnconvertedStoreLinks } from '../src/core/mirrorLinkGuard.js'

// RCA 2026-09-23: no espelhamento, link de loja que não virou link da cliente
// saía no grupo com a comissão do concorrente (794 envios em 3 dias, duas
// contas, todos gravados como sucesso). Regra: se não converteu, não envia.

const nosso = url => ({ platform: 'shopee', url: 'https://s.shopee.com.br/concorrente', converted: url })

test('todos os links convertidos: publica', () => {
  assert.deepEqual(
    decideMirrorConversions([nosso('https://s.shopee.com.br/nosso1'), nosso('https://s.shopee.com.br/nosso2')]),
    { publish: true, errorMsg: null, failedCount: 0 },
  )
})

test('UM link que falhou derruba a mensagem inteira, mesmo com outro convertido', () => {
  const d = decideMirrorConversions([
    nosso('https://s.shopee.com.br/nosso'),
    { platform: 'mercadolivre', url: 'https://meli.la/concorrente', failureReason: 'conversion_failed' },
  ])
  assert.equal(d.publish, false)
  assert.equal(d.failedCount, 1)
  assert.equal(d.errorMsg, 'skip:no_valid_conversions:conversion_failed')
})

test('loja desligada no grupo também não deixa o link de origem sair', () => {
  const d = decideMirrorConversions([
    nosso('https://s.shopee.com.br/nosso'),
    { platform: 'amazon', url: 'https://amzn.to/concorrente', failureReason: 'store_disabled' },
  ])
  assert.equal(d.publish, false)
  assert.equal(d.errorMsg, 'skip:no_valid_conversions:store_disabled')
})

test('passthrough (link original devolvido como convertido) nunca conta como convertido', () => {
  const original = 'https://s.shopee.com.br/concorrente'
  const d = decideMirrorConversions([{ platform: 'shopee', url: original, converted: original, passthrough: true }])
  assert.equal(d.publish, false)
  assert.equal(d.errorMsg, 'skip:no_valid_conversions:conversion_failed')
})

test('sem resultado confiável não publica', () => {
  assert.equal(decideMirrorConversions([]).publish, false)
  assert.equal(decideMirrorConversions(null).publish, false)
  assert.equal(decideMirrorConversions([null]).publish, false)
})

test('texto só com links convertidos (inclusive com formatação do WhatsApp) passa', () => {
  const texto = 'Oferta https://s.shopee.com.br/nosso e *https://meli.la/nosso*'
  assert.deepEqual(findUnconvertedStoreLinks(texto, [
    { converted: 'https://s.shopee.com.br/nosso' },
    { converted: 'https://meli.la/nosso' },
  ]), [])
})

test('link de loja com https que sobrou no texto é acusado', () => {
  const texto = 'Produto https://s.shopee.com.br/nosso cupom https://s.shopee.com.br/concorrente'
  assert.deepEqual(findUnconvertedStoreLinks(texto, [{ converted: 'https://s.shopee.com.br/nosso' }]), [
    'https://s.shopee.com.br/concorrente',
  ])
})

test('link de loja SEM https (que o WhatsApp torna clicável) é acusado', () => {
  const texto = 'Compre: meli.la/2abcDE e s.shopee.com.br/x1Y e amazon.com.br/dp/B0X'
  assert.deepEqual(findUnconvertedStoreLinks(texto, []).sort(), [
    'amazon.com.br/dp/B0X', 'meli.la/2abcDE', 's.shopee.com.br/x1Y',
  ])
})

test('endereço de loja DENTRO do link convertido não é acusado', () => {
  const nossoLink = 'https://www.mercadolivre.com.br/social/nossa?ref=meli.la/abc'
  assert.deepEqual(findUnconvertedStoreLinks(`Veja ${nossoLink}`, [{ converted: nossoLink }]), [])
})

test('link convertido que é passthrough não serve de autorização', () => {
  const original = 'https://amzn.to/concorrente'
  assert.deepEqual(findUnconvertedStoreLinks(`Veja ${original}`, [{ converted: original, passthrough: true }]), [original])
})

test('nome da loja, domínio solto sem caminho e e-mail não são acusados', () => {
  assert.deepEqual(findUnconvertedStoreLinks('Compre na Shopee ou em shopee.com.br. Dúvidas: contato@amazon.com.br', []), [])
})

test('o worker decide com a trava e nunca devolve o link de origem como convertido', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/bot-worker.js', import.meta.url)), 'utf8')
  assert.match(src, /const decision = decideMirrorConversions\(linkResults\)/)
  assert.match(src, /const leakedLinks = findUnconvertedStoreLinks\(finalText, conversions\)/)
  assert.doesNotMatch(src, /passthrough:\s*true/)
  // A trava final roda ANTES do modelo e do texto adicional (que são da
  // cliente), senão o link próprio dela no texto adicional seria barrado.
  const guard = src.indexOf('const leakedLinks = findUnconvertedStoreLinks(finalText, conversions)')
  const footer = src.indexOf('finalText = appendRelayFooter(finalText, monitorGroup?.relayFooterText)')
  const template = src.indexOf('await applyMirrorTemplate(finalText')
  assert.ok(template > 0 && footer > 0, 'âncoras do modelo e do texto adicional precisam existir')
  assert.ok(guard > 0 && guard < template && guard < footer)
})
