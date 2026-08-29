import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { WATERMARK_MAX_CHARS, WATERMARK_COLORS, normalizeWatermarkConfig } from '../src/core/destinationWatermark.js'

// O limite de caracteres da marca vive em TRÊS lugares que não podem divergir:
// o renderizador (fonte da verdade), a validação da API e o campo da tela. A
// API não pode importar o renderizador — ele carrega `sharp` (binário nativo) e
// a API o mantém fora do processo de propósito (mesmo motivo do lazy load em
// src/api/routes/linkConversion.js, política de memória do AGENTS.md). Como o
// número é copiado, este teste é quem impede a divergência.

test('o limite do produto é 25 caracteres', () => {
  assert.equal(WATERMARK_MAX_CHARS, 25)
  assert.doesNotThrow(() => normalizeWatermarkConfig({ text: 'a'.repeat(25) }))
  assert.throws(() => normalizeWatermarkConfig({ text: 'a'.repeat(26) }), /25 caracteres/)
})

test('a API valida com o MESMO limite do renderizador', () => {
  const rota = readFileSync(new URL('../src/api/routes/groups.js', import.meta.url), 'utf8')
  assert.match(
    rota,
    new RegExp(`\\[\\.\\.\\.normalizedWatermarkText\\]\\.length > ${WATERMARK_MAX_CHARS}\\b`),
    `a rota precisa recusar acima de ${WATERMARK_MAX_CHARS} caracteres`,
  )
  assert.match(rota, new RegExp(`no máximo ${WATERMARK_MAX_CHARS} caracteres`))
  // Guarda da política de memória: a rota NÃO pode importar o renderizador.
  assert.doesNotMatch(rota, /from '\.\.\/\.\.\/core\/destinationWatermark\.js'/)
})

test('a tela usa o MESMO limite do renderizador', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  assert.match(page, new RegExp(`maxLength=\\{${WATERMARK_MAX_CHARS}\\}`))
  assert.match(page, new RegExp(`slice\\(0, ${WATERMARK_MAX_CHARS}\\)`))
  assert.match(page, new RegExp(`/${WATERMARK_MAX_CHARS} caracteres`))
})

// Formato pedido pela dona do produto (2026-08-29): centralizada, 50% de
// transparência, cor escolhida pela cliente entre branco e preto.
test('o padrão é centralizado, 50% de transparência e branco', () => {
  const cfg = normalizeWatermarkConfig({ text: 'Achadinhos da Maria' })
  assert.equal(cfg.position, 'center')
  assert.equal(cfg.opacity, 0.5)
  assert.equal(cfg.color, 'white')
})

test('a cliente escolhe entre branco e preto — e só isso', () => {
  assert.deepEqual(Object.keys(WATERMARK_COLORS).sort(), ['black', 'white'])
  assert.equal(normalizeWatermarkConfig({ text: 'x', color: 'black' }).color, 'black')
})

test('cor desconhecida cai no padrão em vez de derrubar a oferta', () => {
  // A marca é enfeite. Perder a oferta inteira por causa de um valor legado ou
  // corrompido no banco seria muito pior do que sair com a cor padrão.
  for (const invalida of ['roxo', '', null, undefined, 123]) {
    assert.equal(normalizeWatermarkConfig({ text: 'x', color: invalida }).color, 'white')
  }
})

test('a tela oferece a escolha de cor apenas no modo com marca', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  const start = page.indexOf('Cor da marca d&apos;água')
  assert.notEqual(start, -1, 'seletor de cor não encontrado na tela')
  const bloco = page.slice(Math.max(0, start - 400), start + 700)
  assert.match(bloco, /watermarkMode &&/, 'o seletor de cor só aparece quando a marca está ligada')
  assert.match(bloco, /value="white"[\s\S]*?value="black"/)
})
