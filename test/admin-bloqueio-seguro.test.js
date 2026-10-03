import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateBlockRequest, BLOCK_PERMISSION, BLOCK_REASON_MIN } from '../src/domain/admin/blockPolicy.js'

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const conta = 'cliente@exemplo.com'
const motivo = 'Chargeback confirmado em 03/10'

test('permissão exigida é admin:write (só o dono), não support:write', () => {
  assert.equal(BLOCK_PERMISSION, 'admin:write')
  const src = read('src/api/routes/admin.js')
  for (const rota of ["app.post('/users/:id/block'", "app.post('/users/:id/unblock'"]) {
    const ini = src.indexOf(rota)
    assert.ok(ini >= 0, rota)
    assert.match(src.slice(ini, ini + 400), /requireAdmin\(req, reply, BLOCK_PERMISSION\)/, rota)
  }
  assert.match(src, /admin: \['admin:read', 'billing:read', 'support:read'/, 'papel admin segue sem admin:write')
  assert.doesNotMatch(src.match(/admin: \[[^\]]*\]/)[0], /admin:write/)
})

test('motivo curto (< 10) é recusado, em bloquear e em desbloquear', () => {
  for (const action of ['block', 'unblock']) {
    const r = validateBlockRequest({ action, reason: 'spam', confirmEmail: conta, accountEmail: conta })
    assert.equal(r.ok, false)
    assert.match(r.error, new RegExp(String(BLOCK_REASON_MIN)))
  }
})

test('sem digitar o e-mail certo não passa (ignora caixa e espaços)', () => {
  assert.equal(validateBlockRequest({ reason: motivo, confirmEmail: '', accountEmail: conta }).ok, false)
  assert.equal(validateBlockRequest({ reason: motivo, confirmEmail: 'outra@exemplo.com', accountEmail: conta }).ok, false)
  assert.equal(validateBlockRequest({ reason: motivo, confirmEmail: '  CLIENTE@exemplo.com ', accountEmail: conta }).ok, true)
  assert.equal(validateBlockRequest({ reason: motivo, confirmEmail: '', accountEmail: '' }).ok, false)
})

test('status só suspended/banned; padrão suspended; motivo cortado em 400', () => {
  assert.equal(validateBlockRequest({ status: 'active', reason: motivo, confirmEmail: conta, accountEmail: conta }).ok, false)
  assert.equal(validateBlockRequest({ reason: motivo, confirmEmail: conta, accountEmail: conta }).status, 'suspended')
  assert.equal(validateBlockRequest({ status: 'banned', reason: motivo, confirmEmail: conta, accountEmail: conta }).status, 'banned')
  assert.equal(validateBlockRequest({ reason: 'x'.repeat(900), confirmEmail: conta, accountEmail: conta }).reason.length, 400)
})

test('rotas validam via blockPolicy e gravam o motivo na auditoria', () => {
  const src = read('src/api/routes/admin.js')
  for (const [rota, acao] of [["app.post('/users/:id/block'", 'admin.user.block'], ["app.post('/users/:id/unblock'", 'admin.user.unblock']]) {
    const ini = src.indexOf(rota)
    const corpo = src.slice(ini, src.indexOf('\n  })\n', ini))
    assert.match(corpo, /validateBlockRequest\(/, rota)
    assert.ok(corpo.indexOf('validateBlockRequest(') < corpo.indexOf('db.user.update('), 'valida ANTES de gravar')
    assert.match(corpo, new RegExp(`writeAdminAuditLog\\(req, \\{[^}]*action: '${acao.replace('.', '\\.')}'[\\s\\S]*reason: check\\.reason`))
  }
})

test('ficha 360: botão só com podeBloquear, confirm + e-mail digitado antes de chamar a API', () => {
  const page = read('dashboard/app/admin/clientes/[id]/page.js')
  const ini = page.indexOf('function BloquearConta')
  const corpo = page.slice(ini, page.indexOf('export default function', ini))
  assert.match(corpo, /if \(!podeBloquear\) return null/)
  const conf = corpo.indexOf('window.confirm(')
  const emailCheck = corpo.indexOf('emailDigitado.trim().toLowerCase()')
  const chamada = corpo.indexOf('api.adminUserBlock(')
  assert.ok(emailCheck >= 0 && conf > emailCheck && chamada > conf, 'e-mail, depois confirm, depois API')
  assert.match(corpo, /api\.adminUserUnblock\(/)
  assert.match(corpo, /confirmEmail/)
  assert.match(read('dashboard/lib/api.js'), /adminUserBlock: \(id, data\)/)
  assert.match(read('src/api/routes/admin.js'), /podeBloquear: hasPermission\(req\.admin\.role, BLOCK_PERMISSION\)/)
})
