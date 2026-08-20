import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// specs/012-shein-store-support (B6): acrescenta 'shein' ao CSV de
// BotConfig.platforms de todas as contas existentes, sem tocar em nenhuma
// outra coluna e sem ALTER TABLE. Confirma idempotência (rodar 2x converge
// para o mesmo estado) e que uma linha que já tem 'shein' não é duplicada.
const migrationPath = new URL(
  '../prisma/migrations/20260817120000_botconfig_platforms_add_shein/migration.sql',
  import.meta.url,
)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}

function hasSqlite3() {
  try { execFileSync('sqlite3', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
}
const skipNoSqlite3 = { skip: hasSqlite3() ? false : 'sqlite3 CLI não instalado' }

test('migration é DML puro (sem ALTER TABLE)', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.doesNotMatch(sql, /ALTER TABLE/i)
  assert.match(sql, /UPDATE\s+"BotConfig"/i)
})

test('migration acrescenta shein a todas as linhas existentes, preservando outras colunas, e é idempotente', skipNoSqlite3, () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-botconfig-platforms-shein-migration-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE "BotConfig" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "platforms" TEXT NOT NULL,
        "delayMin" INTEGER NOT NULL DEFAULT 5
      );
      INSERT INTO "BotConfig" (id, userId, platforms, delayMin) VALUES
        ('c-default', 'u1', 'shopee,amazon,mercadolivre,magazineluiza', 7),
        ('c-partial', 'u2', 'shopee,amazon', 3),
        ('c-already', 'u3', 'shopee,amazon,mercadolivre,magazineluiza,shein', 9),
        ('c-empty', 'u4', '', 5),
        ('c-single', 'u5', 'shopee', 12);
    `)

    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))

    const rowsAfterFirstRun = JSON.parse(sqlite(dbPath, `
      SELECT id, "platforms", "delayMin" FROM "BotConfig" ORDER BY id;
    `, ['-json']))

    for (const row of rowsAfterFirstRun) {
      const list = row.platforms.split(',').filter(Boolean)
      assert.ok(list.includes('shein'), `esperava 'shein' em ${row.id}: ${row.platforms}`)
      // Nenhuma duplicação de 'shein', mesmo na linha que já tinha.
      assert.equal(list.filter((p) => p === 'shein').length, 1, `shein duplicado em ${row.id}`)
    }
    // Outras plataformas preservadas.
    assert.equal(
      rowsAfterFirstRun.find((r) => r.id === 'c-default').platforms,
      'shopee,amazon,mercadolivre,magazineluiza,shein',
    )
    assert.equal(rowsAfterFirstRun.find((r) => r.id === 'c-single').platforms, 'shopee,shein')
    assert.equal(rowsAfterFirstRun.find((r) => r.id === 'c-empty').platforms, ',shein')
    // Nenhuma outra coluna tocada.
    assert.equal(rowsAfterFirstRun.find((r) => r.id === 'c-default').delayMin, 7)

    // Idempotência: rodar 2x converge para o mesmo estado, sem duplicar.
    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))
    const rowsAfterSecondRun = JSON.parse(sqlite(dbPath, `
      SELECT id, "platforms" FROM "BotConfig" ORDER BY id;
    `, ['-json']))
    assert.deepEqual(rowsAfterSecondRun, rowsAfterFirstRun.map(({ id, platforms }) => ({ id, platforms })))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
