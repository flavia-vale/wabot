// Diagnóstico read-only: LTV e retenção das clientes pagantes.
//
// Responde a pergunta que bloqueia a decisão de anúncio pago (plano de
// marketing de 18/09/2026, seção 4.3 "LTV — nunca medido"): quanto uma
// cliente deixa ao longo da vida dela no produto, quantas renovam e quantas
// deixam vencer, mês a mês de entrada.
//
// Nada é escrito. Só leitura. As contas de TESTE ficam de fora das somas
// (mesma regra do Financeiro: `src/domain/admin/testAccounts.js`).
//
// Uso (na VPS, DENTRO do diretório do ambiente — o .env aponta o banco certo):
//   cd ~/wabot && node scripts/diag-ltv-retencao.mjs
//   cd ~/wabot && node scripts/diag-ltv-retencao.mjs --desde 2026-03-01
//   cd ~/wabot && node scripts/diag-ltv-retencao.mjs --csv > /tmp/ltv.csv
//
// ATENÇÃO ao ler o resultado:
//
//   * REALIZADO é medição (pagamentos aprovados). PROJETADO é estimativa a
//     partir do cancelamento observado — os dois nunca se somam.
//   * "Retida em N meses" olha a COBERTURA PAGA, não a quantidade de
//     pagamentos: plano de 90 dias cobre três marcos com um pagamento só.
//   * Coorte recente devolve "—" nos marcos que ainda não chegaram. Não é
//     zero; é "cedo demais para saber".
//   * "Ainda é cliente" aqui é acesso PAGO em dia. Acesso liberado na mão
//     não conta — não é receita.
//   * `--csv` imprime e-mail por cliente. É a dona rodando no próprio
//     servidor para decidir; não repassar o arquivo.

import db from '../src/db.js'
import { excludeUserIdsWhere, loadTestAccountUserIds } from '../src/domain/admin/testAccounts.js'
import { buildLtvReport, formatLtvReportLines } from '../src/domain/admin/ltvRetention.js'

const MAX_PAYMENT_ROWS = 20_000

const args = process.argv.slice(2)
function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const wantsCsv = args.includes('--csv')
const desdeArg = flag('desde')
const desde = desdeArg ? new Date(`${desdeArg}T00:00:00`) : null
if (desdeArg && Number.isNaN(desde.getTime())) {
  console.error(`--desde inválido: ${desdeArg} (use AAAA-MM-DD)`)
  process.exit(2)
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function main() {
  const testAccounts = await loadTestAccountUserIds(db)
  const where = {
    status: 'approved',
    ...(desde ? { createdAt: { gte: desde } } : {}),
    ...excludeUserIdsWhere(testAccounts.ids),
  }

  const payments = await db.payment.findMany({
    where,
    select: { userId: true, plan: true, amount: true, status: true, createdAt: true, expiresAt: true, daysGranted: true, provider: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_PAYMENT_ROWS,
  })
  if (payments.length >= MAX_PAYMENT_ROWS) {
    console.error(`⚠️ teto de ${MAX_PAYMENT_ROWS} pagamentos atingido — use --desde para recortar o período`)
  }

  const userIds = [...new Set(payments.map(payment => payment.userId))]
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, plan: true, accessExpiresAt: true, createdAt: true } })
    : []

  const report = buildLtvReport({ users, payments, now: new Date() })

  if (wantsCsv) {
    console.log(['email', 'plano', 'primeiro_pagamento', 'ultimo_pagamento', 'cobertura_ate', 'pagamentos', 'meses_pagos', 'total_pago', 'renovou', 'situacao'].join(','))
    for (const customer of report.customers) {
      console.log([
        customer.email, customer.plan, customer.firstPaidAt?.toISOString().slice(0, 10), customer.lastPaidAt?.toISOString().slice(0, 10),
        customer.coverageEnd?.toISOString().slice(0, 10), customer.paymentsCount, customer.paidMonths, customer.totalPaid,
        customer.renewed ? 'sim' : 'nao', customer.status,
      ].map(csvCell).join(','))
    }
    return
  }

  console.log(`\nLTV e retenção — pagamentos aprovados${desde ? ` desde ${desdeArg}` : ' (todo o histórico)'}`)
  if (testAccounts.emails.length) console.log(`Fora das somas (conta de teste): ${testAccounts.emails.join(', ')}`)
  console.log('')
  for (const line of formatLtvReportLines(report)) console.log(line)
}

main()
  .catch(error => {
    // Erro impresso, nunca engolido: "não consegui consultar" não pode virar
    // "não há clientes" (lição do diag-assinatura-recusada.mjs).
    console.error('Falha ao montar o relatório:', error?.message ?? error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect?.().catch(() => {}))
