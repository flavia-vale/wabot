import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// RCA 2026-08-28: a rota GET /qualidade-entrega foi declarada duas vezes em
// admin.js (copy-paste). O Fastify recusa registrar rota duplicada
// (FST_ERR_DUPLICATED_ROUTE) e o boot inteiro falha ANTES do listen() — a API
// nunca abre a porta e produção fica em 502/loop de restart. Nenhum teste
// existente pega isso: os testes de rota importam só funções puras de
// admin.js, nunca chamam adminRoutes(app) contra uma instância real do
// Fastify. Este teste é estático (regex, sem I/O de rede/DB) de propósito:
// roda em milissegundos e cobre TODOS os arquivos de rota, não só admin.js.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const routesDir = path.join(__dirname, '..', 'src', 'api', 'routes')

const METHOD_CALL_RE = /\bapp\.(get|post|put|patch|delete|head|options)\(\s*(['"`])((?:(?!\2).)*)\2/g

function findDuplicateRoutes(source) {
  const seen = new Map()
  const duplicates = []
  let match
  METHOD_CALL_RE.lastIndex = 0
  while ((match = METHOD_CALL_RE.exec(source))) {
    const [, method, , routePath] = match
    const key = `${method.toUpperCase()} ${routePath}`
    if (seen.has(key)) duplicates.push(key)
    else seen.set(key, true)
  }
  return duplicates
}

test('nenhum arquivo de rota da API declara o mesmo método+caminho duas vezes', () => {
  const files = readdirSync(routesDir).filter((f) => f.endsWith('.js'))
  assert.ok(files.length > 0, 'esperava encontrar arquivos de rota em src/api/routes')

  const offenders = []
  for (const file of files) {
    const source = readFileSync(path.join(routesDir, file), 'utf8')
    const duplicates = findDuplicateRoutes(source)
    if (duplicates.length > 0) offenders.push(`${file}: ${duplicates.join(', ')}`)
  }

  assert.deepEqual(
    offenders,
    [],
    `Rota(s) duplicada(s) encontradas — isso derruba o boot da API inteira (FST_ERR_DUPLICATED_ROUTE):\n${offenders.join('\n')}`
  )
})
