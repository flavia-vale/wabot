import test from 'node:test'
import assert from 'node:assert/strict'
import { checkSupervisorEnvConsistency, checkSupervisorModeEnabled } from '../src/supervisor/envGuard.js'

test('staging no diretório de staging com Redis /1 é consistente', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'staging',
    cwd: '/home/deploy/wabot-staging',
    redisUrl: 'redis://127.0.0.1:6379/1',
  })
  assert.equal(r.ok, true)
})

test('produção no diretório de prod com Redis /0 é consistente', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'production',
    cwd: '/home/deploy/wabot',
    redisUrl: 'redis://127.0.0.1:6379/0',
  })
  assert.equal(r.ok, true)
})

test('APP_ENV ausente assume produção e valida contra cwd de prod', () => {
  const r = checkSupervisorEnvConsistency({
    cwd: '/home/deploy/wabot',
    redisUrl: 'redis://127.0.0.1:6379/0',
  })
  assert.equal(r.ok, true)
})

test('staging rodando do diretório de prod é bloqueado (o incidente real)', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'staging',
    cwd: '/home/deploy/wabot',
    redisUrl: 'redis://127.0.0.1:6379/0',
  })
  assert.equal(r.ok, false)
  assert.match(r.reason, /staging/i)
  assert.match(r.reason, /pm2 delete/i)
})

test('produção rodando do diretório de staging é bloqueado', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'production',
    cwd: '/home/deploy/wabot-staging',
    redisUrl: 'redis://127.0.0.1:6379/0',
  })
  assert.equal(r.ok, false)
})

test('staging com cwd certo mas Redis /0 (prod) é bloqueado', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'staging',
    cwd: '/home/deploy/wabot-staging',
    redisUrl: 'redis://127.0.0.1:6379/0',
  })
  assert.equal(r.ok, false)
  assert.match(r.reason, /DB 0/)
})

test('produção com cwd certo mas Redis /1 (staging) é bloqueado', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'production',
    cwd: '/home/deploy/wabot',
    redisUrl: 'redis://127.0.0.1:6379/1',
  })
  assert.equal(r.ok, false)
  assert.match(r.reason, /DB 1/)
})

test('cwd com subdiretório dentro de staging ainda é reconhecido como staging', () => {
  const r = checkSupervisorEnvConsistency({
    appEnv: 'staging',
    cwd: '/home/deploy/wabot-staging/src',
    redisUrl: 'redis://127.0.0.1:6379/1',
  })
  assert.equal(r.ok, true)
})

test('sem REDIS_URL com índice de DB, valida só pelo cwd', () => {
  const ok = checkSupervisorEnvConsistency({ appEnv: 'staging', cwd: '/home/deploy/wabot-staging' })
  assert.equal(ok.ok, true)
  const bad = checkSupervisorEnvConsistency({ appEnv: 'staging', cwd: '/home/deploy/wabot' })
  assert.equal(bad.ok, false)
})

test('REDIS_URL com DB não-canônica não dispara falso positivo', () => {
  // staging numa DB /2 (fora da convenção 0/1) não deve ser bloqueado pela
  // checagem secundária — só as DBs cruzadas 0<->1 são tratadas como erro.
  const r = checkSupervisorEnvConsistency({
    appEnv: 'staging',
    cwd: '/home/deploy/wabot-staging',
    redisUrl: 'redis://127.0.0.1:6379/2',
  })
  assert.equal(r.ok, true)
})

test('modo remote habilita o supervisor', () => {
  assert.equal(checkSupervisorModeEnabled({ supervisorMode: 'remote' }).ok, true)
  assert.equal(checkSupervisorModeEnabled({ supervisorMode: 'REMOTE' }).ok, true)
})

test('modo inline bloqueia o supervisor (o incidente do double-fork)', () => {
  const r = checkSupervisorModeEnabled({ supervisorMode: 'inline' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /remote/i)
  assert.match(r.reason, /pm2 stop/i)
})

test('modo ausente assume inline e bloqueia (default seguro)', () => {
  const r = checkSupervisorModeEnabled({})
  assert.equal(r.ok, false)
  assert.match(r.reason, /inline/i)
})

test('valor lixo de modo é tratado como não-remote e bloqueia', () => {
  assert.equal(checkSupervisorModeEnabled({ supervisorMode: 'sim' }).ok, false)
})
