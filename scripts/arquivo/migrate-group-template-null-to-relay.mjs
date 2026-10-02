#!/usr/bin/env node
// Migração one-shot: converte grupos com templateKey=null para templateKey=''
// (relay = "Manter texto original convertido").
//
// Contexto: o painel removeu a opção "Usar padrão global" do select de
// formato de mensagem. Grupos com templateKey=null herdavam o template
// global — comportamento opaco para o usuário. A migração seta templateKey=''
// (relay), que mantém o texto original convertido: equivalente prático para
// a maioria dos usuários e consistente com o que o painel passou a exibir.
//
// Idempotente: re-rodar não afeta linhas que já têm templateKey definida.
//
// Pré-requisitos:
//   - Parar a API antes de rodar para evitar SQLITE_BUSY (pegadinha #8).
//     Em staging: pm2 stop api-staging
//     Em produção: pm2 stop api (rode scripts/backup_prod.sh antes)
//
// Uso:
//   cd ~/wabot-staging && node scripts/migrate-group-template-null-to-relay.mjs
//   cd ~/wabot         && node scripts/migrate-group-template-null-to-relay.mjs

import 'dotenv/config'
import db from '../src/db.js'

async function main() {
  const rows = await db.group.findMany({
    where: { templateKey: null, role: 'monitor' },
    select: { id: true, userId: true, name: true },
  })

  console.log(`Grupos com templateKey=null (monitor): ${rows.length}`)
  if (rows.length === 0) {
    console.log('Nada a migrar.')
    return
  }

  let updated = 0
  for (const row of rows) {
    await db.group.update({ where: { id: row.id }, data: { templateKey: '' } })
    console.log(`  ✓ [${row.id}] "${row.name}" (user ${row.userId})`)
    updated += 1
  }

  console.log(`\nMigração concluída: ${updated} grupo(s) atualizados.`)
}

main()
  .catch((err) => { console.error('Erro na migração:', err); process.exit(1) })
  .finally(() => db.$disconnect())
