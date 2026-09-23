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

// sqlite3 CLI é pré-requisito destes testes (aplicam a migration SQL de verdade).
// Em CI/staging está instalado; num runtime sem o binário, skipamos em vez de
// falhar — mesma convenção de test/backup-scripts.test.js.
function hasSqlite3() {
  try { execFileSync('sqlite3', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
}
const skipNoSqlite3 = { skip: hasSqlite3() ? false : 'sqlite3 CLI não instalado' }

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

test('migration atualiza templates persistidos de todos os usuários e preserva JSON inválido', skipNoSqlite3, () => {
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

// specs/017-client-coupon-catalog (T028, US4, FR-019/FR-020): {linhaDeCupom}
// sai de templates salvos SEM reescrever o banco — a limpeza acontece na
// leitura, nas duas superfícies que consomem canonicalizeTemplateStore (tela
// de templates e worker).

test('canonicalizeTemplateBody remove {linhaDeCupom} sozinha na linha, sem deixar lacuna', () => {
  const body = 'Título\n{produto}\n{linhaDeCupom}\n{link}'
  assert.equal(canonicalizeTemplateBody(body), 'Título\n{produto}\n{link}')
})

test('canonicalizeTemplateBody remove {linhaDeCupom} colada a outro texto na mesma linha', () => {
  const body = 'Antes {linhaDeCupom} Depois'
  assert.equal(canonicalizeTemplateBody(body), 'Antes  Depois')
})

test('canonicalizeTemplateStoreJson limpa {linhaDeCupom} em overrides e templates personalizados salvos', () => {
  const normalized = JSON.parse(canonicalizeTemplateStoreJson(JSON.stringify({
    overrides: { automatico_classico: '{produto}\n{linhaDeCupom}\n{link}' },
    custom: [{ key: 'tpl_1', name: 'Com cupom velho', body: '{produto}\n{linhaDeCupom}\n{link}' }],
  })))
  assert.doesNotMatch(normalized.overrides.automatico_classico, /linhaDeCupom/)
  assert.doesNotMatch(normalized.custom[0].body, /linhaDeCupom/)
  // não deixa lacuna: nenhuma linha em branco sobrando onde a variável estava
  assert.equal(normalized.overrides.automatico_classico, '{produto}\n{link}')
  assert.equal(normalized.custom[0].body, '{produto}\n{link}')
})

test('canonicalizeTemplateBody não afeta {preçoDoTexto} nem outras variáveis', () => {
  const body = '{produto}\n{preçoDoTexto}\n{linhaDeCupom}\n{link}\n{loja}'
  const result = canonicalizeTemplateBody(body)
  assert.match(result, /\{preçoDoTexto\}/)
  assert.match(result, /\{produto\}/)
  assert.match(result, /\{link\}/)
  assert.match(result, /\{loja\}/)
  assert.doesNotMatch(result, /linhaDeCupom/)
})
