import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/* Relato da cliente (2026-09-20): "quando clico em adicionar canal a janela de
 * canal abre atrás da outra e não consigo vê-la."
 *
 * Causa: o painel tem escala PRÓPRIA de sobreposição em `painel.css` (gaveta
 * 90, janela "Adicionar" 80) e os diálogos compartilhados nasciam com o `z-50`
 * do Tailwind — ABAIXO das duas camadas que os abrem. A janela aparecia atrás,
 * escurecida pelo véu da de cima, e o toque caía no véu.
 *
 * Reproduzido em navegador a 375×667 com o CSS real: com `z-50` o elemento no
 * centro da tela era o véu da janela "Adicionar grupo"; com a camada nova, a
 * janela do canal. */

const raiz = new URL('../dashboard/', import.meta.url)
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8')

const globals = ler('app/globals.css')
const painel = ler('app/painel/painel.css')
const toast = ler('components/ToastProvider.js')

// Diálogos-folha: abrem de dentro de outra camada e nada abre por cima deles.
const DIALOGOS = [
  ['AddChannelModal', 'components/AddChannelModal.js'],
  ['SelectChannelModal', 'components/SelectChannelModal.js'],
  ['ConfirmDialog', 'components/ConfirmDialog.js'],
]

function camada(css, seletor) {
  // O mesmo seletor aparece em mais de um bloco (ex.: a altura em `dvh` e a
  // regra de celular): vale o bloco que de fato declara o z-index.
  const blocos = [...css.matchAll(new RegExp(`\\${seletor}\\s*\\{[^}]*\\}`, 'g'))]
  assert.ok(blocos.length, `não achei a regra de ${seletor}`)
  const zs = blocos.map((b) => b[0].match(/z-index:\s*(\d+)/)).filter(Boolean)
  assert.equal(zs.length, 1, `${seletor} precisa declarar z-index em um lugar só`)
  return Number(zs[0][1])
}

test('a camada dos diálogos fica ACIMA da gaveta e da janela do painel', () => {
  const dialogo = camada(globals, '.ui-dialog-layer')
  const gaveta = camada(painel, '.pnl-drawer-overlay')
  const janela = camada(painel, '.pnl-modal-overlay')

  assert.ok(
    dialogo > gaveta,
    `diálogo (${dialogo}) precisa ficar acima da gaveta (${gaveta}) — é de dentro dela que sai "Escolher canal do botão" e os avisos de descartar/remover`,
  )
  assert.ok(
    dialogo > janela,
    `diálogo (${dialogo}) precisa ficar acima da janela "Adicionar" (${janela}) — é de dentro dela que sai "Adicionar canal"`,
  )
})

test('o aviso passageiro continua acima do diálogo', () => {
  // Toast por baixo de um diálogo modal é confirmação que ninguém vê.
  const z = toast.match(/z-\[(\d+)\]/)
  assert.ok(z, 'ToastProvider sem z-index próprio')
  assert.ok(
    Number(z[1]) > camada(globals, '.ui-dialog-layer'),
    'o aviso passageiro precisa continuar acima do diálogo',
  )
})

for (const [nome, caminho] of DIALOGOS) {
  test(`${nome}: o véu usa a camada dos diálogos, não o z-50 do Tailwind`, () => {
    const source = ler(caminho)
    const veu = source.match(/className="([^"]*\bfixed inset-0\b[^"]*)"/)
    assert.ok(veu, `não achei o véu de ${nome}`)
    assert.match(veu[1], /\bui-dialog-layer\b/, `${nome} precisa da camada canônica`)
    assert.doesNotMatch(
      veu[1],
      /(^|\s)z-\d/,
      `${nome} não pode voltar a fixar z-index por utility — é assim que ele passa a abrir atrás`,
    )
  })
}

test('a altura da folha de diálogo sai de dvh, não de vh', () => {
  const bloco = globals.match(/\.ui-dialog-sheet\s*\{[^}]*\}/)
  assert.ok(bloco, 'não achei .ui-dialog-sheet')
  const dvh = bloco[0].indexOf('max-height: calc(100dvh')
  assert.ok(dvh >= 0, '`100vh` não desconta a barra de endereço do celular')
  // ⚠️ O plano B em `vh` é intenção de código: medido no build, o minificador
  // o descarta quando os navegadores-alvo entendem `dvh`. Se ele estiver
  // escrito, precisa vir ANTES — invertido, quem tem `dvh` cairia no `vh`.
  const vh = bloco[0].indexOf('max-height: calc(100vh')
  if (vh >= 0) assert.ok(vh < dvh, 'o `vh` é plano B e precisa vir antes do `dvh`')
  assert.match(bloco[0], /overflow: hidden/, 'a folha precisa recortar o que passa')
})

test('a janela do canal é folha com cabeçalho preso e corpo rolando', () => {
  const source = ler('components/AddChannelModal.js')
  assert.match(source, /className="ui-dialog-sheet\b/, 'a janela precisa ser folha de altura limitada')
  // Cabeçalho que rola junto some da tela num formulário longo.
  assert.match(source, /shrink-0[^"]*"[^>]*>\s*<h2[^>]*>Adicionar canal/, 'o cabeçalho precisa ficar preso')
  // `min-h-0` é o que permite o corpo encolher: sem ele o corpo empurra os
  // irmãos e o conteúdo sobe para cima do cabeçalho (RCA 2026-09-19).
  assert.match(source, /min-h-0 flex-1 overflow-y-auto/, 'o corpo precisa rolar e poder encolher')
})

test('a lista de canais que sigo não cria rolagem dentro de rolagem no celular', () => {
  const source = ler('components/AddChannelModal.js')
  const lista = source.match(/<ul className="([^"]*overflow-y-auto[^"]*)"/)
  assert.ok(lista, 'não achei a lista de canais seguidos')
  assert.doesNotMatch(
    lista[1],
    /(^|\s)max-h-\d/,
    'teto de altura no celular faz a rolagem de dentro roubar o gesto da de fora',
  )
  assert.match(lista[1], /\bsm:max-h-/, 'no computador o teto continua valendo')
})
