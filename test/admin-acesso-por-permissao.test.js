import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canAccessCustomerSuccess, CUSTOMER_SUCCESS_PERMISSION } from '../dashboard/lib/admin/access.js'

/*
 * Q7 da auditoria do painel: nenhuma tela do admin decide acesso por lista
 * de e-mails fixa no código. A regra é a permissão que o backend devolve.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

test('acesso à fila de sucesso segue a permissão do backend (support:read) ou o papel owner', () => {
  assert.equal(CUSTOMER_SUCCESS_PERMISSION, 'support:read')
  assert.equal(canAccessCustomerSuccess({ role: 'support', permissions: ['admin:read', 'support:read'] }), true)
  assert.equal(canAccessCustomerSuccess({ role: 'owner', permissions: [] }), true)
  assert.equal(canAccessCustomerSuccess({ role: 'read_only', permissions: ['admin:read'] }), false)
  assert.equal(canAccessCustomerSuccess({ email: 'flavia.vale@usp.br', permissions: [] }), false, 'e-mail nunca libera sozinho')
  assert.equal(canAccessCustomerSuccess(null), false)
})

test('nenhum e-mail pessoal fixo em dashboard/app/admin ou dashboard/lib/admin', () => {
  const arquivos = [...walk(join(ROOT, 'dashboard/app/admin')), ...walk(join(ROOT, 'dashboard/lib/admin'))].filter(f => f.endsWith('.js'))
  const padrao = /[A-Za-z0-9._%+-]+@(gmail|usp|hotmail|outlook|yahoo|icloud)\.[a-z.]+/i
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, 'utf8')
    assert.ok(!padrao.test(fonte), `e-mail fixo decidindo algo em ${arquivo.replace(ROOT, '')}`)
  }
})

test('nenhuma tela do admin volta a ter lista fixa de e-mails da fila de atendimento', () => {
  // A fila de Sucesso do Cliente saiu do Início (G2): o atendimento mora na caixa
  // Hoje e na ficha, e quem decide o acesso é o backend (support:read).
  for (const rel of ['dashboard/app/admin/page.js', 'dashboard/app/admin/hoje/page.js', 'dashboard/app/admin/clientes/[id]/page.js']) {
    const fonte = readFileSync(join(ROOT, rel), 'utf8')
    assert.ok(!fonte.includes('CS_ALLOWED_EMAILS'), `${rel} ainda tem a lista`)
  }
})
