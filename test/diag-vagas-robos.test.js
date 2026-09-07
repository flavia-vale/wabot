import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SCRIPT = readFileSync(new URL('../scripts/diag-vagas-robos.mjs', import.meta.url), 'utf8')

// Mesmo espírito de test/diag-atribuicao.test.js: script de diagnóstico que
// REESCREVE a regra do servidor acaba discordando dele, e aí não há como saber
// qual dos dois está certo — que é justamente o que o script deveria resolver.
test('o diagnóstico importa a regra de ressurreição do servidor, não reescreve', () => {
  assert.match(SCRIPT, /from '\.\.\/src\/core\/sessionResurrectionPolicy\.js'/)
  assert.match(SCRIPT, /shouldResurrectSession/)
  assert.ok(
    !/RESURRECTABLE_STATUSES|DELIBERATE_LIFECYCLES/.test(SCRIPT),
    'o script não pode ter cópia local das listas de status/lifecycle',
  )
})

test('o diagnóstico é read-only', () => {
  for (const escrita of ['\\.create\\(', '\\.update\\(', '\\.delete\\(', '\\.upsert\\(', 'executeRaw', 'stopBot']) {
    assert.ok(
      !new RegExp(escrita).test(SCRIPT),
      `diagnóstico não pode escrever nem parar sessão (achou "${escrita}") — isso é decisão humana`,
    )
  }
})

test('o teto lido é o MESMO nome de env que o servidor usa', () => {
  assert.match(SCRIPT, /MAX_SESSIONS_PER_PROCESS/)
})
