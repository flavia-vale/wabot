import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const componente = readFileSync(new URL('../dashboard/components/OfferAppearanceFields.js', import.meta.url), 'utf8')
const filas = readFileSync(new URL('../dashboard/app/painel/filas/page.js', import.meta.url), 'utf8')
const automaticas = readFileSync(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')

// A escolha aparece nas DUAS telas com as MESMAS palavras: quem escolhe "card
// que abre a loja" na fila precisa reconhecer a mesma coisa nas automáticas.
test('as duas telas usam o mesmo bloco de escolha', () => {
  for (const [nome, page] of [['filas', filas], ['ofertas automáticas', automaticas]]) {
    assert.match(page, /OfferAppearanceFields/, `a tela de ${nome} precisa oferecer a escolha`)
    assert.match(page, /from '@\/components\/OfferAppearanceFields'/, `a tela de ${nome} não pode copiar o bloco`)
  }
})

test('o bloco oferece os quatro formatos, incluindo o card com marca', () => {
  for (const valor of ['original', 'original_watermark', 'preview', 'preview_watermark']) {
    assert.match(componente, new RegExp(`value: '${valor}'`), `falta o formato ${valor}`)
  }
})

// Linguagem leiga (AGENTS.md): a tela diz o que ACONTECE, nunca o nome técnico
// do campo nem jargão de quem programa.
test('a tela não mostra jargão', () => {
  // Só o que a cliente LÊ: rótulos e explicações das quatro opções. O nome
  // interno do campo pode existir no código; o que não pode é chegar à tela.
  const copyVisivel = [...componente.matchAll(/label: '([^']+)', hint: '([^']+)'/g)]
    .flatMap((m) => [m[1], m[2]])
    .join(' | ')
  assert.equal(copyVisivel.split(' | ').length, 8, 'esperados rótulo e explicação para os quatro formatos')
  for (const jargao of ['thumbnail', 'card de preview', 'imagemode', 'watermark', 'preview clic']) {
    assert.doesNotMatch(copyVisivel, new RegExp(jargao, 'i'), `a cliente não pode ler "${jargao}"`)
  }
  // O texto explica o efeito, não o mecanismo.
  assert.match(copyVisivel, /abre a página da oferta/)
  assert.match(copyVisivel, /só amplia a foto/)
})

// A escolha da fila é POR FILA; a das automáticas é UMA para a conta toda.
test('a fila escolhe por fila e as automáticas escolhem uma vez para a conta', () => {
  assert.match(filas, /idPrefix="queue"/)
  assert.match(filas, /value=\{form\}/, 'a escolha da fila vive no formulário da própria fila')

  assert.match(automaticas, /idPrefix="automations"/)
  assert.match(automaticas, /offerAutomationsAppearanceUpdate/)
  // Nenhum campo de aparência pode entrar no formulário de UMA automação —
  // seria a escolha por automação, o oposto do combinado.
  const formStart = automaticas.indexOf('const emptyForm')
  const formEnd = automaticas.indexOf('\n}', formStart)
  assert.doesNotMatch(automaticas.slice(formStart, formEnd), /imageMode|watermark/i)
})

// Formato com marca e texto vazio é recusado pela API. A tela sugere o nome que
// a pessoa já deu, para ela não bater na recusa sem entender o motivo.
test('ligar a marca sem texto sugere o nome que a pessoa já deu', () => {
  assert.match(componente, /nameSuggestion/)
  assert.match(filas, /nameSuggestion=\{form\.name\}/)
})

test('o limite de caracteres da marca é o mesmo do renderizador', () => {
  assert.match(componente, /const WATERMARK_TEXT_MAX_CHARS = 25\b/)
  assert.match(componente, /maxLength=\{WATERMARK_TEXT_MAX_CHARS\}/)
})

// A tela não pode ficar sem carregar porque a aparência falhou de buscar.
test('falha ao ler a aparência não derruba a tela de automáticas', () => {
  assert.match(automaticas, /api\.offerAutomationsAppearance\(\)\.catch\(\(\) => null\)/)
})
