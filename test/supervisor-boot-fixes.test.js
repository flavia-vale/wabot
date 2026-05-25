import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { listSessionHealth, listRunningBots } from '../src/core/sessionCore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const supervisorEntry = join(__dirname, '..', 'src', 'supervisor', 'index.js')

// O supervisor faz process.exit(1) no boot quando SHARD_INDEX é inválido.
// Como o módulo executa side-effects no import, spawnamos node em subprocess
// e checamos o exit code + stderr.
function bootSupervisorWith(env) {
  // Não queremos que o supervisor realmente conecte em Redis — ele sai antes
  // disso porque SHARD_INDEX é validado logo após resolveRedisUrl(). Mas
  // garantimos um REDIS_URL fake para o fail-fast de Redis não disparar
  // primeiro (queremos ver o crash de shard).
  const result = spawnSync(process.execPath, [supervisorEntry], {
    env: {
      ...process.env,
      REDIS_URL: env.REDIS_URL ?? 'redis://127.0.0.1:6379/15',
      SHARD_COUNT: env.SHARD_COUNT ?? '1',
      ...(env.SHARD_INDEX !== undefined ? { SHARD_INDEX: env.SHARD_INDEX } : {}),
      AUTO_START_WHATSAPP_SESSIONS: 'false',
    },
    timeout: 4000,
    encoding: 'utf8',
  })
  return result
}

test('SHARD_INDEX não-numérico aborta o boot com exit code 1', () => {
  const res = bootSupervisorWith({ SHARD_INDEX: 'abc', SHARD_COUNT: '2' })
  assert.equal(res.status, 1, `expected exit 1, got ${res.status}\nstderr: ${res.stderr}\nstdout: ${res.stdout}`)
  const out = (res.stdout || '') + (res.stderr || '')
  assert.match(out, /SHARD_INDEX inválido/i)
})

test('SHARD_INDEX fora da faixa (>= SHARD_COUNT) aborta o boot', () => {
  const res = bootSupervisorWith({ SHARD_INDEX: '5', SHARD_COUNT: '2' })
  assert.equal(res.status, 1)
  const out = (res.stdout || '') + (res.stderr || '')
  assert.match(out, /SHARD_INDEX inválido/i)
})

test('SHARD_INDEX negativo aborta o boot', () => {
  const res = bootSupervisorWith({ SHARD_INDEX: '-1', SHARD_COUNT: '2' })
  assert.equal(res.status, 1)
})

test('SHARD_INDEX float (não-inteiro) aborta o boot', () => {
  const res = bootSupervisorWith({ SHARD_INDEX: '1.5', SHARD_COUNT: '4' })
  assert.equal(res.status, 1)
})

test('listSessionHealth exporta snapshot read-only de heartbeat', () => {
  // Sem bots forkados, o array vem vazio mas o contrato precisa existir
  // (o health monitor do supervisor depende dele).
  const snapshot = listSessionHealth()
  assert.ok(Array.isArray(snapshot))
  // Forma do retorno: cada entry tem userId, lastHeartbeatAt, killed.
  // Validamos a forma quando há bots; sem bots o teste só garante o tipo.
  for (const item of snapshot) {
    assert.equal(typeof item.userId, 'string')
    assert.equal(typeof item.lastHeartbeatAt, 'number')
    assert.equal(typeof item.killed, 'boolean')
  }
  // listRunningBots e listSessionHealth devem concordar em cardinalidade.
  assert.equal(snapshot.length, listRunningBots().length)
})
