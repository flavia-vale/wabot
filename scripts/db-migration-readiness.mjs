import 'dotenv/config'

function fail(message) {
  console.error(`[db-readiness] ${message}`)
  process.exitCode = 1
}

function ok(message) {
  console.log(`[db-readiness] ${message}`)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  fail('DATABASE_URL não está definido.')
  process.exit(1)
}

const isSqlite = databaseUrl.startsWith('file:')
const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl)

if (!isSqlite && !isPostgres) {
  fail('DATABASE_URL deve ser sqlite (file:) ou postgres (postgres:// / postgresql://).')
}

if (isPostgres) {
  if (!process.env.DATABASE_URL.includes('@')) {
    fail('DATABASE_URL postgres parece inválido (sem credenciais/host).')
  } else {
    ok('Formato de DATABASE_URL postgres parece válido.')
  }
}

if (isSqlite) {
  ok('Banco atual em SQLite (modo legado).')
}

if (process.exitCode !== 1) {
  ok('Preflight de migração concluído.')
}
