// Guarda: toda coluna que as migrations criam precisa existir no schema.prisma.
//
// POR QUE EXISTE (incidente 2026-09-09): a migration
// `20260909120000_user_blocked_reason` criou `blockedReason`/`blockedAt` e o
// código passou a lê-los, mas a DECLARAÇÃO sumiu do schema na resolução de um
// conflito entre duas branches que mexiam no mesmo model. O banco tinha as
// colunas, o código as usava, e o Prisma Client não as conhecia — `GET /me`
// passaria a lançar em toda chamada, derrubando o painel inteiro.
//
// Nenhum teste pegava isso: os testes de rota são estruturais (leem o source) e
// os de banco não tocavam nesses campos. É a mesma família da pegadinha #10 do
// AGENTS.md — duas PRs paralelas mergeiam sem conflito textual e ainda assim
// quebram develop.
//
// Puro: lê arquivos, sem banco e sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('..', import.meta.url).pathname
const schema = readFileSync(join(raiz, 'prisma/schema.prisma'), 'utf8')
const migracoesDir = join(raiz, 'prisma/migrations')

/**
 * Colunas que EXISTEM no banco de propósito e não estão mais no schema —
 * resto de feature removida. O Prisma ignora coluna que ele não declara, e
 * `feedGlobal` é `NOT NULL DEFAULT false`, então nenhuma escrita quebra por
 * causa dela. Entrar aqui exige saber que nenhum código usa o campo.
 */
const ORFAS_CONHECIDAS = new Set([
  'BotConfig.feedGlobal',
])

/** Colunas adicionadas por ALTER TABLE em todas as migrations. */
function colunasAdicionadas() {
  const encontradas = []
  for (const pasta of readdirSync(migracoesDir)) {
    const arquivo = join(migracoesDir, pasta, 'migration.sql')
    let sql = ''
    try { sql = readFileSync(arquivo, 'utf8') } catch { continue }
    const re = /ALTER\s+TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+"?(\w+)"?/gi
    let m
    while ((m = re.exec(sql)) !== null) {
      encontradas.push({ tabela: m[1], coluna: m[2], migration: pasta })
    }
  }
  return encontradas
}

/** Corpo do model, para procurar o campo no lugar certo. */
function corpoDoModel(nome) {
  const inicio = schema.indexOf(`model ${nome} {`)
  if (inicio < 0) return null
  const fim = schema.indexOf('\n}', inicio)
  return schema.slice(inicio, fim)
}

test('toda coluna criada por migration está declarada no schema.prisma', () => {
  const faltando = []
  for (const { tabela, coluna, migration } of colunasAdicionadas()) {
    const corpo = corpoDoModel(tabela)
    // Model que não existe mais no schema é outro assunto (tabela removida);
    // aqui só cobramos o que ainda está declarado.
    if (!corpo) continue
    if (ORFAS_CONHECIDAS.has(`${tabela}.${coluna}`)) continue
    const declarado = new RegExp(`^\\s*${coluna}\\s`, 'm').test(corpo)
    if (!declarado) faltando.push(`${tabela}.${coluna} (migration ${migration})`)
  }
  assert.deepEqual(
    faltando,
    [],
    `coluna existe no banco e o Prisma Client não conhece — toda leitura desses campos lança:\n  ${faltando.join('\n  ')}`,
  )
})
