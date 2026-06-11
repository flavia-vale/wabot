import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const migrationPath = new URL('../prisma/migrations/20260611183000_swap_cta_invite_variations/migration.sql', import.meta.url)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}

test('migration troca CTA e convite do grupo para todas as configurações canônicas existentes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-copy-variation-swap-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE BotConfig (
        id TEXT PRIMARY KEY,
        copyVariationPoolJson TEXT NOT NULL
      );
      INSERT INTO BotConfig VALUES
        ('custom', '{"greetings":["GANCHO"],"ctas":["CONVITE CUSTOM"],"trailers":["CTA CUSTOM"],"extra":"preservar"}'),
        ('blank', '{"greetings":[""],"ctas":[""],"trailers":[]}'),
        ('invalid', 'não é json');
    `)

    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))

    const rows = JSON.parse(sqlite(dbPath, `
      SELECT id, copyVariationPoolJson FROM BotConfig ORDER BY id;
    `, ['-json']))

    const byId = Object.fromEntries(rows.map(row => [row.id, row.copyVariationPoolJson]))
    assert.deepEqual(JSON.parse(byId.custom), {
      greetings: ['GANCHO'],
      ctas: ['CTA CUSTOM'],
      trailers: ['CONVITE CUSTOM'],
      extra: 'preservar',
    })
    assert.deepEqual(JSON.parse(byId.blank), {
      greetings: [''],
      ctas: [],
      trailers: [''],
    })
    assert.equal(byId.invalid, 'não é json')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
