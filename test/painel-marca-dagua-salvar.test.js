import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Bug relatado pela cliente (2026-08-29): "a página parece estar atualizando
// quando eu começo a escrever o texto da marca d'água e isso está gerando
// dificuldade".
//
// O campo salvava sozinho enquanto ela digitava (debounce de 500ms). Três
// efeitos, todos no meio da digitação:
//   1. cada pausa disparava um PUT, que mexia em savingGroupId/savedGroupId e
//      repintava a linha do grupo;
//   2. cada PUT recarrega a config do worker;
//   3. o pior: se o PUT falhasse, handleUpdateGroup chamava `load()`, que
//      recarrega TODOS os grupos e substitui o estado — o texto pela metade era
//      apagado e voltava o valor antigo.
//
// Agora o que se digita é rascunho LOCAL e nada vai ao servidor até o clique em
// Salvar. Mesmo padrão do DestinationPicker (test/painel-destinos-editor.test.js).
// Teste estrutural pelo mesmo motivo do teste irmão: o helper de render só
// monta o export default (a página inteira), que exigiria dezenas de mocks.

const page = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')

function watermarkField() {
  const start = page.indexOf('function WatermarkTextField')
  assert.notEqual(start, -1, 'WatermarkTextField não encontrado')
  const end = page.indexOf('/* ── Monitor group config panel', start)
  assert.notEqual(end, -1)
  return page.slice(start, end)
}

test('digitar NÃO salva: o campo só mexe no rascunho local', () => {
  const field = watermarkField()
  const onChange = field.slice(field.indexOf('onChange={(e) => {'), field.indexOf('onKeyDown'))
  assert.match(onChange, /onDraftChange\(group\.id,/, 'digitar precisa alimentar só o rascunho')
  assert.doesNotMatch(onChange, /onSave\(/, 'digitar não pode salvar')
  assert.doesNotMatch(onChange, /api\./, 'digitar não pode chamar a API')
})

test('o salvamento automático enquanto digita foi REMOVIDO', () => {
  // Era isto que repintava a tela a cada pausa da digitação.
  assert.doesNotMatch(page, /handleUpdateGroupDebounced/)
  assert.doesNotMatch(page, /watermarkSaveTimers/)
})

test('existe um botão Salvar ao lado, e ele só age quando há mudança de verdade', () => {
  const field = watermarkField()
  assert.match(field, /className="cfg-dest-actions"/)
  assert.match(field, /onClick=\{handleSave\}/)
  assert.match(field, /disabled=\{saving \|\| !dirty\}/, 'sem mudança pendente o botão fica inerte')
  assert.match(field, /Salvar marca/)
  // Toque duplo não pode disparar dois PUTs.
  assert.match(field, /if \(!dirty \|\| saving\) return/)
})

test('a pessoa vê que há alteração não salva, e consegue desfazer', () => {
  const field = watermarkField()
  assert.match(field, /Não salvo/)
  assert.match(field, /dirty && \(/)
  assert.match(field, /onReset\(group\.id\)/)
})

test('salvar a marca NÃO recarrega todos os grupos (era o que apagava o texto)', () => {
  const start = page.indexOf('const saveWatermarkText =')
  assert.notEqual(start, -1, 'saveWatermarkText não encontrado')
  // Comentários fora: o próprio comentário explica por que `load()` não pode
  // estar aqui, e a menção nele não pode reprovar o teste.
  const fn = page.slice(start, page.indexOf('}, [resetWatermarkDraft])', start)).replace(/\/\/[^\n]*/g, '')
  assert.doesNotMatch(fn, /\bload\(\)/, 'load() aqui apagaria o que a cliente acabou de escrever')
  // O erro precisa nascer junto do campo: no celular, banner no topo fica fora
  // da tela e a pessoa não vê que falhou.
  assert.match(fn, /setWatermarkErrors/)
})

test('o rascunho é por grupo — abrir outro destino não herda o texto do anterior', () => {
  assert.match(page, /const \[watermarkDrafts, setWatermarkDrafts\] = useState\(\{\}\)/)
  const field = watermarkField()
  assert.match(field, /const value = draft \?\? saved/, 'sem rascunho, mostra o que está salvo')
})

test('o limite de caracteres continua vindo de uma constante única', () => {
  assert.match(page, /const WATERMARK_TEXT_MAX_CHARS = 25/)
  const field = watermarkField()
  assert.match(field, /maxLength=\{maxChars\}/)
  assert.match(field, /\[\.\.\.e\.target\.value\]\.slice\(0, maxChars\)/)
})

// Segundo relato da mesma cliente (2026-08-29): "quando clico em salvar marca,
// precisa aparecer algo para o usuário confirmando visualmente que foi salvo ou
// não". A confirmação existia, mas era uma troca de texto de 12px na linha do
// contador de caracteres — passava despercebida.

test('o clique em Salvar tem resposta visível: salvando, salvou e falhou', () => {
  const field = watermarkField()
  assert.match(field, /className=\{`cfg-save-feedback/, 'a confirmação precisa ter faixa própria, não só troca de texto')
  assert.match(field, /Salvando a marca…/)
  assert.match(field, /Marca salva neste destino/)
  assert.match(field, /Não deu para salvar: \$\{error\}/, 'a falha precisa dizer o motivo, junto do campo')
  assert.match(field, /CfgIcon name=\{error \? 'x' : 'check'\}/)
})

test('quem não enxerga a tela também é avisado', () => {
  const field = watermarkField()
  assert.match(field, /role=\{error \? 'alert' : 'status'\}/, 'erro interrompe o leitor de tela; sucesso não')
  assert.match(field, /aria-live=\{error \? 'assertive' : 'polite'\}/)
})

test('a confirmação de sucesso some sozinha', () => {
  // Aviso de sucesso permanente deixa de ser aviso: na visita seguinte a pessoa
  // leria "Marca salva" sem ter salvado nada.
  assert.match(page, /const WATERMARK_SAVED_FEEDBACK_MS = \d+/)
  assert.match(page, /watermarkSavedTimers/)
  const start = page.indexOf('const saveWatermarkText =')
  const fn = page.slice(start, page.indexOf('}, [resetWatermarkDraft])', start))
  assert.match(fn, /setTimeout\(/)
  assert.match(fn, /clearTimeout\(watermarkSavedTimers\.current\[id\]\)/, 'salvar duas vezes não pode deixar timer órfão')
})

test('as faixas de confirmação têm estilo próprio na folha de estilo', () => {
  const css = readFileSync(new URL('../dashboard/app/painel/painel.css', import.meta.url), 'utf8')
  for (const classe of ['.cfg-save-feedback', '.cfg-save-feedback.is-ok', '.cfg-save-feedback.is-error', '.cfg-save-feedback.is-busy']) {
    assert.ok(css.includes(classe), `${classe} sem estilo — a faixa sairia sem cor nenhuma`)
  }
})
