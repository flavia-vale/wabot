import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// RCA 2026-08-28: dois PRs desenvolvidos em paralelo (implementação original
// de "marca d'água por destino" + a reimplementação que corrigiu os bugs da
// revisão) cada um criou sua PRÓPRIA migration fazendo
// `ALTER TABLE "Group" ADD COLUMN "watermarkText"`. Nenhuma das duas colidia
// textualmente com a outra (nomes de pasta diferentes, timestamps
// diferentes), então o merge do GitHub concatenou as duas sem conflito. A
// primeira aplicou com sucesso no banco de staging durante o deploy do 1º PR;
// quando o deploy do 2º PR rodou logo depois, a segunda migration falhou com
// "duplicate column name" e deixou o banco em estado de MIGRATION FALHA
// (P3009) — todo deploy seguinte para staging continuou falhando até alguém
// rodar `prisma migrate resolve --rolled-back` manualmente no VPS.
//
// Nenhum teste existente pegava isso: os testes de migration individuais
// validam o SQL de uma migration isolada, nunca comparam todas as migrations
// entre si. Este teste é estático (regex sobre os arquivos, sem banco) de
// propósito — roda em milissegundos e cobre o histórico inteiro. Mesmo
// espírito de test/api-routes-no-duplicate-registration.test.js (RCA
// 2026-08-28, rota duplicada derrubando o boot da API).

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations')

// Casa `ALTER TABLE "X" ADD COLUMN "Y"` e `CREATE TABLE "X" (... "Y" ...)`
// não é o alvo aqui — CREATE TABLE duplicado já quebra o SQL na hora (erro
// óbvio, "table already exists"). O perigo específico é ADD COLUMN: cada
// ocorrência isolada é um SQL válido, e só colide quando as DUAS já rodaram
// no banco — daí o efeito só aparecer em produção/staging, nunca localmente.
const ADD_COLUMN_RE = /ALTER TABLE\s+"([A-Za-z0-9_]+)"\s+ADD COLUMN\s+"([A-Za-z0-9_]+)"/gi

function listMigrationFolders() {
  return readdirSync(migrationsDir).filter((name) => {
    const full = path.join(migrationsDir, name)
    return statSync(full).isDirectory()
  })
}

function findAddedColumns(sql) {
  const found = []
  let match
  ADD_COLUMN_RE.lastIndex = 0
  while ((match = ADD_COLUMN_RE.exec(sql))) {
    found.push({ table: match[1], column: match[2] })
  }
  return found
}

test('nenhuma coluna é adicionada por mais de uma migration (evita "duplicate column name" travando o deploy)', () => {
  const folders = listMigrationFolders()
  assert.ok(folders.length > 0, 'esperava encontrar pastas em prisma/migrations')

  // tabela::coluna -> [nomes das migrations que a criam]
  const addedBy = new Map()
  for (const folder of folders) {
    const sqlPath = path.join(migrationsDir, folder, 'migration.sql')
    let sql
    try {
      sql = readFileSync(sqlPath, 'utf8')
    } catch {
      continue // pasta sem migration.sql (não deveria existir, mas não é o alvo deste teste)
    }
    for (const { table, column } of findAddedColumns(sql)) {
      const key = `${table}::${column}`
      if (!addedBy.has(key)) addedBy.set(key, [])
      addedBy.get(key).push(folder)
    }
  }

  const offenders = [...addedBy.entries()]
    .filter(([, migrations]) => migrations.length > 1)
    .map(([key, migrations]) => `${key} adicionada em: ${migrations.join(', ')}`)

  assert.deepEqual(
    offenders,
    [],
    `Coluna(s) adicionada(s) por mais de uma migration — a 2ª falha com ` +
    `"duplicate column name" assim que a 1ª já tiver rodado no banco (só ` +
    `aparece em staging/produção, nunca localmente):\n${offenders.join('\n')}\n\n` +
    `Se as duas migrations vieram de PRs desenvolvidos em paralelo sobre o ` +
    `mesmo campo, apague uma delas (a que ainda não rodou em nenhum ` +
    `ambiente) e deixe só a outra.`,
  )
})
