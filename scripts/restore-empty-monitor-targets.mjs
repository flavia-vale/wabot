#!/usr/bin/env node
/**
 * Recuperação do incidente "painel mostra destinos, runtime vê nenhum".
 *
 * Uma origem `targetsMode='explicit'` sem nenhuma linha em GroupTarget envia
 * para ZERO destinos por segurança. Este script volta SOMENTE essas origens ao
 * fallback canônico `all` (todos os destinos atuais da mesma conta).
 *
 * Read-only por padrão. Para gravar em todas as contas do ambiente são
 * necessários DOIS opt-ins: `--aplicar --todos`.
 * Um e-mail/nome limita a recuperação àquela conta e exige apenas `--aplicar`.
 */
import 'dotenv/config'
import db from '../src/db.js'

const args = process.argv.slice(2)
const apply = args.includes('--aplicar')
const all = args.includes('--todos')
const who = args.find(arg => !arg.startsWith('--')) || null

if (apply && !who && !all) {
  console.error('RECUSADO: para alterar todas as contas use --aplicar --todos; ou informe e-mail/nome.')
  process.exitCode = 2
  await db.$disconnect()
  process.exit()
}

let user = null
if (who) {
  user = await db.user.findFirst({
    where: { OR: [{ email: who }, { name: { contains: who } }] },
    select: { id: true, email: true },
  })
  if (!user) {
    console.error(`Conta não encontrada: ${who}`)
    process.exitCode = 1
    await db.$disconnect()
    process.exit()
  }
}

const affected = await db.group.findMany({
  where: {
    role: 'monitor',
    targetsMode: 'explicit',
    monitorTargets: { none: {} },
    ...(user ? { userId: user.id } : {}),
  },
  select: { id: true, name: true, userId: true, user: { select: { email: true } } },
  orderBy: [{ userId: 'asc' }, { name: 'asc' }],
})

console.log(`ambiente=${process.env.APP_ENV || 'desconhecido'} afetadas=${affected.length} modo=${apply ? 'APLICAR' : 'somente-leitura'}`)
for (const row of affected.slice(0, 20)) console.log(`${row.user.email}\t${row.name}`)
if (affected.length > 20) console.log(`... e mais ${affected.length - 20}`)

if (!apply || affected.length === 0) {
  if (!apply && affected.length) console.log('Para restaurar: repita com --aplicar (e --todos sem filtro de conta).')
  await db.$disconnect()
  process.exit()
}

const result = await db.group.updateMany({
  where: { id: { in: affected.map(row => row.id) }, role: 'monitor', targetsMode: 'explicit', monitorTargets: { none: {} } },
  data: { targetsMode: 'all' },
})
console.log(`restauradas=${result.count}; workers recarregam a configuração em até 60s`)
await db.$disconnect()
