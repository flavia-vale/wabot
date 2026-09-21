import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../scripts/restore-empty-monitor-targets.mjs', import.meta.url), 'utf8')

test('recuperação é read-only por padrão e exige confirmação dupla para toda a base', () => {
  assert.match(src, /const apply = args\.includes\('--aplicar'\)/)
  assert.match(src, /const all = args\.includes\('--todos'\)/)
  assert.match(src, /if \(apply && !who && !all\)/)
  assert.match(src, /if \(!apply \|\| affected\.length === 0\)/)
})

test('seleciona somente origem explicitamente vazia', () => {
  assert.match(src, /role: 'monitor'/)
  assert.match(src, /targetsMode: 'explicit'/)
  assert.match(src, /monitorTargets: \{ none: \{\} \}/)
})

test('recuperação só muda targetsMode para all; nunca inventa nem apaga vínculo', () => {
  assert.match(src, /data: \{ targetsMode: 'all' \}/)
  assert.doesNotMatch(src, /groupTarget\.(?:create|delete|update)/)
  assert.doesNotMatch(src, /\$executeRaw|\$queryRawUnsafe/)
})
