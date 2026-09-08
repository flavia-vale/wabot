import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../dashboard/app/admin/erros/page.js', import.meta.url), 'utf8')

test('central de erros mostra causas novas, agrupamento e clientes afetadas', () => {
  assert.match(page, /Causas novas/)
  assert.match(page, /O que está acontecendo/)
  assert.match(page, /Quem está tendo esses erros/)
  assert.match(page, /Bloqueios esperados/)
  assert.match(page, /adminErrorObservability/)
  assert.match(page, /overflow-x-auto[^]*min-w-\[680px\]/)
})
