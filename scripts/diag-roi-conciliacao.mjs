#!/usr/bin/env node
/**
 * Conciliação do ROI com a aba Visão geral — read-only.
 *
 * Por que existe: em 2026-09-17 a aba ROI mostrou R$ 543,22 de receita e a
 * Visão geral R$ 1.183,33 de líquido, e não havia como saber, sem entrar no
 * banco, se a diferença era defeito ou definição. Duas telas discordando sobre
 * dinheiro, sem uma terceira fonte para desempatar, custa uma investigação
 * inteira por pergunta.
 *
 * Ele imprime a receita MÊS A MÊS pelas mesmas duas fontes que o produto usa
 * (pagamento avulso em `Payment` + cobrança de assinatura em
 * `SubscriptionCharge`), com as comissões e as taxas separadas, e fecha a conta
 * nos dois recortes: todo o histórico e só os meses fechados.
 *
 * Nada é gravado. Nenhum e-mail sai. Roda no diretório do ambiente:
 *
 *   cd ~/wabot && node scripts/diag-roi-conciliacao.mjs
 *
 * ⚠️ Falha de consulta é IMPRESSA, nunca engolida — erro engolido em script de
 * diagnóstico vira conclusão errada (lição do diag-assinatura-recusada).
 */

import 'dotenv/config'
import db from '../src/db.js'
import { loadTestAccountUserIds } from '../src/domain/admin/testAccounts.js'
import { costForMonth, monthKeyOf, resolveCostConfig, round2 } from '../src/domain/admin/operatingCosts.js'

const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))

async function main() {
  const now = new Date()
  const currentMonth = monthKeyOf(now)
  const config = resolveCostConfig()

  const mpFeePercent = Number.parseFloat(process.env.MP_FEE_PERCENT ?? '4.99') || 0
  const mpFeeFixedCents = Number.parseInt(process.env.MP_FEE_FIXED_CENTS ?? '0', 10) || 0

  const testAccounts = await loadTestAccountUserIds(db)
  const notTestUser = testAccounts.ids.length ? { userId: { notIn: testAccounts.ids } } : {}
  if (testAccounts.emails.length) {
    console.log(`Contas de teste fora de todas as somas: ${testAccounts.emails.join(', ')}\n`)
  }

  const oneTimePaymentWhere = {
    OR: [{ mpPaymentId: null }, { NOT: { mpPaymentId: { startsWith: 'sub_' } } }],
  }

  const [payments, charges, commissions] = await Promise.all([
    db.payment.findMany({
      where: { status: 'approved', ...oneTimePaymentWhere, ...notTestUser },
      select: { amount: true, provider: true, createdAt: true },
      take: 20000,
    }),
    db.subscriptionCharge.findMany({
      where: { status: { in: ['approved', 'accredited'] }, ...notTestUser },
      select: { amount: true, attemptedAt: true },
      take: 20000,
    }),
    db.affiliateCommission.findMany({
      where: {
        status: { notIn: ['rejected', 'reversed'] },
        ...(testAccounts.ids.length ? { referredUserId: { notIn: testAccounts.ids } } : {}),
      },
      select: { commissionAmountCents: true, createdAt: true },
      take: 20000,
    }),
  ])

  const meses = new Map()
  const bucket = month => {
    if (!meses.has(month)) meses.set(month, { gross: 0, com: 0, fees: 0, n: 0 })
    return meses.get(month)
  }

  for (const p of payments) {
    const m = monthKeyOf(p.createdAt)
    if (!m) continue
    const b = bucket(m)
    b.gross += p.amount ?? 0
    b.n += 1
    if (p.provider !== 'manual') b.fees += ((p.amount ?? 0) * (mpFeePercent / 100)) + mpFeeFixedCents / 100
  }
  for (const c of charges) {
    const m = monthKeyOf(c.attemptedAt)
    if (!m) continue
    const b = bucket(m)
    b.gross += c.amount ?? 0
    b.n += 1
    b.fees += ((c.amount ?? 0) * (mpFeePercent / 100)) + mpFeeFixedCents / 100
  }
  for (const c of commissions) {
    const m = monthKeyOf(c.createdAt)
    if (!m) continue
    bucket(m).com += (c.commissionAmountCents ?? 0) / 100
  }

  const ordenados = [...meses.keys()].sort()
  console.log('mês      valor cheio    comissões       taxas      sobrou      custo     no mês')
  console.log('------------------------------------------------------------------------------')
  let netTudo = 0
  let custoTudo = 0
  let netFechado = 0
  let custoFechado = 0
  for (const m of ordenados) {
    const b = meses.get(m)
    const net = round2(b.gross - b.com - b.fees)
    const custo = costForMonth(m, config).total
    netTudo += net
    custoTudo += custo
    if (m < currentMonth) {
      netFechado += net
      custoFechado += custo
    }
    const marca = m === currentMonth ? ' ← em andamento' : ''
    console.log(
      `${m}  ${brl(b.gross).padStart(12)} ${brl(b.com).padStart(12)} ${brl(b.fees).padStart(11)} ` +
      `${brl(net).padStart(11)} ${brl(custo).padStart(10)} ${brl(net - custo).padStart(11)}${marca}`,
    )
  }

  // Meses com custo e sem receita nenhuma também entram na conta do ROI.
  for (const entry of config.historical ?? []) {
    if (!meses.has(entry.month)) {
      const custo = costForMonth(entry.month, config).total
      custoTudo += custo
      if (entry.month < currentMonth) custoFechado += custo
      meses.set(entry.month, { gross: 0, com: 0, fees: 0, n: 0 })
      console.log(`${entry.month}  ${brl(0).padStart(12)} ${brl(0).padStart(12)} ${brl(0).padStart(11)} ${brl(0).padStart(11)} ${brl(custo).padStart(10)} ${brl(-custo).padStart(11)}  (só custo)`)
    }
  }

  console.log('\n=== O que o PLACAR do ROI mostra (tudo que já entrou x já saiu) ===')
  console.log('  entrou (já descontado):', brl(round2(netTudo)))
  console.log('  saiu (Claude + servidor):', brl(round2(custoTudo)))
  console.log('  resultado:', brl(round2(netTudo - custoTudo)))

  console.log('\n=== Só os meses FECHADOS (o que a tabela do passado soma) ===')
  console.log('  entrou:', brl(round2(netFechado)), '| saiu:', brl(round2(custoFechado)))

  const atual = meses.get(currentMonth)
  if (atual) {
    console.log(`\n=== ${currentMonth} (em andamento) ===`)
    console.log('  já entrou:', brl(round2(atual.gross - atual.com - atual.fees)), `em ${atual.n} pagamentos`)
    console.log('  custo do mês (cheio):', brl(costForMonth(currentMonth, config).total))
  }

  console.log('\nA aba Visão geral mostra o VALOR CHEIO do período escolhido; o placar')
  console.log('do ROI mostra o que SOBROU, de todo o histórico. Some a coluna "valor')
  console.log('cheio" do período que a Visão geral está filtrando para comparar.')
}

main()
  .catch(error => {
    // Impresso de propósito: "não achei" e "não consegui procurar" pedem ações
    // opostas, e engolir o erro transforma falha em conclusão.
    console.error('\nFALHA ao montar a conciliação:', error?.message ?? error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect().catch(() => {}))
