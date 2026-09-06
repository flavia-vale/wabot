#!/usr/bin/env node
/**
 * Apaga UMA conta (usuário) do banco, por e-mail — e os arquivos dela no disco.
 *
 * Todas as relações com User são `onDelete: Cascade` no schema, então deletar o
 * usuário leva junto Group, Credential, MessageLog, WaSession, Subscription,
 * Payment, ScheduledMessage, AnalyticsEvent etc. Este script também remove o
 * `auth_info/<userId>` (credencial do WhatsApp) e os arquivos de dedup/canais.
 *
 * Uso:
 *   node scripts/apagar-conta.mjs litlejoe1@gmail.com            # dry-run
 *   node scripts/apagar-conta.mjs litlejoe1@gmail.com --apply    # apaga
 *
 * ANTES de rodar com --apply em PRODUÇÃO:
 *   1. scripts/backup_prod.sh
 *   2. pm2 stop api            (evita SQLITE_BUSY — pegadinha #8 do AGENTS.md)
 *   3. node scripts/apagar-conta.mjs <email>            (dry-run, confira)
 *   4. node scripts/apagar-conta.mjs <email> --apply
 *   5. pm2 start ecosystem.config.cjs --only api && pm2 save
 */

import { rm } from 'fs/promises'
import db from '../src/db.js'
import { getAuthInfoDir, getDedupFile, getKnownChannelsFile } from '../src/paths.js'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const email = args.find((a) => !a.startsWith('--'))

if (!email) {
  console.error('Uso: node scripts/apagar-conta.mjs <email> [--apply]')
  process.exit(1)
}

async function main() {
  const user = await db.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true, name: true, phone: true, plan: true, createdAt: true },
  })

  if (!user) {
    console.log(`Nenhuma conta encontrada com o e-mail "${email}". Nada a fazer.`)
    return
  }

  const [groups, logs, creds, sessions, payments] = await Promise.all([
    db.group.count({ where: { userId: user.id } }),
    db.messageLog.count({ where: { userId: user.id } }),
    db.credential.count({ where: { userId: user.id } }),
    db.waSession.count({ where: { userId: user.id } }),
    db.payment.count({ where: { userId: user.id } }).catch(() => 0),
  ])

  console.log('Conta encontrada:')
  console.log(`  id .......... ${user.id}`)
  console.log(`  e-mail ...... ${user.email}`)
  console.log(`  nome ........ ${user.name || '(sem nome)'}`)
  console.log(`  plano ....... ${user.plan}`)
  console.log(`  criada em ... ${user.createdAt.toISOString()}`)
  console.log('')
  console.log('Será apagado em cascata:')
  console.log(`  grupos ................ ${groups}`)
  console.log(`  envios (MessageLog) ... ${logs}`)
  console.log(`  lojas (Credential) .... ${creds}`)
  console.log(`  sessões WhatsApp ...... ${sessions}`)
  console.log(`  pagamentos ............ ${payments}`)
  console.log(`  pasta de credencial ... ${getAuthInfoDir(user.id)}`)
  console.log('')

  if (!APPLY) {
    console.log('DRY-RUN: nada foi apagado. Rode de novo com --apply para apagar de verdade.')
    console.log('(Em produção: backup + pm2 stop api ANTES — veja o cabeçalho do script.)')
    return
  }

  const result = await db.user.delete({ where: { id: user.id } })
  console.log(`OK: conta ${result.email} (id=${result.id}) apagada do banco.`)

  for (const path of [getAuthInfoDir(user.id), getDedupFile(user.id), getKnownChannelsFile(user.id)]) {
    await rm(path, { recursive: true, force: true }).catch((err) => {
      console.warn(`Aviso: não consegui remover ${path}: ${err.message}`)
    })
  }
  console.log('OK: arquivos da conta removidos do disco.')
}

main()
  .catch((err) => {
    console.error('Falha ao apagar a conta:', err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
