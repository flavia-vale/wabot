#!/usr/bin/env node
// LGPD — atendimento manual a solicitações do titular (exportação/exclusão).
//
// Processo MANUAL operado por admin. NÃO é um endpoint público (Onda 2).
//
// Uso:
//   node scripts/lgpd_data_request.mjs export <userId> [arquivo.json]
//   node scripts/lgpd_data_request.mjs anonymize <userId> --confirm
//
// export:    grava um JSON com os dados pessoais do titular (PII redigida onde
//            aplicável). Operação somente-leitura.
// anonymize: APAGA os dados operacionais do titular e anonimiza a linha User
//            in-place. Preserva o ledger financeiro (Payment/AffiliateCommission)
//            por obrigação de retenção. DESTRUTIVO — exige --confirm.
//
// Recomendações operacionais:
//   - Rodar `scripts/backup_prod.sh` ANTES de anonymize em produção.
//   - Parar a API (`pm2 stop api`) antes de anonymize evita SQLITE_BUSY
//     (pegadinha #8) e impede o titular de gerar novos dados durante a operação.
//   - Após anonymize, apagar manualmente o auth_info da sessão do titular
//     (AUTH_INFO_DIR/<userId>) — fora do banco.

import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import db from '../src/db.js'
import { collectUserExport, anonymizeUser } from '../src/domain/lgpd/dataRequest.js'

function fail(msg) {
  console.error(`ERRO: ${msg}`)
  process.exit(1)
}

async function main() {
  const [, , action, userId, ...rest] = process.argv
  if (!action || !userId) {
    fail('uso: lgpd_data_request.mjs <export|anonymize> <userId> [...]')
  }

  if (action === 'export') {
    const outPath = rest.find((a) => !a.startsWith('--')) || `lgpd-export-${userId}.json`
    const data = await collectUserExport(db, userId)
    writeFileSync(outPath, JSON.stringify(data, null, 2))
    console.log(`Exportação concluída: ${outPath}`)
    console.log('Modelos incluídos:', Object.keys(data).filter((k) => Array.isArray(data[k])).join(', '))
    return
  }

  if (action === 'anonymize') {
    if (!rest.includes('--confirm')) {
      fail('anonymize é destrutivo. Releia o usuário e rode novamente com --confirm.\n' +
        '  Recomendado: backup_prod.sh + pm2 stop api antes.')
    }
    const summary = await anonymizeUser(db, userId)
    console.log('Anonimização concluída para', userId)
    console.log('Registros apagados por modelo:')
    for (const [model, count] of Object.entries(summary.purged)) {
      console.log(`  ${model}: ${count}`)
    }
    console.log('Linha User anonimizada (PII removida; ledger financeiro preservado).')
    console.log('LEMBRETE: apague o auth_info da sessão deste usuário em AUTH_INFO_DIR manualmente.')
    return
  }

  fail(`ação desconhecida: ${action}`)
}

main()
  .catch((err) => fail(err?.message ?? String(err)))
  .finally(async () => { try { await db.$disconnect() } catch {} })
