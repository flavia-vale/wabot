import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { WATERMARK_MAX_CHARS, WATERMARK_COLORS, normalizeWatermarkConfig } from '../src/core/destinationWatermark.js'
import { WATERMARK_INPUT_MAX_CHARS, WATERMARK_INPUT_COLORS, isWatermarkTextTooLong } from '../src/core/watermarkInput.js'

// O limite de caracteres da marca vive em TRÊS lugares que não podem divergir:
// o renderizador (fonte da verdade), a validação da API (core/watermarkInput.js)
// e o campo da tela. A API não pode importar o renderizador — ele carrega
// `sharp` (binário nativo) e a API o mantém fora do processo de propósito
// (mesmo motivo do lazy load em src/api/routes/linkConversion.js, política de
// memória do AGENTS.md). Como o número é copiado, este teste é quem impede a
// divergência.

test('o limite do produto é 25 caracteres', () => {
  assert.equal(WATERMARK_MAX_CHARS, 25)
  assert.doesNotThrow(() => normalizeWatermarkConfig({ text: 'a'.repeat(25) }))
  assert.throws(() => normalizeWatermarkConfig({ text: 'a'.repeat(26) }), /25 caracteres/)
})

// A marca d'água passou a existir em TRÊS telas (destino de espelhamento, fila
// de ofertas e ofertas automáticas). Em vez de cada rota copiar o número por
// conta própria, a API tem um lugar único — core/watermarkInput.js — e é ele
// que precisa bater com o renderizador.
test('a API valida com o MESMO limite e as MESMAS cores do renderizador', () => {
  assert.equal(WATERMARK_INPUT_MAX_CHARS, WATERMARK_MAX_CHARS)
  assert.deepEqual([...WATERMARK_INPUT_COLORS].sort(), Object.keys(WATERMARK_COLORS).sort())
  assert.equal(isWatermarkTextTooLong('a'.repeat(WATERMARK_MAX_CHARS)), false)
  assert.equal(isWatermarkTextTooLong('a'.repeat(WATERMARK_MAX_CHARS + 1)), true)
})

test('as três rotas com marca validam pelo lugar único, e nenhuma carrega o renderizador', () => {
  const rotas = ['groups.js', 'offerQueue.js', 'offerAutomation.js']
  for (const arquivo of rotas) {
    const rota = readFileSync(new URL(`../src/api/routes/${arquivo}`, import.meta.url), 'utf8')
    assert.match(rota, /from '\.\.\/\.\.\/core\/watermarkInput\.js'/, `${arquivo} precisa validar pelo lugar único`)
    assert.match(rota, new RegExp(`no máximo ${WATERMARK_MAX_CHARS} caracteres`), `${arquivo} precisa dizer o limite à cliente`)
    // Guarda da política de memória: rota NÃO pode importar o renderizador
    // (ele carrega `sharp`, binário nativo, que a API mantém fora do processo).
    assert.doesNotMatch(rota, /from '\.\.\/\.\.\/core\/destinationWatermark\.js'/, `${arquivo} não pode carregar o renderizador`)
  }
})

// O módulo de validação da API é puro de propósito — se ele passar a importar
// o renderizador, `sharp` entra no processo da API pela porta dos fundos.
test('o lugar único de validação da API não carrega o renderizador', () => {
  const modulo = readFileSync(new URL('../src/core/watermarkInput.js', import.meta.url), 'utf8')
  assert.doesNotMatch(modulo, /^\s*import .*(destinationWatermark|sharp)/m)
})

test('a tela usa o MESMO limite do renderizador', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  // A tela declara o limite UMA vez, numa constante, e o campo o consome por
  // prop. Conferir a constante (em vez de caçar o número literal espalhado)
  // continua pegando a divergência e não quebra quando o campo é refatorado.
  assert.match(
    page,
    new RegExp(`const WATERMARK_TEXT_MAX_CHARS = ${WATERMARK_MAX_CHARS}\\b`),
    `a tela precisa declarar o limite como ${WATERMARK_MAX_CHARS}, igual ao renderizador`,
  )
  assert.match(page, /maxLength=\{maxChars\}/, 'o campo precisa consumir o limite por prop, sem número solto')
  assert.match(page, /\[\.\.\.e\.target\.value\]\.slice\(0, maxChars\)/)
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
