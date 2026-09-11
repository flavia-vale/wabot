import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const migrationPath = new URL('../prisma/migrations/20260910150000_botconfig_platforms_add_aliexpress/migration.sql', import.meta.url)
function sqlite(dbPath, sql, args = []) { return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim() }
function hasSqlite3() { try { execFileSync('sqlite3', ['--version'], { stdio: 'ignore' }); return true } catch { return false } }

test('migration AliExpress é DML pura e corrige vírgula inicial legada', { skip: hasSqlite3() ? false : 'sqlite3 CLI não instalado' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-aliexpress-migration-'))
  const db = join(dir, 'test.db')
  try {
    sqlite(db, `CREATE TABLE "BotConfig" ("id" TEXT PRIMARY KEY, "platforms" TEXT);
      INSERT INTO "BotConfig" VALUES ('normal','shopee,shein'),('empty',''),('legacy',',shein'),('existing','shopee,aliexpress');`)
    const sql = readFileSync(migrationPath, 'utf8')
    assert.doesNotMatch(sql, /ALTER TABLE/i)
    sqlite(db, sql)
    sqlite(db, sql)
    const rows = JSON.parse(sqlite(db, 'SELECT * FROM "BotConfig" ORDER BY id', ['-json']))
    assert.deepEqual(rows, [
      { id: 'empty', platforms: 'aliexpress' },
      { id: 'existing', platforms: 'shopee,aliexpress' },
      { id: 'legacy', platforms: 'shein,aliexpress' },
      { id: 'normal', platforms: 'shopee,shein,aliexpress' },
    ])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

