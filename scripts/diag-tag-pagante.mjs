#!/usr/bin/env node
// Por que a tag "Pagante" não aparece? — read-only, roda no diretório do ambiente.
//
//   cd ~/wabot-staging && node scripts/diag-tag-pagante.mjs
//   cd ~/wabot && node scripts/diag-tag-pagante.mjs
//
// A tag sai de PAGAMENTO APROVADO (`Payment.status='approved'`), nunca do campo
// `plan` — liberação manual de acesso e trial também escrevem `plan`, e pintar
// de verde quem nunca pagou é o oposto do que a tag serve para dizer.
//
// Isso tem uma consequência que confunde: **staging tem banco próprio**
// (`staging.db`). Se nenhuma conta de staging concluiu pagamento, NÃO existe
// pagante lá e a tag não aparece em tela nenhuma — sem defeito de código.
// Este script separa os dois casos.
import 'dotenv/config'
import db from '../src/db.js'
import { resolvePayingStatus } from '../src/domain/admin/payingStatus.js'

const now = Date.now()

function linha(rotulo, valor) {
  console.log(`${rotulo.padEnd(38)} ${valor}`)
}

async function main() {
  console.log(`\nAmbiente: ${process.env.APP_ENV || 'não declarado'} · banco: ${process.env.DATABASE_URL || 'não declarado'}\n`)

  const porStatus = await db.payment.groupBy({ by: ['status'], _count: { _all: true } }).catch(() => [])
  console.log('Pagamentos por situação (a tag só olha "approved"):')
  if (!porStatus.length) console.log('  (nenhum pagamento registrado neste banco)')
  for (const linhaStatus of porStatus.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${String(linhaStatus.status).padEnd(14)} ${linhaStatus._count._all}`)
  }

  const aprovados = await db.payment.groupBy({
    by: ['userId'],
    where: { status: 'approved' },
    _count: { _all: true },
  }).catch(() => [])

  console.log('')
  linha('Contas com pagamento aprovado:', aprovados.length)

  if (!aprovados.length) {
    console.log('\n→ NÃO É DEFEITO DE TELA: sem pagamento aprovado neste banco, nenhuma')
    console.log('  conta pode receber a tag. Em staging isso é o normal (banco próprio,')
    console.log('  token de sandbox). Para ver a tag funcionando aqui, registre um')
    console.log('  pagamento pelo admin: Financeiro → "Registrar pagamento por fora"')
    console.log('  (ele grava status "approved", igual ao Mercado Pago).')
    await db.$disconnect()
    return
  }

  const ids = aprovados.map(item => item.userId)
  const usuarios = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, plan: true, accessExpiresAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  let pagantes = 0
  let exPagantes = 0
  console.log('\nComo cada uma aparece na tela:')
  for (const usuario of usuarios) {
    const estado = resolvePayingStatus({ everPaid: true, accessExpiresAt: usuario.accessExpiresAt, now })
    if (estado.status === 'pagante') pagantes += 1
    else exPagantes += 1
    console.log(`  ${estado.label.padEnd(16)} ${usuario.email}`)
  }

  console.log('')
  linha('Verde "Pagante" (acesso em dia):', pagantes)
  linha('Cinza "Já foi pagante" (venceu):', exPagantes)
  console.log('\n→ Se esses e-mails aparecem SEM tag no painel, aí sim é defeito de tela.')
  console.log('  Se eles nem aparecem nas listas do admin, é filtro/paginação, não a tag.\n')

  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('Falhou:', err?.message || err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
