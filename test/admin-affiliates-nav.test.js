import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const adminSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')

test('admin cockpit links directly to affiliate administration', () => {
  // O painel foi reorganizado em abas: a aba "Afiliados" oferece o resumo e
  // um link direto ("Gestão completa") para o admin de afiliados completo.
  // O guardrail continua exigindo acesso direto — sem fixar o rótulo antigo.
  assert.match(
    adminSource,
    /<Link href="\/admin\/afiliados"/,
    'o admin deve oferecer acesso direto ao admin de afiliados',
  )
})
