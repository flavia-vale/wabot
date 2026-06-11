import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalizeTemplateBody, canonicalizeTemplateStoreJson } from '../src/core/templateVariables.js'

const migrationPath = new URL('../prisma/migrations/20260611190000_canonicalize_template_variables/migration.sql', import.meta.url)

function sqlite(dbPath, sql, args = []) {
  return execFileSync('sqlite3', [...args, dbPath], { input: sql, encoding: 'utf8' }).trim()
}

test('canonicaliza apenas os aliases legados de variáveis de template', () => {
  assert.equal(
    canonicalizeTemplateBody('{{greeting}}|{{trailer}}|{{gancho}}|{{cta}}|{{convitegrupo}}'),
    '{{gancho}}|{{convitegrupo}}|{{gancho}}|{{cta}}|{{convitegrupo}}',
  )
})

test('canonicaliza overrides e templates personalizados ao salvar ou carregar', () => {
  const normalized = JSON.parse(canonicalizeTemplateStoreJson(JSON.stringify({
    overrides: { automatico_classico: '{{greeting}} A {{trailer}}' },
    custom: [{ key: 'tpl_1', name: 'Legado', body: '{{greeting}} B {{trailer}}' }],
    extra: 'preservado',
  })))
  assert.equal(normalized.overrides.automatico_classico, '{{gancho}} A {{convitegrupo}}')
  assert.equal(normalized.custom[0].body, '{{gancho}} B {{convitegrupo}}')
  assert.equal(normalized.extra, 'preservado')
})

test('migration atualiza templates persistidos de todos os usuários e preserva JSON inválido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-template-vars-'))
  const dbPath = join(dir, 'test.db')
  try {
    sqlite(dbPath, `
      CREATE TABLE BotConfig (id TEXT PRIMARY KEY, mobileTemplatesJson TEXT NOT NULL);
      INSERT INTO BotConfig VALUES
        ('legacy', '{"overrides":{"automatico_classico":"{{greeting}} A {{trailer}}"},"custom":[{"key":"tpl_1","name":"X","body":"{{greeting}} B {{trailer}}"}]}'),
        ('canonical', '{"overrides":{"simples":"{{gancho}} C {{cta}} {{convitegrupo}}"},"custom":[]}'),
        ('invalid', 'não é json');
    `)
    sqlite(dbPath, readFileSync(migrationPath, 'utf8'))
    const rows = JSON.parse(sqlite(dbPath, 'SELECT id, mobileTemplatesJson FROM BotConfig ORDER BY id;', ['-json']))
    const byId = Object.fromEntries(rows.map(row => [row.id, row.mobileTemplatesJson]))
    assert.doesNotMatch(byId.legacy, /greeting|trailer/)
    assert.match(byId.legacy, /\{\{gancho\}\}/)
    assert.match(byId.legacy, /\{\{convitegrupo\}\}/)
    assert.equal(byId.canonical, '{"overrides":{"simples":"{{gancho}} C {{cta}} {{convitegrupo}}"},"custom":[]}')
    assert.equal(byId.invalid, 'não é json')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
