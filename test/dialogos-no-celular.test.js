import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'

// RCA 2026-09-05: os balões de ajuda saíam para fora da tela no celular.
//
// Os dois eram largura FIXA (288px e 256px) posicionados de forma ABSOLUTA a
// partir do gatilho — e o gatilho fica no canto direito do card. Numa tela de
// 375px, o balão nascia fora da área visível: dava para ver abrir e não dava
// para ler. Ancoragem por CSS não tem como caber nos dois extremos de uma
// grade sem medir a tela, então no celular os dois viram faixa fixa embaixo.

const helpDot = readFileSync(new URL('../dashboard/components/HelpDot.js', import.meta.url), 'utf8')
const tooltip = readFileSync(new URL('../dashboard/components/Tooltip.js', import.meta.url), 'utf8')

function painelDoBalao(source) {
  // A classe do elemento que ABRE (role dialog/tooltip), não a do gatilho.
  const match = source.match(/role="(?:dialog|tooltip)"[\s\S]{0,400}?className="([^"]+)"/)
  assert.ok(match, 'não achei o painel do balão')
  return match[1]
}

for (const [nome, source] of [['HelpDot', helpDot], ['Tooltip', tooltip]]) {
  test(`${nome}: no celular o balão não pode nascer ancorado no gatilho`, () => {
    const classe = painelDoBalao(source)
    // `fixed` + `inset-x-*` é o que garante que ele fica preso à TELA, com as
    // duas bordas dentro dela, em vez de crescer a partir de um ponto qualquer.
    assert.match(classe, /\bfixed\b/, 'o balão precisa ser fixo na tela no celular')
    assert.match(classe, /\binset-x-\d/, 'o balão precisa ter as duas laterais presas à tela')
    // Largura fixa só a partir de `sm:` — no celular quem manda são as laterais.
    assert.doesNotMatch(classe, /(^|\s)w-\d+/, 'largura fixa no celular volta a estourar a tela')
    assert.match(classe, /\bsm:/, 'faltou o comportamento de computador')
  })

  test(`${nome}: o balão continua legível quando o texto é longo`, () => {
    const classe = painelDoBalao(source)
    // No computador o balão é estreito: sem teto de largura ele encosta na
    // borda em tela pequena de notebook.
    assert.match(classe, /sm:(w-\d+|max-w-)/)
  })
}

test('o balão de ajuda do admin fecha ao tocar fora e tem fundo próprio', () => {
  // Sem o fundo, no celular a gaveta aparece "solta" por cima do conteúdo e a
  // pessoa não percebe que precisa tocar fora para fechar.
  assert.match(helpDot, /fixed inset-0[^"]*bg-slate-950/)
  assert.match(helpDot, /setOpen\(false\)/)
})

test('nenhuma tabela larga do admin fica sem rolagem horizontal', () => {
  // Tabela com largura mínima dentro de um diálogo é o outro jeito de o
  // conteúdo sumir para a direita — só que esse tem conserto conhecido:
  // embrulhar em `overflow-x-auto`.
  const base = new URL('../dashboard/app/admin/', import.meta.url)
  const arquivos = []
  const varrer = (dir) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const filho = new URL(`${item.name}${item.isDirectory() ? '/' : ''}`, dir)
      if (item.isDirectory()) varrer(filho)
      else if (item.name.endsWith('.js')) arquivos.push(filho)
    }
  }
  varrer(base)

  for (const arquivo of arquivos) {
    const source = readFileSync(arquivo, 'utf8')
    for (const match of source.matchAll(/min-w-\[(\d+)px\]/g)) {
      const antes = source.slice(Math.max(0, match.index - 400), match.index)
      const soNoComputador = source.slice(Math.max(0, match.index - 4), match.index).includes('lg:')
        || source.slice(Math.max(0, match.index - 4), match.index).includes('sm:')
      if (soNoComputador) continue
      assert.ok(
        antes.includes('overflow-x-auto') || antes.includes('overflow-auto'),
        `${arquivo.pathname} tem min-w-[${match[1]}px] sem rolagem horizontal por perto`,
      )
    }
  }
})
