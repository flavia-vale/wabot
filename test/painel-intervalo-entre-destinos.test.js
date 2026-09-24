// User Story 4 (specs/018-unificar-protecao-anti-ban): o campo "Intervalo
// entre destinos" mora em "Ajustes da conta" (não em "Ritmo por grupo"), com
// a frase certa, faixa 0-600s e sem termo técnico.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const contaPart = readFileSync(new URL('../dashboard/app/painel/anti-banimento/ContaPart.js', import.meta.url), 'utf8')
const form = readFileSync(new URL('../dashboard/components/preservacao/ChannelStaggerForm.js', import.meta.url), 'utf8')
const ritmoPart = readFileSync(new URL('../dashboard/app/painel/anti-banimento/RitmoPart.js', import.meta.url), 'utf8')

test('o campo aparece em "Ajustes da conta" (ContaPart), não em "Ritmo por grupo" (RitmoPart)', () => {
  assert.match(contaPart, /ChannelStaggerForm/)
  assert.doesNotMatch(ritmoPart, /ChannelStaggerForm/)
})

test('a frase é "Esperar X segundos entre enviar para um grupo ou canal e enviar para o próximo"', () => {
  assert.match(form, /Esperar X segundos entre enviar para um grupo ou canal e enviar para o pr[óo]ximo/)
})

test('a dica cita grupos E canais, diferencia do intervalo dentro do mesmo grupo, e avisa sobre demora com muitos grupos', () => {
  assert.match(form, /Vale para grupos e canais/)
  assert.match(form, /diferente do tempo entre uma oferta e\s+outra no mesmo grupo/)
  assert.match(form, /a oferta leva mais tempo\s+para chegar ao último/)
})

test('faixa 0-600 segundos; 0 é aceito e mostra "sem espera extra"', () => {
  assert.match(form, /min=\{MIN_SEC\}/)
  assert.match(form, /max=\{MAX_SEC\}/)
  assert.match(form, /MIN_SEC = 0/)
  assert.match(form, /MAX_SEC = 600/)
  assert.match(form, /0 = sem espera extra/)
})

test('valor fora da faixa mostra a frase com a faixa permitida e não grava (não chama onChange)', () => {
  assert.match(form, /Use um valor entre \{MIN_SEC\} e \{MAX_SEC\} segundos/)
  assert.match(form, /Nada foi salvo com o valor fora da faixa/)
  // A função que decide se grava (handleChange) só chama onChange DENTRO da
  // faixa — fora dela, faz "return" antes de onChange.
  const handleChangeBody = form.slice(form.indexOf('function handleChange'), form.indexOf('function handleChange') + 400)
  assert.match(handleChangeBody, /return \/\/ fora da faixa: nada é gravado/)
})

test('nenhum termo técnico ("jitter", "stagger", "atraso entre canais") aparece no texto visível', () => {
  const semComentarios = form
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/^[ \t]*(import|export)\b.*$/gm, ' ')
  const jsxText = [...semComentarios.matchAll(/>([^<>{}]*)</g)].map((m) => m[1])
  const quoted = [...semComentarios.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)].map((m) => m[1] || m[2])
  const textos = [...jsxText, ...quoted].join(' | ')
  for (const termo of [/\bjitter\b/i, /\bstagger\b/i, /atraso entre canais/i]) {
    assert.doesNotMatch(textos, termo)
  }
})
