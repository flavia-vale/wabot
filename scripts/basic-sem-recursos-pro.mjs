#!/usr/bin/env node
// Divisão Basic/PRO (2026-09-23): tira da configuração de quem NÃO tem o PRO o
// que o Basic deixou de ter — marca d'água (card com marca → card; foto com
// marca → foto), botão "Ver canal" e variação do texto.
//
// O robô já ignora essas escolhas sem o plano (billing/groupEntitlements.js) e
// a tela já mostra sem elas; isto só grava no banco para as três pontas
// dizerem a mesma coisa. A regra mora em src/billing/basicDowngrade.js e é
// IMPORTADA daqui, nunca reescrita.
//
// Read-only por padrão. Grava só com --aplicar. Rodar em staging antes, e em
// produção depois do backup (scripts/backup_prod.sh).
//
//   node scripts/basic-sem-recursos-pro.mjs
//   node scripts/basic-sem-recursos-pro.mjs --aplicar

import 'dotenv/config'
import db from '../src/db.js'
import { planBasicDowngrade } from '../src/billing/basicDowngrade.js'
import { getPlanEntitlements } from '../src/billing/plans.js'

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true, email: true, plan: true, accessExpiresAt: true,
      groups: { where: { role: 'post' }, select: { id: true, name: true, role: true, imageMode: true, channelButtonJid: true } },
      botConfig: { select: { copyVariationEnabled: true } },
    },
  })
  const semPro = users.filter(u => !getPlanEntitlements(u).canUseWatermark)
  console.log(`[1] Contas lidas: ${users.length} | sem o PRO agora: ${semPro.length}`)

  const afetadas = []
  for (const u of semPro) {
    const plano = planBasicDowngrade({ planSubject: u, groups: u.groups, botConfig: u.botConfig })
    if (plano.groupChanges.length || plano.configChange) afetadas.push({ u, plano })
  }
  console.log(`[2] Contas com algo a mudar: ${afetadas.length}`)
  for (const { u, plano } of afetadas) {
    console.log(`    ${u.email ?? u.id} (${u.plan})`)
    for (const c of plano.groupChanges) {
      const partes = []
      if (c.data.imageMode) partes.push(`${c.from.imageMode} → ${c.data.imageMode}`)
      if ('channelButtonJid' in c.data) partes.push('botão "Ver canal" removido')
      console.log(`        destino "${c.name}": ${partes.join(', ')}`)
    }
    if (plano.configChange) console.log('        variação do texto: desligada')
  }

  if (!aplicar) {
    console.log('\nNada foi gravado. Rode de novo com --aplicar para gravar.')
    return
  }

  let ok = 0
  let falhas = 0
  for (const { u, plano } of afetadas) {
    try {
      for (const c of plano.groupChanges) await db.group.update({ where: { id: c.id }, data: c.data })
      if (plano.configChange) await db.botConfig.update({ where: { userId: u.id }, data: plano.configChange })
      ok += 1
    } catch (err) {
      falhas += 1
      console.log(`    ✗ ${u.email ?? u.id}: ${err?.message ?? err}`)
    }
  }
  console.log(`\n[3] Contas gravadas: ${ok} | falhas: ${falhas}`)
}

main()
  .catch(err => {
    console.error('FALHOU:', err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
