import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// specs/001-image-mode-preview-default (US2, AC-1/AC-2): fixa imageMode em
// 'preview' para todos os grupos existentes, qualquer que fosse o valor
// legado/nulo, e confirma idempotência (rodar 2x converge para o mesmo
// estado, sem erro). Migration DML puro — não altera nenhuma outra coluna.
const migrationPath = new URL('../prisma/migrations/20260710160000_group_image_mode_preview_default/migration.sql', import.meta.url)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}

test('migration fixa imageMode=preview para todos os grupos existentes (fetch/original/none/null/preview) e é idempotente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-image-mode-preview-migration-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE "Group" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "waJid" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "imageMode" TEXT,
        "imageLinkTarget" TEXT NOT NULL DEFAULT 'first'
      );
      INSERT INTO "Group" (id, userId, waJid, name, role, imageMode) VALUES
        ('g-fetch', 'u1', 'a@g.us', 'A', 'monitor', 'fetch'),
        ('g-original', 'u1', 'b@g.us', 'B', 'monitor', 'original'),
        ('g-none', 'u1', 'c@g.us', 'C', 'monitor', 'none'),
        ('g-null', 'u1', 'd@g.us', 'D', 'monitor', NULL),
        ('g-preview', 'u1', 'e@g.us', 'E', 'monitor', 'preview'),
        ('g-legacy', 'u1', 'f@g.us', 'F', 'monitor', 'legado-desconhecido');
    `)

    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))

    const rowsAfterFirstRun = JSON.parse(sqlite(dbPath, `
      SELECT id, "imageMode", "imageLinkTarget" FROM "Group" ORDER BY id;
    `, ['-json']))
    for (const row of rowsAfterFirstRun) {
      assert.equal(row.imageMode, 'preview', `esperava imageMode='preview' para ${row.id}`)
    }
    // Nenhuma outra coluna foi tocada.
    assert.equal(rowsAfterFirstRun.find(r => r.id === 'g-fetch').imageLinkTarget, 'first')

    // Idempotência: rodar 2x converge para o mesmo estado, sem erro.
    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))
    const rowsAfterSecondRun = JSON.parse(sqlite(dbPath, `
      SELECT id, "imageMode" FROM "Group" ORDER BY id;
    `, ['-json']))
    assert.deepEqual(rowsAfterSecondRun, rowsAfterFirstRun.map(({ id, imageMode }) => ({ id, imageMode })))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
