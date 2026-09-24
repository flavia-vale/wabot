import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// RCA 2026-07-28 (atraso entre canais segurando a fila): a migration baixa o
// default do channelStaggerJitterMs de 90s para 20s SEM sobrescrever quem
// escolheu um valor próprio (inclusive 0). Migration DML puro — não altera
// nenhuma outra coluna.
const migrationPath = new URL('../prisma/migrations/20260728120000_channel_stagger_default_20s/migration.sql', import.meta.url)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}

// sqlite3 CLI é pré-requisito destes testes (aplicam a migration SQL de verdade).
// Em CI/staging está instalado; num runtime sem o binário, skipamos em vez de
// falhar — mesma convenção de test/migrations-group-image-mode-preview.test.js.
function hasSqlite3() {
  try { execFileSync('sqlite3', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
}
const skipNoSqlite3 = { skip: hasSqlite3() ? false : 'sqlite3 CLI não instalado' }

test('migration troca só o default antigo (90s -> 20s), preserva valor escolhido e é idempotente', skipNoSqlite3, () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-channel-stagger-migration-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE "BotConfig" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "channelStaggerJitterMs" INTEGER NOT NULL DEFAULT 90000,
        "channelMinIntervalSec" INTEGER NOT NULL DEFAULT 30
      );
      INSERT INTO "BotConfig" (id, userId, "channelStaggerJitterMs") VALUES
        ('c-default', 'u1', 90000),
        ('c-zero', 'u2', 0),
        ('c-custom', 'u3', 120000),
        ('c-ja-20', 'u4', 20000);
    `)

    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))

    const rowsAfterFirstRun = JSON.parse(sqlite(dbPath, `
      SELECT id, "channelStaggerJitterMs" AS stagger, "channelMinIntervalSec" AS minInterval
      FROM "BotConfig" ORDER BY id;
    `, ['-json']))
    const byId = Object.fromEntries(rowsAfterFirstRun.map(r => [r.id, r]))

    // Quem estava no default antigo passa para 20s.
    assert.equal(byId['c-default'].stagger, 20000)
    // Escolhas explícitas do cliente sobrevivem — inclusive o 0 (sem espera).
    assert.equal(byId['c-zero'].stagger, 0)
    assert.equal(byId['c-custom'].stagger, 120000)
    assert.equal(byId['c-ja-20'].stagger, 20000)
    // Nenhuma outra coluna foi tocada.
    assert.equal(byId['c-default'].minInterval, 30)

    // Idempotência: rodar 2x converge para o mesmo estado, sem erro.
    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))
    const rowsAfterSecondRun = JSON.parse(sqlite(dbPath, `
      SELECT id, "channelStaggerJitterMs" AS stagger, "channelMinIntervalSec" AS minInterval
      FROM "BotConfig" ORDER BY id;
    `, ['-json']))
    assert.deepEqual(rowsAfterSecondRun, rowsAfterFirstRun)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// O default de 20s foi substituído em 2026-09-24 (intervalo passou a ser
// opcional): a guarda do default atual (0) está em
// test/migrations-channel-stagger-opt-in.test.js.
