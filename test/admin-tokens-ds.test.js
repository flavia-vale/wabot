// G5 passo 2 (docs/admin/auditoria-painel-admin.md): as telas novas do admin usam
// só os tokens do design system v2.1 (seção "Admin"). Este teste varre os arquivos
// migrados e falha com hex solto, cor nomeada do Tailwind ou jargão que o DS proíbe.
// O Início (dashboard/app/admin/page.js) e as páginas legadas NÃO entram aqui de
// propósito: são o próximo passo (ver docs/rca/admin.md, "Admin nos tokens do DS").
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRAVIDADE, LIMIAR_AGORA } from '../src/domain/admin/inboxPriority.js'
import { FAIXA_POR_MOTIVO, FAIXAS_GRAVIDADE, faixaDoMotivo } from '../dashboard/lib/admin/inboxFiltros.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

export const TELAS_MIGRADAS = [
  'dashboard/app/admin/hoje/page.js',
  'dashboard/app/admin/receita/page.js',
  'dashboard/app/admin/operacao/page.js',
  'dashboard/app/admin/operacao/modelos/page.js',
  'dashboard/app/admin/clientes/page.js',
  'dashboard/app/admin/clientes/[id]/page.js',
  'dashboard/app/admin/clientes/contato/page.js',
  'dashboard/components/FilasSection.js',
  'dashboard/components/AuditoriaSection.js',
  'dashboard/components/SaudeSection.js',
  'dashboard/components/AdminContato.js',
  'dashboard/components/PayingTag.js',
  'dashboard/components/SharedPhoneTag.js',
  'dashboard/components/TestAccountTag.js',
  'dashboard/components/HelpDot.js',
  'dashboard/components/AdminTutorialAccordion.js',
  'dashboard/components/SectionErrorBoundary.js',
]

const FAMILIAS = 'slate|gray|zinc|neutral|stone|emerald|red|rose|amber|yellow|sky|cyan|indigo|violet|purple|green|blue|orange|teal|lime|pink|fuchsia'
const PREFIXOS = 'bg|text|border|ring|divide|from|via|to|placeholder|outline|fill|stroke|decoration|accent|caret|shadow'
const TAILWIND_NOMEADO = new RegExp(`(?<![A-Za-z0-9_-])(?:[a-z0-9-]+:)*(?:${PREFIXOS})-(?:${FAMILIAS})-\\d{2,3}`, 'g')
const BRANCO_PRETO = new RegExp(`(?<![A-Za-z0-9_-])(?:[a-z0-9-]+:)*(?:bg|text|border|ring|divide|from|via|to)-(?:white|black)(?![A-Za-z0-9_-])`, 'g')
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RGB = /\brgba?\(/g

// Tira comentários para o teste olhar só código e texto de tela.
function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

for (const rel of TELAS_MIGRADAS) {
  test(`tokens do DS: ${rel} sem hex solto nem cor nomeada do Tailwind`, () => {
    const src = semComentarios(read(rel))
    const hex = src.match(HEX) || []
    assert.deepEqual(hex, [], `hex solto em ${rel}: ${hex.join(', ')}`)
    assert.deepEqual(src.match(RGB) || [], [], `rgb()/rgba() solto em ${rel}`)
    assert.deepEqual(src.match(TAILWIND_NOMEADO) || [], [], `cor nomeada do Tailwind em ${rel}`)
    assert.deepEqual(src.match(BRANCO_PRETO) || [], [], `branco/preto do Tailwind em ${rel} (use ds-surface / ds-ink)`)
  })
}

test('tokens do DS: o tema declara todas as cores ds-* usadas nas telas', () => {
  const css = read('dashboard/app/globals.css')
  const declaradas = new Set([...css.matchAll(/--color-ds-([a-z0-9-]+):/g)].map(m => m[1]))
  const usadas = new Set()
  for (const rel of TELAS_MIGRADAS) {
    for (const m of read(rel).matchAll(/(?<![A-Za-z0-9_-])(?:[a-z0-9-]+:)*(?:bg|text|border|ring|divide|from|via|to|placeholder|outline|fill|stroke|decoration|accent|caret)-ds-([a-z0-9-]+?)(?:\/\d+)?(?![A-Za-z0-9-])/g)) usadas.add(m[1])
  }
  for (const nome of usadas) assert.ok(declaradas.has(nome), `classe ds-${nome} usada sem --color-ds-${nome} em globals.css`)
})

test('tokens do DS: o escopo do admin declara os tokens que só existiam no painel (D12)', () => {
  const css = read('dashboard/app/admin/admin.css')
  for (const t of ['--pro:', '--pro-soft:', '--pro-ink:', '--pnl-shadow:', '--pnl-shadow-soft:', '--warn-ink:']) assert.ok(css.includes(t), `${t} faltando em admin.css`)
  const layout = read('dashboard/app/admin/layout.js')
  assert.match(layout, /import '\.\/admin\.css'/)
  assert.match(layout, /className="admin-root"/)
})

test('tokens do DS: o Início e as páginas legadas ficam de fora desta leva', () => {
  for (const rel of ['dashboard/app/admin/page.js']) assert.ok(!TELAS_MIGRADAS.includes(rel))
})

test('Hoje: toda gravidade do domínio cai numa faixa de cor (DS Admin · bloco 4)', () => {
  assert.deepEqual(Object.keys(FAIXA_POR_MOTIVO).sort(), Object.keys(GRAVIDADE).sort(), 'motivo novo em GRAVIDADE sem faixa (ou o contrário)')
  for (const [motivo, g] of Object.entries(GRAVIDADE)) {
    const esperado = g >= 3 ? 3 : g >= 2 ? 2 : g >= 1.2 ? 1 : 0
    assert.equal(FAIXA_POR_MOTIVO[motivo], esperado, `${motivo} (gravidade ${g}) na faixa errada`)
    assert.equal(faixaDoMotivo(motivo), FAIXAS_GRAVIDADE[esperado])
  }
  assert.equal(LIMIAR_AGORA, 6, 'a divisão Agora × Esta semana não muda')
  assert.equal(faixaDoMotivo('motivo-que-nao-existe'), FAIXAS_GRAVIDADE[0])
})

test('Hoje: faixa usa só token e o rótulo escrito vai junto da cor', () => {
  for (const f of Object.values(FAIXAS_GRAVIDADE)) {
    assert.match(f.rotulo, /\S/)
    assert.doesNotMatch(`${f.cor} ${f.fundo}`, /#[0-9a-fA-F]{3,8}\b/)
    assert.match(`${f.cor} ${f.fundo}`, /var\(--/)
  }
  const page = read('dashboard/app/admin/hoje/page.js')
  assert.match(page, /faixaDoMotivo\(item\.motivo\)/)
  assert.match(page, /\{faixa\.rotulo\}/)
})

test('voz leiga no admin migrado: sem jargão que o DS Admin proíbe na tela', () => {
  const proibidos = ['GO / NO-GO', 'GO/NO-GO', 'Volumetria operacional', 'ADMIN_MFA_TOKEN', 'tech:write', 'webhook(s) parados']
  for (const rel of TELAS_MIGRADAS) {
    const src = read(rel)
    // só texto que a dona lê: JSX e strings; comentários podem citar o termo
    const visivel = semComentarios(src)
    for (const termo of proibidos) {
      // permissão e variável de ambiente aparecem em código (checagem de permissão); só barra dentro de texto de tela
      const naTela = new RegExp(`>[^<>{}]*${termo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}[^<>{}]*<`).test(visivel)
      assert.ok(!naTela, `jargão "${termo}" na tela em ${rel}`)
    }
  }
})
