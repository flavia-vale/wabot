import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Configura DATABASE_URL para um arquivo tmp ANTES de importar src/db.js,
// para que o teste rode tanto no container de dev (sem .env) quanto em CI.
// PRAGMAs funcionam em DB vazio — não precisamos rodar migrations aqui.
const tmpDir = mkdtempSync(join(tmpdir(), 'wabot-pragma-'))
const dbFile = join(tmpDir, 'pragma-test.db')
process.env.DATABASE_URL = `file:${dbFile}`

const { default: db, ready } = await import('../src/db.js')

test.after(async () => {
  try { await db.$disconnect() } catch {}
  rmSync(tmpDir, { recursive: true, force: true })
})

test('PRAGMA journal_mode = WAL é aplicado após boot', async () => {
  await ready
  const rows = await db.$queryRawUnsafe('PRAGMA journal_mode')
  const mode = rows?.[0]?.journal_mode
  assert.equal(String(mode).toLowerCase(), 'wal', `journal_mode esperado wal, obtido ${mode}`)
})

test('PRAGMA busy_timeout = 5000 está ativo na conexão', async () => {
  await ready
  const rows = await db.$queryRawUnsafe('PRAGMA busy_timeout')
  const value = Number(rows?.[0]?.timeout)
  assert.equal(value, 5000, `busy_timeout esperado 5000, obtido ${value}`)
})

test('PRAGMA synchronous = NORMAL (1)', async () => {
  await ready
  const rows = await db.$queryRawUnsafe('PRAGMA synchronous')
  // synchronous retorna número: 0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA.
  const value = Number(rows?.[0]?.synchronous)
  assert.equal(value, 1, `synchronous esperado 1 (NORMAL), obtido ${value}`)
})

test('ready resolve rápido (<2s)', async () => {
  const result = await Promise.race([
    ready.then(() => 'resolved'),
    new Promise(r => setTimeout(() => r('timeout'), 2000)),
  ])
  assert.equal(result, 'resolved', 'ready deveria resolver em < 2s')
})

