// RCA 2026-09-19 — cliente julianepumuceno16@gmail.com: ofertas do "Criar
// oferta" chegaram ao grupo com "🛒 Por {preço}" cru e com a decoração vazia
// "~De: ~ |". Guarda para os dois sintomas e para o aviso que faltava no painel.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMobileOfferText, applyTemplateVariables, OFFER_TEMPLATE_VARIABLES } from '../dashboard/lib/mobileOfferComposer.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Template real da cliente (reduzido ao que importa): preço antigo e preço
// atual na MESMA linha, separados por "|", com o preço antigo tachado.
const TEMPLATE_DA_CLIENTE = [
  '☀️ {produto}',
  '',
  '~De: {preço_de} ~ | 🛒 Por {preço}',
  '',
  '🔗 COMPRE AQUI: {link}',
].join('\n')

function montar(product) {
  return buildMobileOfferText({
    product: { title: 'Cadeira Para Auto 0-36 Kg', ...product },
    link: 'https://link.amazon/B0f1yTPNT',
    templateBody: TEMPLATE_DA_CLIENTE,
  })
}

test('nenhuma variável de oferta vaza como texto cru quando o valor falta', () => {
  const corpo = OFFER_TEMPLATE_VARIABLES
    .filter((v) => !v.token.startsWith('{{'))
    .map((v) => `linha ${v.token}`)
    .join('\n')
  const texto = applyTemplateVariables(corpo, {})
  for (const { token } of OFFER_TEMPLATE_VARIABLES) {
    assert.ok(!texto.includes(token), `token vazou na mensagem: ${token}`)
  }
})

test('sem preço, a linha de preço some inteira em vez de sair "Por {preço}"', () => {
  const texto = montar({})
  assert.ok(!texto.includes('{preço}'), 'placeholder de preço chegou ao grupo')
  assert.ok(!texto.includes('{preço_de}'))
  assert.ok(!/~\s*De:?\s*~/.test(texto), 'sobrou a decoração vazia do preço antigo')
  assert.ok(!/^\s*🛒 Por\s*$/m.test(texto), 'sobrou o rótulo "Por" sem valor')
  assert.match(texto, /🔗 COMPRE AQUI: https:\/\/link\.amazon\//)
  assert.match(texto, /☀️ Cadeira Para Auto/)
})

test('com preço e sem preço antigo, o preço fica e a decoração vazia some', () => {
  const texto = montar({ price: 'R$ 502,55' })
  assert.match(texto, /🛒 Por R\$ 502,55/)
  assert.ok(!/~\s*De:?\s*~/.test(texto), 'sobrou "~De: ~"')
  assert.ok(!/^\s*\|/m.test(texto), 'sobrou o separador "|" órfão')
})

test('com os dois preços, a linha sai completa como a cliente escreveu', () => {
  const texto = montar({ price: 'R$ 502,55', oldPrice: 'R$ 700,00' })
  assert.match(texto, /~De: R\$ 700,00 ~ \| 🛒 Por R\$ 502,55/)
})

test('título com "|" no meio não é partido pela limpeza', () => {
  const texto = buildMobileOfferText({
    product: { title: 'Berço Portátil | 6 em 1', price: 'R$ 399,00' },
    link: 'https://link.amazon/B01ldv',
    templateBody: '{produto}\n~De: {preço_de} ~ | Por {preço}',
  })
  assert.match(texto, /Berço Portátil \| 6 em 1/)
  assert.match(texto, /Por R\$ 399,00/)
})

test('painel avisa quando o preço não foi lido, mesmo com o título lido', () => {
  const page = fs.readFileSync(path.join(rootDir, 'dashboard/app/painel/criar-oferta/page.js'), 'utf8')
  assert.ok(
    /generated && !generated\.newPrice/.test(page),
    'o painel precisa avisar quando só o preço faltou — era esse o caso silencioso do RCA',
  )
  assert.ok(/sem preço/.test(page), 'o aviso precisa dizer que a oferta sai sem preço')
})
