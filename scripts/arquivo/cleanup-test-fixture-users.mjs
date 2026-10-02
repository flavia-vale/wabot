#!/usr/bin/env node
/**
 * Limpeza de usuários de FIXTURE de teste que vazaram para um banco real.
 *
 * Contexto (2026-06): a suíte de testes (`node --test`) importa `src/db.js`
 * direto, e `new PrismaClient()` usa o `DATABASE_URL` do ambiente. Rodar os
 * testes de dentro de `~/wabot` (DATABASE_URL apontando para prod.db) gravou
 * usuários sintéticos (`*@test.local`, `*@tests.local`, `*@t.local`,
 * `*@channel-test.local`) no banco de PRODUÇÃO. O guard em `src/db.js` agora
 * impede a reincidência; este script remove os resíduos que já existem.
 *
 * Critério de seleção: e-mail terminando em `.local`. `.local` é um TLD
 * reservado (mDNS / RFC 6762) — nenhum usuário real tem e-mail nesse domínio,
 * então o filtro é seguro. Todas as relações com User são `onDelete: Cascade`
 * no schema, então deletar o usuário leva junto MessageLog, Group, Credential,
 * ScheduledMessage etc. (SQLite com foreign_keys=ON, default do Prisma).
 *
 * Uso:
 *   # dry-run (NÃO deleta nada — só lista o que seria removido):
 *   node scripts/cleanup-test-fixture-users.mjs
 *
 *   # aplicar de verdade (deleta):
 *   node scripts/cleanup-test-fixture-users.mjs --apply
 *
 * IMPORTANTE — antes de rodar com --apply em PRODUÇÃO:
 *   1. pm2 stop api          (evita SQLITE_BUSY — pegadinha #8 do AGENTS.md)
 *   2. scripts/backup_prod.sh
 *   3. node scripts/cleanup-test-fixture-users.mjs           (dry-run, confira)
 *   4. node scripts/cleanup-test-fixture-users.mjs --apply
 *   5. pm2 start ecosystem.config.cjs --only api && pm2 save
 */

import db from '../src/db.js'

const APPLY = process.argv.includes('--apply')

// Sufixos de domínio considerados fixture de teste. `.local` cobre todos os
// padrões observados (test.local, tests.local, t.local, channel-test.local).
const TEST_EMAIL_SUFFIX = '.local'

function isFixtureEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(TEST_EMAIL_SUFFIX)
}

async function main() {
  // Filtro grosso no banco (LIKE), refinado em memória pelo endsWith para
  // evitar falso-positivo de um e-mail real que contenha ".local" no meio.
  const candidates = await db.user.findMany({
    where: { email: { endsWith: TEST_EMAIL_SUFFIX } },
    select: { id: true, email: true, plan: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const targets = candidates.filter((u) => isFixtureEmail(u.email))

  if (!targets.length) {
    console.log('Nenhum usuário de fixture (.local) encontrado. Nada a fazer.')
    return
  }

  console.log(`Encontrados ${targets.length} usuário(s) de fixture (e-mail terminando em "${TEST_EMAIL_SUFFIX}"):\n`)
  for (const u of targets) {
    console.log(`  - ${u.email}  [id=${u.id} plano=${u.plan} criado=${u.createdAt.toISOString()}]`)
  }
  console.log('')

  if (!APPLY) {
    console.log('DRY-RUN: nada foi deletado. Rode novamente com --apply para remover.')
    console.log('(Em produção: pm2 stop api + backup ANTES — veja o cabeçalho do script.)')
    return
  }

  const ids = targets.map((u) => u.id)
  const result = await db.user.deleteMany({ where: { id: { in: ids } } })
  console.log(`OK: ${result.count} usuário(s) deletado(s) (relações em cascata removidas pelo schema).`)
}

main()
  .catch((err) => {
    console.error('Falha na limpeza:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
