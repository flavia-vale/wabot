import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const migrationPath = new URL('../prisma/migrations/20260611120000_independent_preservation_features/migration.sql', import.meta.url)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}

test('migration converte o master toggle em flags independentes sem ativar mutação indevidamente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-preservation-migration-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE BotConfig (
        id TEXT PRIMARY KEY,
        preservationEnabled BOOLEAN NOT NULL DEFAULT false,
        imageMutationEnabled BOOLEAN NOT NULL DEFAULT true
      );
      INSERT INTO BotConfig VALUES
        ('master-off-image-on', false, true),
        ('master-on-image-on', true, true),
        ('master-on-image-off', true, false);
    `)
    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))
    sqlite(dbPath, `INSERT INTO BotConfig (id) VALUES ('new-user');`)

    const rows = JSON.parse(sqlite(dbPath, `
      SELECT id, channelThrottleEnabled, quietHoursEnabled, followGuardEnabled,
             copyVariationEnabled, imageMutationActive
      FROM BotConfig ORDER BY id;
    `, ['-json']))

    assert.deepEqual(rows, [
      { id: 'master-off-image-on', channelThrottleEnabled: 0, quietHoursEnabled: 0, followGuardEnabled: 0, copyVariationEnabled: 0, imageMutationActive: 0 },
      { id: 'master-on-image-off', channelThrottleEnabled: 1, quietHoursEnabled: 1, followGuardEnabled: 1, copyVariationEnabled: 1, imageMutationActive: 0 },
      { id: 'master-on-image-on', channelThrottleEnabled: 1, quietHoursEnabled: 1, followGuardEnabled: 1, copyVariationEnabled: 1, imageMutationActive: 1 },
      { id: 'new-user', channelThrottleEnabled: 0, quietHoursEnabled: 0, followGuardEnabled: 0, copyVariationEnabled: 0, imageMutationActive: 0 },
    ])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('migration declara false como default para todos os novos opt-ins', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  for (const field of ['channelThrottleEnabled', 'quietHoursEnabled', 'followGuardEnabled', 'copyVariationEnabled', 'imageMutationActive']) {
    assert.match(sql, new RegExp(`ADD COLUMN "${field}" BOOLEAN NOT NULL DEFAULT false`))
  }
})
