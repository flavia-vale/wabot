import test from 'node:test'
import assert from 'node:assert/strict'
import { wrapEmail } from '../src/email/layout.js'
import { getTemplateDefinition } from '../src/email/registry.js'

// A queixa: "todo e-mail vem com um título no corpo que não consigo editar".
// O título é um <h1> montado pela moldura a partir de template.title, que só
// existia no código. Agora a coluna EmailTemplate.title guarda a escolha da
// admin, e VAZIO significa "não quero título" — por isso a moldura precisa
// aguentar título vazio sem deixar sobra de marcação.
test('e-mail sem título não desenha cabeçalho nenhum', () => {
  const { html, text } = wrapEmail({ title: '', body: 'Bom dia.' })
  assert.ok(!html.includes('<h1'), 'não pode sobrar <h1> quando o título está vazio')
  assert.ok(html.includes('Bom dia.'))
  assert.ok(text.startsWith('Bom dia.'), `texto puro não pode começar com linha em branco: ${JSON.stringify(text)}`)
})

test('e-mail com título desenha o cabeçalho e escapa o texto', () => {
  const { html } = wrapEmail({ title: 'Já dá para conectar <b>seu</b> robô', body: 'oi' })
  assert.ok(html.includes('<h1'))
  assert.ok(html.includes('&lt;b&gt;'), 'título é texto, não marcação')
})

test('modelo de aviso de servidor lotado existe e é de disparo manual', () => {
  const t = getTemplateDefinition('nao_conseguiu_conectar_sem_vaga')
  assert.ok(t, 'o modelo precisa estar no catálogo para aparecer na aba E-mails')
  // Manual de propósito: avisar antes de existir vaga faria a cliente tentar
  // de novo e bater no mesmo erro.
  assert.equal(t.trigger, 'manual')
  // Aviso de serviço: a falha foi nossa, então vai inclusive para quem
  // descadastrou de divulgação.
  assert.equal(t.category, 'transactional')
  const texto = `${t.subject} ${t.title} ${t.body}`.toLowerCase()
  for (const jargao of ['worker', 'supervisor', 'circuit', 'shard', 'fork', 'socket', 'ram', 'vps']) {
    assert.ok(!texto.includes(jargao), `jargão "${jargao}" não pode chegar à cliente`)
  }
  assert.ok(t.body.includes('{{link_painel}}'), 'precisa levar a cliente de volta ao painel')
})
