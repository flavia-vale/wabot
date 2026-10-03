import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  AUDIT_LABELS, AUDIT_MAX_TAKE, auditActionLabel, parseAuditQuery, buildAuditWhere, canReadAudit, buildAuditRows,
} from '../src/domain/admin/auditLabels.js'
import { redactAdminPayload } from '../src/adminRedaction.js'

// M8 da auditoria: tela "Auditoria" (quem fez o quê) em Operação.

const root = new URL('../', import.meta.url).pathname
const read = rel => readFileSync(join(root, rel), 'utf8')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.js')) out.push(p)
  }
  return out
}

test('toda ação "admin.*" gravada no código tem rótulo leigo', () => {
  const acoes = new Set()
  for (const file of walk(join(root, 'src'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/action:\s*'(admin\.[A-Za-z0-9_.]+)'/g)) acoes.add(m[1])
  }
  assert.ok(acoes.size > 50, 'a varredura deveria achar dezenas de ações')
  const sem = [...acoes].filter(a => !AUDIT_LABELS[a])
  assert.deepEqual(sem, [], `ações sem rótulo em src/domain/admin/auditLabels.js: ${sem.join(', ')}`)
})

test('rótulo: exemplo do item e fallback sem quebrar', () => {
  assert.equal(auditActionLabel('admin.user.block'), 'bloqueou a conta')
  assert.match(auditActionLabel('outra.coisa'), /outra\.coisa/)
  assert.equal(auditActionLabel(null), 'ação desconhecida')
})

test('query: take nunca passa de 200, days 1..180, página mínima 1', () => {
  assert.equal(parseAuditQuery({ take: '9999' }).take, AUDIT_MAX_TAKE)
  assert.equal(parseAuditQuery({ take: '0' }).take, 1)
  assert.equal(parseAuditQuery({}).take, 50)
  assert.equal(parseAuditQuery({ days: '9999' }).days, 180)
  assert.equal(parseAuditQuery({ days: 'x' }).days, 30)
  assert.equal(parseAuditQuery({ page: '-3' }).page, 1)
})

test('where: período, ação e ator/alvo por id ou e-mail', () => {
  const now = 1_800_000_000_000
  const w = buildAuditWhere(parseAuditQuery({ days: '7', action: 'user.block', actor: 'Ana@X.com', target: 'u1' }), now)
  assert.equal(w.createdAt.gte.getTime(), now - 7 * 86_400_000)
  assert.deepEqual(w.action, { contains: 'user.block' })
  assert.equal(w.AND.length, 2)
  assert.deepEqual(w.AND[0].OR[1], { actorUser: { is: { email: { contains: 'ana@x.com' } } } })
  assert.deepEqual(w.AND[1].OR[0], { targetUserId: 'u1' })
  assert.equal(buildAuditWhere(parseAuditQuery({}), now).AND, undefined)
})

test('só owner/admin leem a trilha', () => {
  assert.equal(canReadAudit('owner'), true)
  assert.equal(canReadAudit('admin'), true)
  for (const r of ['support', 'billing_admin', 'tech_support', 'read_only', null]) assert.equal(canReadAudit(r), false)
})

test('linhas saem redigidas (token, e-mail, telefone) e com rótulo', () => {
  const [row] = buildAuditRows([{
    id: '1', createdAt: new Date(5), action: 'admin.user.block', resource: 'user', status: 'success',
    actorUser: { id: 'a', email: 'a@x', name: 'A' }, targetUser: null,
    after: JSON.stringify({ token: 'abc', email: 'x@y.com', phone: '5511999999999', ok: true }), before: 'não é json',
  }], redactAdminPayload)
  assert.equal(row.label, 'bloqueou a conta')
  assert.equal(row.createdAt, 5)
  assert.equal(row.after.token, '[REDACTED]')
  assert.match(row.after.email, /^email_hash:/)
  assert.match(row.after.phone, /^phone_hash:/)
  assert.equal(row.after.ok, true)
  assert.equal(row.before, null)
})

test('rota GET /audit: owner/admin, paginada, redigida e a leitura NÃO é auditada', () => {
  const src = read('src/api/routes/admin.js')
  const i = src.indexOf("app.get('/audit'")
  assert.ok(i > 0)
  const bloco = src.slice(i, src.indexOf('\n  })\n', i))
  assert.match(bloco, /requireAdmin\(req, reply, 'admin:read'\)/)
  assert.match(bloco, /canReadAudit\(req\.admin\.role\)/)
  assert.match(bloco, /skip:/)
  assert.match(bloco, /take: q\.take/)
  assert.match(bloco, /redactAdminPayload/)
  assert.ok(!bloco.includes('writeAdminAuditLog'), 'ler a auditoria não pode gerar auditoria')
})

test('tela: seção Auditoria em componente próprio, dentro da Operação', () => {
  const op = read('dashboard/app/admin/operacao/page.js')
  assert.match(op, /import AuditoriaSection from '@\/components\/AuditoriaSection'/)
  assert.match(op, /<AuditoriaSection admin=\{admin\}/)
  const comp = read('dashboard/components/AuditoriaSection.js')
  assert.match(comp, /api\.adminAudit\(/)
  assert.match(comp, /\/admin\/clientes\//)
  assert.match(comp, /Promise\.resolve\(\)/)
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(comp), 'sem hex solto')
  assert.match(read('dashboard/lib/api.js'), /adminAudit:/)
})
