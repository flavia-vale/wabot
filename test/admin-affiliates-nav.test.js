import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const adminSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')

test('admin cockpit links directly to affiliate administration', () => {
  assert.match(
    adminSource,
    /<Link href="\/admin\/afiliados"[^>]*>Afiliados<\/Link>/,
    'o cabeçalho do admin deve oferecer acesso direto ao admin de afiliados',
  )
})
