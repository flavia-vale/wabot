// Diagnóstico read-only: complementa `diag-ltv-retencao.mjs` respondendo DUAS
// perguntas que ele não responde:
//
//   1. Das clientes que NÃO renovaram, quanto é INVOLUNTÁRIO (cobrança
//      automática recusada) contra VOLUNTÁRIO (cancelou no painel) contra
//      AMBÍGUO (pagou avulso e não repetiu — pode ser esquecimento, não é
//      afirmado como desistência).
//   2. Nos primeiros 7 dias de conta, o que separa quem renova de quem não
//      renova — WhatsApp conectado, loja cadastrada, oferta publicada
//      ("momento aha", metodologia Amplitude/Reforge de métrica de ativação).
//
// A classificação do item 1 é IMPORTADA de `src/domain/admin/churnReason.js`
// — nunca reescrita aqui (mesma lição de `diag-funil-ativacao.mjs`: duplicar
// a regra faz script e painel discordarem, sem jeito de saber qual está
// certo). A cohort/renovação do item 2 é IMPORTADA de
// `src/domain/admin/ltvRetention.js`, a MESMA base do `diag-ltv-retencao.mjs`.
//
// Nada é escrito. Só leitura. Contas de teste ficam de fora (mesma lista do
// Financeiro). Amostra pequena: os percentuais vêm com o denominador ao lado
// — nunca leia como fato definitivo abaixo de ~20 casos.
//
// Uso (na VPS, DENTRO do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-motivo-nao-renovou.mjs
//   cd ~/wabot && node scripts/diag-motivo-nao-renovou.mjs --listar

import db from '../src/db.js'
import { excludeUserIdsWhere, loadTestAccountUserIds } from '../src/domain/admin/testAccounts.js'
import { buildLtvReport } from '../src/domain/admin/ltvRetention.js'
import { classifyChurnReason, describeChurnReason } from '../src/domain/admin/churnReason.js'

const MAX_ROWS = 20_000
const ACTIVATION_WINDOW_DAYS = 7
const args = process.argv.slice(2)
const listar = args.includes('--listar')

function pct(n, total) {
  return total ? `${((n / total) * 100).toFixed(0)}% (${n}/${total})` : '— (0/0)'
}

async function main() {
  const testAccounts = await loadTestAccountUserIds(db)
  const excludeWhere = excludeUserIdsWhere(testAccounts.ids)

  const payments = await db.payment.findMany({
    where: { status: 'approved', ...excludeWhere },
    select: { userId: true, plan: true, amount: true, status: true, createdAt: true, expiresAt: true, daysGranted: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_ROWS,
  })
  if (!payments.length) {
    console.log('Nenhum pagamento aprovado encontrado.')
    return
  }

  const userIds = [...new Set(payments.map((p) => p.userId))]
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, plan: true, createdAt: true },
  })

  const report = buildLtvReport({ users, payments, now: new Date() })

  // "Não renovou, e já teve tempo de renovar" = cliente cujo acesso pago
  // acabou há mais que a carência (status !== 'ativa'/'em_carencia') e que
  // pagou uma vez só. Coorte muito recente (status='ativa' sem 2º pagamento
  // ainda dentro da cobertura do 1º) não entra — é cedo demais, não é churn.
  const naoRenovou = report.customers.filter((c) => !c.renewed && c.status === 'cancelada')
  const renovou = report.customers.filter((c) => c.renewed)

  const [subscriptions, charges, connectedRows, credentialRows] = await Promise.all([
    db.subscription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, status: true, cancelledAt: true },
    }),
    db.subscriptionCharge.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, status: true, attemptedAt: true },
    }),
    db.analyticsEvent.findMany({
      where: { event: 'whatsapp_connected', userId: { in: userIds } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.credential.findMany({ where: { userId: { in: userIds } }, select: { userId: true } }),
  ])
  const subsByUser = new Map()
  for (const s of subscriptions) {
    if (!subsByUser.has(s.userId)) subsByUser.set(s.userId, [])
    subsByUser.get(s.userId).push(s)
  }
  const chargesByUser = new Map()
  for (const c of charges) {
    if (!chargesByUser.has(c.userId)) chargesByUser.set(c.userId, [])
    chargesByUser.get(c.userId).push(c)
  }
  const firstConnectedByUser = new Map()
  for (const r of connectedRows) {
    if (!firstConnectedByUser.has(r.userId)) firstConnectedByUser.set(r.userId, r.createdAt)
  }
  const hasCredentialByUser = new Set(credentialRows.map((c) => c.userId))

  const successRows = await db.messageLog.findMany({
    where: { userId: { in: userIds }, status: 'success' },
    select: { userId: true, sentAt: true },
  })

  console.log(`\n=== Motivo de não-renovação — ${naoRenovou.length} clientes (cohort já madura para medir; teste excluído) ===\n`)

  console.log('--- 1. Involuntário x voluntário x ambíguo ---')
  const counts = {}
  const detail = []
  for (const c of naoRenovou) {
    const subs = subsByUser.get(c.userId) || []
    const everHadAutopay = subs.length > 0
    const explicitCancel = subs.some((s) => s.status === 'cancelled' && s.cancelledAt)
    const chargesAfterFirst = (chargesByUser.get(c.userId) || []).filter((ch) => ch.attemptedAt >= c.firstPaidAt)
    const hadRejectedChargeAfterFirstPayment = chargesAfterFirst.some((ch) => ch.status === 'rejected')
    const reason = classifyChurnReason({ everHadAutopay, explicitCancel, hadRejectedChargeAfterFirstPayment })
    counts[reason] = (counts[reason] || 0) + 1
    detail.push({ ...c, reason })
  }
  for (const [reason, n] of Object.entries(counts)) {
    console.log(`  ${describeChurnReason(reason)}: ${pct(n, naoRenovou.length)}`)
  }

  console.log('\n--- 2. Sinal de ativação em 7 dias × renovou depois? ---')
  function activationSignals(customerId, signupAt) {
    const cutoff = new Date(signupAt.getTime() + ACTIVATION_WINDOW_DAYS * 86_400_000)
    const connectedAt = firstConnectedByUser.get(customerId) || null
    const connectedWithin7d = connectedAt ? connectedAt <= cutoff : false
    const hasCredential = hasCredentialByUser.has(customerId)
    const ofertas7d = successRows.filter((r) => r.userId === customerId && r.sentAt <= cutoff).length
    return { connectedWithin7d, hasCredential, ofertas7d }
  }
  const usersById = new Map(users.map((u) => [u.id, u]))
  function resumo(nome, lista) {
    if (!lista.length) {
      console.log(`  ${nome}: 0 clientes`)
      return
    }
    const sinais = lista.map((c) => activationSignals(c.userId, usersById.get(c.userId)?.createdAt ?? c.firstPaidAt))
    const conectou = sinais.filter((s) => s.connectedWithin7d).length
    const loja = sinais.filter((s) => s.hasCredential).length
    const mediaOfertas = sinais.reduce((s, x) => s + x.ofertas7d, 0) / sinais.length
    console.log(
      `  ${nome} (n=${lista.length}): conectou WhatsApp em 7d ${pct(conectou, lista.length)} | ` +
        `cadastrou loja alguma vez ${pct(loja, lista.length)} | média de ofertas publicadas em 7d: ${mediaOfertas.toFixed(1)}`,
    )
  }
  resumo('RENOVOU', renovou)
  resumo('NÃO renovou', naoRenovou)

  if (listar) {
    console.log('\n--- Lista (userId, plano, motivo) ---')
    for (const d of detail) {
      console.log(`  ${d.userId} | ${d.plan} | ${describeChurnReason(d.reason)}`)
    }
  }

  console.log(
    `\n⚠️ Amostra pequena (${report.customers.length} pagantes no total, ${naoRenovou.length} classificados aqui). ` +
      `Trate como hipótese a confirmar com o próximo mês de dado, não como causa provada.`,
  )
}

main()
  .catch((error) => {
    console.error('Falha ao montar o diagnóstico:', error?.message ?? error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect?.().catch(() => {}))
