#!/usr/bin/env node
// One-shot: reseta para o default do schema os campos legados de
// BotConfig (platforms, blockedKeywords, welcomeMsg, postToStatus) que
// hoje não têm mais superfície de UI em /painel/configuracoes (a página
// foi reduzida para só e-mail/senha — ver PR #1258). `postToStatus` em
// especial nunca funcionou de fato (nunca passava `statusJidList` pro
// Baileys, então o toggle não tinha efeito real no envio pro Status).
//
// Reset, não remoção: os campos e o modelo BotConfig continuam existindo
// (branding/couponLink/copyVariation etc. seguem em uso). Só zera os 4
// campos legados de volta ao default de prisma/schema.prisma, para não
// deixar dado morto/inacessível apontando pra uma feature sem UI.
//
// Idempotente: só grava (e só conta) linhas que hoje DIVERGEM do default;
// rodar de novo depois de já ter zerado não faz nada.
//
// Uso:
//   node scripts/reset-legacy-botconfig-fields.mjs           # dry-run (só lista)
//   node scripts/reset-legacy-botconfig-fields.mjs --apply   # aplica de verdade
//
// Pré-requisito (pegadinha #8 do AGENTS.md): esses UPDATEs são DML puro
// (não ALTER TABLE), convivem com o WAL sem precisar parar a API. Ainda
// assim, em produção, rode `scripts/backup_prod.sh` antes por precaução.

import 'dotenv/config'
import db from '../src/db.js'

const DEFAULTS = {
  platforms: 'shopee,amazon,mercadolivre,magazineluiza,shein',
  blockedKeywords: '',
  welcomeMsg: '',
  postToStatus: false,
}

function diffFields(row) {
  const changed = {}
  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    if (row[key] !== defaultValue) changed[key] = { from: row[key], to: defaultValue }
  }
  return changed
}

async function main() {
  const apply = process.argv.includes('--apply')

  const rows = await db.botConfig.findMany({
    select: { id: true, userId: true, platforms: true, blockedKeywords: true, welcomeMsg: true, postToStatus: true, user: { select: { email: true } } },
  })

  const affected = rows
    .map((row) => ({ row, changed: diffFields(row) }))
    .filter(({ changed }) => Object.keys(changed).length > 0)

  if (!affected.length) {
    console.log('Nenhuma linha de BotConfig diverge dos defaults legados. Nada a fazer.')
    return
  }

  console.log(`${affected.length} conta(s) com campos legados customizados:`)
  for (const { row, changed } of affected) {
    console.log(`  - ${row.user?.email ?? row.userId}: ${Object.keys(changed).join(', ')}`)
  }

  if (!apply) {
    console.log('\nDry-run (nenhuma escrita feita). Rode com --apply para resetar de verdade.')
    return
  }

  let updated = 0
  for (const { row } of affected) {
    await db.botConfig.update({ where: { id: row.id }, data: DEFAULTS })
    updated += 1
  }
  console.log(`\n✓ ${updated} conta(s) resetada(s) para os defaults.`)
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('✗ Falha no reset:', err.message)
    await db.$disconnect().catch(() => {})
    process.exit(1)
  })
