import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Feature 017 (arquitetura multicanal de entrega) — princípio inegociável do
// data-model.md: TODA mudança de banco desta feature é ADITIVA. Nenhuma
// coluna é renomeada, nenhuma é removida, nenhum dado existente é reescrito
// (FR-012). Este teste varre a migration desta feature (e qualquer migration
// futura que casar com o mesmo prefixo de pasta) e falha se ela contiver
// DROP, RENAME ou qualquer reescrita das colunas críticas que carregam a
// identidade dos destinos/registros já gravados.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations')

// Prefixo usado por TODA migration desta feature (T007/T008 e o que vier
// depois nas fatias seguintes) — não é só a migration de hoje.
const FEATURE_MIGRATION_NAME_RE = /delivery_network|delivery_outbox|delivery_inbox/i

// Colunas que carregam identidade/dado de destinos e registros já gravados
// hoje. Uma migration desta feature nunca pode reescrever o CONTEÚDO delas
// (um UPDATE que troque o valor), embora ADD COLUMN na mesma tabela seja
// normal e esperado.
const PROTECTED_COLUMN_REWRITE_RES = [
  /UPDATE\s+"Group"\s+SET[^;]*"waJid"\s*=/i,
  /UPDATE\s+"OfferAutomation"\s+SET[^;]*"destGroupJid"\s*=/i,
  /UPDATE\s+"OfferQueueItem"\s+SET[^;]*"targetJids"\s*=/i,
  /UPDATE\s+"ScheduledMessage"\s+SET[^;]*"targetJids"\s*=/i,
  /UPDATE\s+"MessageLog"\s+SET[^;]*"destGroup"\s*=/i,
]

function listMigrationFolders() {
  return readdirSync(migrationsDir).filter((name) => {
    const full = path.join(migrationsDir, name)
    return statSync(full).isDirectory() && FEATURE_MIGRATION_NAME_RE.test(name)
  })
}

test('a migration desta feature existe', () => {
  const folders = listMigrationFolders()
  assert.ok(folders.length > 0, 'esperava encontrar ao menos uma pasta de migration desta feature em prisma/migrations')
})

test('a migration desta feature nunca contém DROP nem RENAME', () => {
  const folders = listMigrationFolders()
  for (const folder of folders) {
    const sql = readFileSync(path.join(migrationsDir, folder, 'migration.sql'), 'utf8')
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|INDEX)\b/i, `${folder}: migration aditiva não pode conter DROP`)
    assert.doesNotMatch(sql, /\bRENAME\s+(TO|COLUMN)\b/i, `${folder}: migration aditiva não pode conter RENAME`)
  }
})

test('a migration desta feature nunca reescreve o conteúdo das colunas críticas de identidade', () => {
  const folders = listMigrationFolders()
  for (const folder of folders) {
    const sql = readFileSync(path.join(migrationsDir, folder, 'migration.sql'), 'utf8')
    for (const re of PROTECTED_COLUMN_REWRITE_RES) {
      assert.doesNotMatch(sql, re, `${folder}: migration não pode reescrever coluna crítica de identidade (${re})`)
    }
  }
})

test('a migration desta feature só adiciona: ADD COLUMN e CREATE TABLE, nada mais destrutivo', () => {
  const folders = listMigrationFolders()
  for (const folder of folders) {
    const sql = readFileSync(path.join(migrationsDir, folder, 'migration.sql'), 'utf8')
    // Sem ALTER TABLE que não seja ADD COLUMN (ex.: MODIFY, ALTER COLUMN).
    const alterMatches = sql.match(/ALTER TABLE\s+"[A-Za-z0-9_]+"\s+([A-Z ]+)/gi) || []
    for (const m of alterMatches) {
      assert.match(m, /ADD COLUMN/i, `alteração de tabela não reconhecida como aditiva: "${m}"`)
    }
  }
})
