import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Incidente 2026-09-24: "Intervalo entre destinos" passa a ser opcional. Toda
// conta volta para 0 e contas novas nascem com 0 — só liga quem escolher.
const migrationPath = new URL('../prisma/migrations/20260924190000_channel_stagger_opt_in/migration.sql', import.meta.url)
const root = new URL('../', import.meta.url)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}
function hasSqlite3() {
  try { execFileSync('sqlite3', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
}
const skipNoSqlite3 = { skip: hasSqlite3() ? false : 'sqlite3 CLI não instalado' }

test('migration zera o intervalo de todas as contas e é idempotente', skipNoSqlite3, () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-stagger-opt-in-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE "BotConfig" ("id" TEXT PRIMARY KEY, "channelStaggerJitterMs" INTEGER NOT NULL DEFAULT 20000, "delayMin" INTEGER NOT NULL DEFAULT 5);
      INSERT INTO "BotConfig" (id, "channelStaggerJitterMs", "delayMin") VALUES ('a', 20000, 7), ('b', 120000, 7), ('c', 0, 7);
    `)
    const sql = readFileSync(migrationPath, 'utf8')
    sqlite(dbPath, sql)
    sqlite(dbPath, sql)
    const rows = JSON.parse(sqlite(dbPath, 'SELECT id, "channelStaggerJitterMs" AS s, "delayMin" AS d FROM "BotConfig" ORDER BY id;', ['-json']))
    for (const r of rows) {
      assert.equal(r.s, 0)
      assert.equal(r.d, 7)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('conta nova nasce sem intervalo entre destinos (schema e criação explícita)', () => {
  const schema = readFileSync(new URL('prisma/schema.prisma', root), 'utf8')
  assert.match(schema, /channelStaggerJitterMs\s+Int\s+@default\(0\)/)
  // O DEFAULT físico da coluna em bancos existentes continua 20000; por isso
  // o cadastro grava 0 explicitamente.
  const auth = readFileSync(new URL('src/api/routes/auth.js', root), 'utf8')
  assert.match(auth, /botConfig\.create\(\{\s*data: \{[^}]*channelStaggerJitterMs: 0/)
})
