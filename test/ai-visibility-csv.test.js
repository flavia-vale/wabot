import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { validateAiVisibilityCsv, parseCsv, AI_VISIBILITY_HEADER } from '../src/ops/aiVisibilityCsv.js'

const HEADER = AI_VISIBILITY_HEADER.join(',')
const linha = (over = {}) => {
  const base = { query: 'bot para afiliados no WhatsApp', cluster: 'categoria', platform: 'ChatGPT Search', checked_at: '2026-09-20', ai_answer_present: 'sim', botinho_cited: 'nao', cited_url: '', competitors_cited: '', notes: '', next_action: '', owner: 'marketing', ...over }
  return AI_VISIBILITY_HEADER.map((k) => base[k]).join(',')
}
const validar = (...linhas) => validateAiVisibilityCsv([HEADER, ...linhas].join('\n'), { today: '2026-09-23' })

test('o CSV real do repositório passa sem erro', () => {
  const texto = fs.readFileSync(new URL('../docs/marketing/ai_visibility_tracking.csv', import.meta.url), 'utf8')
  const r = validateAiVisibilityCsv(texto)
  assert.deepEqual(r.errors, [])
  assert.ok(r.rowCount > 50)
})

test('"SIM" maiúsculo é erro — foi o que zerou o placar de 01/09', () => {
  const r = validar(linha({ botinho_cited: 'SIM' }))
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /minúsculo/)
})

test('valores fora da lista, data inválida ou no futuro são erro', () => {
  assert.equal(validar(linha({ ai_answer_present: 'não' })).errors.length, 1)
  assert.equal(validar(linha({ cluster: 'Categoria' })).errors.length, 1)
  assert.equal(validar(linha({ platform: 'Bing Copilot' })).errors.length, 1)
  assert.equal(validar(linha({ checked_at: '2026-02-30' })).errors.length, 1)
  assert.equal(validar(linha({ checked_at: '2026-10-01' })).errors.length, 1)
})

test('sufixo de conta na plataforma é aceito', () => {
  assert.deepEqual(validar(linha({ platform: 'ChatGPT Search (conta neutra)' })).errors, [])
})

test('linha repetida (consulta + plataforma + data) é erro', () => {
  assert.equal(validar(linha(), linha()).errors.length, 1)
})

test('Trilha C: nome antigo como marca é erro depois do roteiro, e o histórico fica como está', () => {
  assert.equal(validar(linha({ query: 'BOTinho preço', cluster: 'marca' })).errors.length, 1)
  assert.deepEqual(validar(linha({ query: 'BOTinho preço', cluster: 'contaminacao' })).errors, [])
  assert.deepEqual(validar(linha({ query: 'BOTinho preço', cluster: 'marca', checked_at: '2026-09-10' })).errors, [])
})

test('citado sem URL é aviso, não erro', () => {
  const r = validar(linha({ botinho_cited: 'sim' }))
  assert.deepEqual(r.errors, [])
  assert.equal(r.warnings.length, 1)
})

test('o parser respeita aspas, vírgula e aspas escapadas dentro do campo', () => {
  const rows = parseCsv('a,b\n"x, y","diz ""oi"""\n')
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'diz "oi"']])
})
