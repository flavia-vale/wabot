// Escala de fontes do painel (2026-09-23). A usuária viu fontes maiores e
// menores que o padrão na aba Mensagens: título de 27–39px e textos de 9–10px
// num painel cuja escala é 19px (título da página, no cabeçalho), 15px
// (seção), 13px (card e corpo) e 10,5–12,5px (notas e etiquetas).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

function sizes(css) {
  return [...css.matchAll(/font-size:\s*([^;}]+)/g)].map(m => m[1].trim())
}

test('Mensagens: nada acima de 19px nem abaixo de 10px, e sem clamp', () => {
  const css = read('dashboard/app/painel/mensagens/mensagens.module.css')
  for (const size of sizes(css)) {
    assert.doesNotMatch(size, /clamp|vw|rem/, `tamanho fora da escala: ${size}`)
    const px = Number.parseFloat(size)
    assert.ok(px >= 10 && px <= 19, `tamanho fora da escala: ${size}`)
  }
})

test('blocos do PRO seguem a escala: títulos de 15px, textos de 12,5–13px', () => {
  const css = read('dashboard/app/painel/painel.css')
  const pro = css.slice(css.indexOf('Divisão Basic/PRO (2026-09-23)'))
  assert.match(pro, /\.pnl-pro-head h2 \{ font-size: 15px;/)
  assert.match(pro, /\.pnl-pro-modal-title-row h3 \{ font-size: 15px;/)
  for (const size of sizes(pro)) {
    const px = Number.parseFloat(size)
    assert.ok(px <= 15 || px === 30 || px === 22, `tamanho fora da escala no bloco PRO: ${size}`)
  }
})
