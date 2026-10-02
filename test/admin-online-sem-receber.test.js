import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeReceptionBlindRows, resolveReceptionBlindForRow } from '../src/domain/admin/receptionBlindStatus.js'

// E14 do diagnóstico de travamento de filas: o alarme de cegueira só virava um
// número no card da frota; a aba Online não dizia QUEM estava sem receber.

test('resume por cliente: pior silêncio e "mesmo depois de reconectar"', () => {
  const m = summarizeReceptionBlindRows([
    { userId: 'a', metadata: '{"silentForMs":3600000}' },
    { userId: 'a', metadata: { silentForMs: 7200000, acrossReconnects: true } },
    { userId: 'b', metadata: 'lixo' },
    { userId: null, metadata: '{}' },
  ])
  assert.deepEqual(m.get('a'), { haMuito: true, silentForMs: 7200000 })
  assert.deepEqual(m.get('b'), { haMuito: false, silentForMs: null })
  assert.equal(m.size, 2)
})

test('só marca quem está conectada', () => {
  const m = new Map([['a', { haMuito: false, silentForMs: 1 }]])
  assert.deepEqual(resolveReceptionBlindForRow(m, 'a', 'connected'), { haMuito: false, silentForMs: 1 })
  assert.equal(resolveReceptionBlindForRow(m, 'a', 'disconnected'), null)
  assert.equal(resolveReceptionBlindForRow(m, 'x', 'connected'), null)
  assert.equal(resolveReceptionBlindForRow(undefined, 'a', 'connected'), null)
})

const admin = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url), 'utf8')

test('lista e card usam a MESMA fonte (buildFleetScenarios), sem IPC com robôs', () => {
  assert.match(admin, /const blindDetailByUser = summarizeReceptionBlindRows\(blindRows\)/)
  assert.match(admin, /receptionBlind: resolveReceptionBlindForRow\(scenarios\?\.blindDetailByUser, user\.id, session\?\.status\)/)
  assert.match(admin, /blindDetailByUser: _blindDetailByUser, \.\.\.scenarioCounts/, 'o Map não pode vazar para o JSON de contagens')
})

test('a tabela da aba Online tem a coluna e fala em linguagem leiga', () => {
  assert.match(page, /<th className="px-3 py-3">Recebendo<\/th>/)
  assert.match(page, /<ReceptionCell blind=\{user\.receptionBlind\} \/>/)
  assert.match(page, /sem receber/)
  const celula = page.slice(page.indexOf('function ReceptionCell'), page.indexOf('function OnlineCard'))
  assert.doesNotMatch(celula.replace(/blind[.=]|\{ blind \}|blind\./g, ''), />[^<]*(blind|ops_wa|upsert)/i, 'texto visível sem jargão')
})
