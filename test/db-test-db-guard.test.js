import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Importa src/db.js num subprocesso com env controlada e devolve o resultado.
// O guard de db.js dispara no top-level do módulo, então o subprocesso é a
// forma fiel de exercitá-lo (o módulo já está cacheado no processo da suíte).
function importDbWith(env) {
  const dbPath = fileURLToPath(new URL('../src/db.js', import.meta.url))
  return spawnSync(
    process.execPath,
    ['-e', `import(${JSON.stringify(dbPath)}).then(() => process.exit(0))`],
    {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    }
  )
}

test('bloqueia testes apontando para prod.db', () => {
  const res = importDbWith({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./prisma/prod.db',
    ALLOW_TEST_DB_OVERRIDE: '',
  })
  assert.notEqual(res.status, 0, 'deveria abortar com status != 0')
  assert.match(res.stderr, /BLOQUEADO/)
})

test('bloqueia testes apontando para staging.db', () => {
  const res = importDbWith({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:/home/deploy/wabot-staging/prisma/staging.db',
    ALLOW_TEST_DB_OVERRIDE: '',
  })
  assert.notEqual(res.status, 0)
  assert.match(res.stderr, /BLOQUEADO/)
})

test('permite banco descartável em contexto de teste', () => {
  const res = importDbWith({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:/tmp/wabot-test-guard.db',
    ALLOW_TEST_DB_OVERRIDE: '',
  })
  assert.equal(res.status, 0, res.stderr)
})

test('escape hatch ALLOW_TEST_DB_OVERRIDE libera banco real', () => {
  const res = importDbWith({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./prisma/prod.db',
    ALLOW_TEST_DB_OVERRIDE: '1',
  })
  assert.equal(res.status, 0, res.stderr)
})

test('runtime normal (sem contexto de teste) não é afetado', () => {
  const res = importDbWith({
    NODE_ENV: 'production',
    DATABASE_URL: 'file:./prisma/prod.db',
    ALLOW_TEST_DB_OVERRIDE: '',
  })
  assert.equal(res.status, 0, res.stderr)
})
