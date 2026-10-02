import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/*
 * Q8 da auditoria do painel: toda escrita de afiliado que mexe em dinheiro
 * (aprovar, rejeitar, regra geral, percentual especial) grava AdminAuditLog,
 * e o disparo de e-mail em massa exige o total conferido.
 */

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

function corpoDaRota(fonte, assinatura) {
  const inicio = fonte.indexOf(assinatura)
  assert.ok(inicio >= 0, `não achei ${assinatura}`)
  return fonte.slice(inicio, fonte.indexOf('\n  })\n', inicio))
}

const ROTAS = [
  ["app.post('/admin/affiliates/:id/approve'", 'admin.affiliate.approve'],
  ["app.post('/admin/affiliates/:id/reject'", 'admin.affiliate.reject'],
  ["app.put('/admin/affiliates/settings'", 'admin.affiliate.settings.update'],
  ["app.put('/admin/affiliates/:id'", 'admin.affiliate.commission_override'],
]

for (const [assinatura, acao] of ROTAS) {
  test(`${assinatura} grava auditoria ${acao} antes de responder`, () => {
    const corpo = corpoDaRota(read('src/api/routes/affiliate.js'), assinatura)
    assert.match(corpo, new RegExp(`writeAdminAuditLog\\(req, \\{[\\s\\S]*action: '${acao.replace('.', '\\.')}'`))
    const posAudit = corpo.indexOf('writeAdminAuditLog(')
    const posReturn = Math.max(corpo.lastIndexOf('return { profile'), corpo.lastIndexOf('return updated'))
    assert.ok(posAudit < posReturn, 'a auditoria vem antes da resposta de sucesso')
  })
}

test('rejeitar afiliado guarda o motivo na auditoria', () => {
  const corpo = corpoDaRota(read('src/api/routes/affiliate.js'), "app.post('/admin/affiliates/:id/reject'")
  assert.match(corpo, /reason: adminNotes \|\| null/)
})

test('disparo de e-mail em massa exige confirmTotal (400 sem ele, 409 se divergir)', () => {
  const corpo = corpoDaRota(read('src/api/routes/adminEmails.js'), "app.post('/send'")
  assert.match(corpo, /if \(!Number\.isFinite\(confirmado\)\) \{\s*return reply\.code\(400\)/)
  assert.match(corpo, /if \(confirmado !== recipients\.length\) \{\s*return reply\.code\(409\)/)
})
