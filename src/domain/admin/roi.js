/**
 * ROI do BOTinho — passado, presente e futuro na mesma conta.
 *
 * Três perguntas, três blocos, e cada um só responde o que de fato sabe:
 *
 * - PASSADO: mês a mês fechado. Receita líquida REAL (pagamentos aprovados
 *   menos comissões de afiliado e taxas do Mercado Pago) contra o custo REAL
 *   daquele mês, com o acumulado ao lado. É medição, não estimativa.
 * - PRESENTE: o mês corrente, que está pela metade. O que já entrou é fato; o
 *   fechamento do mês é PROJEÇÃO pelo ritmo do mês (dias corridos), sempre
 *   rotulada como tal. Junto vem o ponto de equilíbrio: quantas clientes
 *   pagantes cobrem o custo fixo.
 * - FUTURO: projeção em três cenários. Nenhum deles é promessa — o cenário
 *   conservador é literalmente "nada muda a partir de hoje".
 *
 * Invariantes (não regredir):
 *
 * - **Realizado e previsto nunca se misturam num número só.** Todo mês carrega
 *   `source`, e o acumulado do passado para no último mês FECHADO. Somar
 *   projeção dentro do "investido até agora" é o jeito mais rápido de tomar
 *   decisão de dinheiro em cima de número inventado.
 * - **Crescimento observado é limitado e exige amostra.** Menos de 3 meses
 *   fechados com receita, ou crescimento fora de [0%, 50%] ao mês, cai para o
 *   cenário sem crescimento. Extrapolar 300% de um mês para doze é o erro que
 *   transforma projeção em ficção.
 * - **Sem dado confiável NÃO se afirma payback.** `paybackMonth: null` é
 *   resposta válida e honesta.
 * - **Conta de teste fica fora da receita** (ver `testAccounts.js`): quem
 *   monta `revenueByMonth` já entrega a série sem ela.
 *
 * Módulo PURO: sem banco, sem rede.
 */

import {
  addMonths,
  costForMonth,
  monthIndex,
  monthKeyFromIndex,
  monthKeyOf,
  monthlyRecurringCost,
  resolveCostConfig,
  round2,
} from './operatingCosts.js'

/** Amostra mínima de meses fechados para confiar no crescimento observado. */
export const MIN_MONTHS_FOR_GROWTH = 3
/**
 * Teto do crescimento mensal aceito na projeção.
 *
 * 20%/mês já multiplica a receita por ~9 em doze meses. Um mês bom (duas
 * clientes viram quatro) produz 100% de crescimento; extrapolar isso por um
 * ano devolve número de outro planeta e a projeção deixa de servir para
 * decidir qualquer coisa.
 */
export const MAX_MONTHLY_GROWTH = 0.2

/**
 * Teto de clientes que o servidor atual atende ao mesmo tempo.
 *
 * Não é detalhe técnico: é o limite de RECEITA. Cheio, nenhuma cliente nova
 * consegue conectar (`MAX_SESSIONS_PER_PROCESS`, hoje 40 em produção), então
 * projeção que passa disso está prometendo faturamento que a infraestrutura
 * de hoje não entrega — e o custo de crescer não está nesta conta.
 */
export const DEFAULT_CAPACITY_CUSTOMERS = 40

/**
 * Teto do cenário otimista. Precisa ser MAIOR que o da base, senão os dois
 * viram a mesma linha sempre que o crescimento observado bate no limite — e
 * uma tela com dois cenários idênticos não ajuda a decidir nada.
 */
export const MAX_OPTIMISTIC_GROWTH = 0.3
/** Meses projetados para frente. */
export const DEFAULT_PROJECTION_MONTHS = 12

export const SCENARIOS = Object.freeze({
  CONSERVADOR: 'conservador',
  BASE: 'base',
  OTIMISTA: 'otimista',
})

export const SCENARIO_LABELS = Object.freeze({
  [SCENARIOS.CONSERVADOR]: 'Nada muda',
  [SCENARIOS.BASE]: 'Mesmo ritmo de agora',
  [SCENARIOS.OTIMISTA]: 'Ritmo melhor',
})

function emptyMonth(month) {
  return { month, gross: 0, affiliateCommissions: 0, mpFees: 0, refunds: 0, net: 0, payments: 0, payingUsers: 0 }
}

function normalizeRevenueMonth(raw, month) {
  const gross = round2(raw?.gross ?? 0)
  const affiliateCommissions = round2(raw?.affiliateCommissions ?? 0)
  const mpFees = round2(raw?.mpFees ?? 0)
  const refunds = round2(raw?.refunds ?? 0)
  return {
    month,
    gross,
    affiliateCommissions,
    mpFees,
    refunds,
    net: round2(gross - affiliateCommissions - mpFees - refunds),
    payments: Number(raw?.payments ?? 0) || 0,
    payingUsers: Number(raw?.payingUsers ?? 0) || 0,
  }
}

/** Dias do mês e quantos já correram — o ritmo do mês corrente sai daqui. */
export function monthProgress(monthKey, now, timeZone = 'America/Sao_Paulo') {
  const index = monthIndex(monthKey)
  if (index === null) return { daysInMonth: 0, daysElapsed: 0, ratio: 1 }
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let day = daysInMonth
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, day: '2-digit' }).formatToParts(now)
    const parsed = Number(parts.find(part => part.type === 'day')?.value)
    if (Number.isFinite(parsed)) day = parsed
  } catch {
    day = now instanceof Date ? now.getUTCDate() : daysInMonth
  }
  const daysElapsed = Math.min(Math.max(day, 1), daysInMonth)
  return { daysInMonth, daysElapsed, ratio: daysElapsed / daysInMonth }
}

/**
 * Crescimento mensal observado (média geométrica) da receita líquida.
 * Devolve `{ rate, reliable, reason }` — `reliable:false` significa "use o
 * cenário sem crescimento", nunca "o crescimento é zero de fato".
 */
export function observedMonthlyGrowth(closedMonths = []) {
  const withRevenue = closedMonths.filter(month => month.net > 0)
  if (withRevenue.length < MIN_MONTHS_FOR_GROWTH) {
    return { rate: 0, reliable: false, reason: 'amostra_curta', months: withRevenue.length }
  }
  const first = withRevenue[0].net
  const last = withRevenue[withRevenue.length - 1].net
  const steps = withRevenue.length - 1
  if (!(first > 0) || !(last > 0) || steps <= 0) {
    return { rate: 0, reliable: false, reason: 'sem_base', months: withRevenue.length }
  }
  const rate = (last / first) ** (1 / steps) - 1
  if (!Number.isFinite(rate)) return { rate: 0, reliable: false, reason: 'sem_base', months: withRevenue.length }
  if (rate < 0) return { rate: 0, reliable: true, reason: 'queda', months: withRevenue.length, rawRate: rate }
  if (rate > MAX_MONTHLY_GROWTH) {
    return { rate: MAX_MONTHLY_GROWTH, reliable: true, reason: 'limitado', months: withRevenue.length, rawRate: rate }
  }
  return { rate, reliable: true, reason: 'observado', months: withRevenue.length, rawRate: rate }
}

function scenarioRate(scenario, growth) {
  if (scenario === SCENARIOS.CONSERVADOR) return 0
  const observed = growth.reliable ? growth.rate : 0
  if (scenario === SCENARIOS.OTIMISTA) return Math.min(MAX_OPTIMISTIC_GROWTH, observed * 1.5 + 0.02)
  return Math.min(MAX_MONTHLY_GROWTH, observed)
}

function projectScenario({ scenario, growth, baseline, startMonth, months, config, startingCumulative, revenueCeiling }) {
  const rate = scenarioRate(scenario, growth)
  const rows = []
  let cumulative = startingCumulative
  let paybackMonth = null
  let breakEvenMonth = null
  let cappedFromMonth = null
  let revenue = baseline
  for (let step = 0; step < months; step += 1) {
    const month = addMonths(startMonth, step)
    revenue = step === 0 ? baseline : revenue * (1 + rate)
    if (revenueCeiling > 0 && revenue > revenueCeiling) {
      revenue = revenueCeiling
      if (!cappedFromMonth) cappedFromMonth = month
    }
    const cost = costForMonth(month, config)
    const net = round2(revenue)
    const profit = round2(net - cost.total)
    cumulative = round2(cumulative + profit)
    if (!breakEvenMonth && profit >= 0) breakEvenMonth = month
    if (paybackMonth === null && cumulative >= 0) paybackMonth = month
    rows.push({ month, net, cost: cost.total, costSource: cost.source, profit, cumulativeProfit: cumulative, source: 'previsto' })
  }
  return {
    scenario,
    label: SCENARIO_LABELS[scenario],
    monthlyGrowthPct: round2(rate * 100),
    months: rows,
    paybackMonth,
    breakEvenMonth,
    cappedFromMonth,
    cumulativeProfitAtEnd: cumulative,
  }
}

/**
 * Monta o relatório inteiro.
 *
 * @param {object} input
 * @param {object} input.revenueByMonth  mapa `'2026-08' -> { gross, affiliateCommissions, mpFees, payments, payingUsers }`
 * @param {Date}   input.now
 * @param {object} [input.env]
 * @param {number} [input.projectionMonths]
 * @param {number} [input.activeMrr]     MRR das assinaturas ativas hoje
 * @param {number} [input.avgTicketNet]  receita líquida média por cliente/mês
 */
export function buildRoiReport({
  revenueByMonth = {},
  now = new Date(),
  env = process.env,
  projectionMonths = DEFAULT_PROJECTION_MONTHS,
  activeMrr = 0,
  timeZone = 'America/Sao_Paulo',
} = {}) {
  const config = resolveCostConfig(env)
  const currentMonth = monthKeyOf(now, timeZone)
  const currentIndex = monthIndex(currentMonth)

  const revenueMonths = Object.keys(revenueByMonth).filter(month => monthIndex(month) !== null).sort()
  const costMonths = (config.historical ?? []).map(entry => entry.month).sort()
  const candidates = [...revenueMonths, ...costMonths, config.recurring.startMonth].filter(month => monthIndex(month) !== null).sort()
  const startMonth = candidates[0] ?? currentMonth
  const startIndex = monthIndex(startMonth)

  // ---------- PASSADO: só meses FECHADOS ----------
  const past = []
  let cumulativeNet = 0
  let cumulativeCost = 0
  let cumulativeProfit = 0
  for (let index = startIndex; index < currentIndex; index += 1) {
    const month = monthKeyFromIndex(index)
    const revenue = normalizeRevenueMonth(revenueByMonth[month], month)
    const cost = costForMonth(month, config)
    cumulativeNet = round2(cumulativeNet + revenue.net)
    cumulativeCost = round2(cumulativeCost + cost.total)
    cumulativeProfit = round2(cumulativeProfit + revenue.net - cost.total)
    past.push({
      ...revenue,
      cost: cost.total,
      costClaude: cost.claude,
      costVps: cost.vps,
      costSource: cost.source,
      profit: round2(revenue.net - cost.total),
      cumulativeNet,
      cumulativeCost,
      cumulativeProfit,
      roiPct: cumulativeCost > 0 ? round2(((cumulativeNet - cumulativeCost) / cumulativeCost) * 100) : null,
      source: 'realizado',
    })
  }

  // ---------- PRESENTE: mês corrente, parcial ----------
  const progress = monthProgress(currentMonth, now, timeZone)
  const currentRevenue = normalizeRevenueMonth(revenueByMonth[currentMonth], currentMonth)
  const currentCost = costForMonth(currentMonth, config)
  const projectedNet = progress.ratio > 0 ? round2(currentRevenue.net / progress.ratio) : currentRevenue.net
  const fixedMonthlyCost = monthlyRecurringCost(config)
  const closedWithRevenue = past.filter(month => month.net > 0)
  const lastClosed = closedWithRevenue[closedWithRevenue.length - 1] ?? null
  const avgTicketNet = currentRevenue.payingUsers > 0
    ? round2(currentRevenue.net / currentRevenue.payingUsers)
    : (lastClosed && lastClosed.payingUsers > 0 ? round2(lastClosed.net / lastClosed.payingUsers) : 0)
  const breakEvenCustomers = avgTicketNet > 0 ? Math.ceil(fixedMonthlyCost / avgTicketNet) : null

  const present = {
    month: currentMonth,
    ...currentRevenue,
    cost: currentCost.total,
    costClaude: currentCost.claude,
    costVps: currentCost.vps,
    costSource: currentCost.source,
    profitSoFar: round2(currentRevenue.net - currentCost.total),
    daysElapsed: progress.daysElapsed,
    daysInMonth: progress.daysInMonth,
    projectedNet,
    projectedProfit: round2(projectedNet - currentCost.total),
    fixedMonthlyCost,
    activeMrr: round2(activeMrr),
    avgTicketNet,
    breakEvenCustomers,
    // Quanto falta de receita no mês para o custo fixo se pagar.
    missingToBreakEven: round2(Math.max(0, currentCost.total - currentRevenue.net)),
    source: 'parcial',
  }

  // ---------- FUTURO: três cenários a partir do mês seguinte ----------
  const growth = observedMonthlyGrowth(past)
  // Baseline: o melhor entre o que o mês corrente indica e o MRR já contratado.
  const baseline = round2(Math.max(projectedNet, lastClosed?.net ?? 0, 0))
  const futureStart = addMonths(currentMonth, 1)
  // Teto de receita: o servidor de hoje atende um número finito de clientes.
  const capacityCustomers = Number(env?.MAX_SESSIONS_PER_PROCESS) > 0
    ? Number(env.MAX_SESSIONS_PER_PROCESS)
    : DEFAULT_CAPACITY_CUSTOMERS
  const revenueCeiling = avgTicketNet > 0 ? round2(capacityCustomers * avgTicketNet) : 0
  const cumulativeIncludingPresent = round2(cumulativeProfit + present.projectedProfit)
  const scenarios = [SCENARIOS.CONSERVADOR, SCENARIOS.BASE, SCENARIOS.OTIMISTA].map(scenario => projectScenario({
    scenario,
    growth,
    baseline,
    startMonth: futureStart,
    months: Math.max(1, projectionMonths),
    config,
    startingCumulative: cumulativeIncludingPresent,
    revenueCeiling,
  }))

  const totalInvested = cumulativeCost
  const totalNet = cumulativeNet

  // ---------- ATÉ AGORA: o que responde "já se pagou?" ----------
  //
  // RCA 2026-09-17: o placar contava só mês FECHADO, e isso estava errado.
  // "Realizado e previsto nunca viram um número só" continua valendo — mas o
  // mês corrente NÃO é previsto por inteiro: o que já entrou nele é dinheiro
  // no bolso, fato, e a fatura do mês já saiu. Deixar setembro fora escondeu
  // R$ 640 de receita já recebida e R$ 755 de custo já pago, e a conta do
  // "já se pagou?" ficou respondendo outra pergunta.
  //
  // Previsto (o fechamento do mês) continua SÓ no bloco Presente.
  //
  // ⚠️ O custo do mês corrente entra CHEIO, não proporcional aos dias: a
  // fatura do Claude e a do servidor são mensais e já foram cobradas. Isso
  // pesa contra o resultado no começo do mês — é conservador de propósito,
  // porque inflar o resultado é o erro que custa decisão errada.
  const netToDate = round2(cumulativeNet + currentRevenue.net)
  const investedToDate = round2(cumulativeCost + currentCost.total)
  const resultToDate = round2(netToDate - investedToDate)

  // ---------- CONCILIAÇÃO com a aba Visão geral ----------
  // O placar acima e os cartões da Visão geral respondem coisas diferentes e
  // por isso dão números diferentes: aqui é LÍQUIDO e só de mês FECHADO, lá é
  // BRUTO e inclui o mês corrente. Sem essa cascata na tela, a divergência
  // parece defeito — foi exatamente a pergunta que a dona do produto fez.
  let grossAllTime = 0
  let commissionsAllTime = 0
  let feesAllTime = 0
  let refundsAllTime = 0
  for (const month of revenueMonths) {
    const revenue = normalizeRevenueMonth(revenueByMonth[month], month)
    grossAllTime += revenue.gross
    commissionsAllTime += revenue.affiliateCommissions
    feesAllTime += revenue.mpFees
    refundsAllTime += revenue.refunds
  }
  grossAllTime = round2(grossAllTime)
  commissionsAllTime = round2(commissionsAllTime)
  feesAllTime = round2(feesAllTime)
  refundsAllTime = round2(refundsAllTime)
  const netAllTime = round2(grossAllTime - commissionsAllTime - feesAllTime - refundsAllTime)
  return {
    generatedAt: now.toISOString(),
    currentMonth,
    config: {
      usdBrlRate: config.usdBrlRate,
      recurringStartMonth: config.recurring.startMonth,
      claudeMonthly: config.recurring.claude,
      vpsMonthly: config.recurring.vps,
      fixedMonthlyCost,
    },
    past,
    summary: {
      // ---- O QUE O PLACAR USA: tudo que já entrou contra tudo que já saiu,
      // incluindo a parte JÁ REALIZADA do mês corrente. É a única leitura que
      // responde "já se pagou?" sem esconder dinheiro que está no bolso.
      netToDate,
      investedToDate,
      resultToDate,
      roiPctToDate: investedToDate > 0 ? round2((resultToDate / investedToDate) * 100) : null,
      // ---- Meses FECHADOS, sem o mês corrente: é o que a tabela do passado
      // soma, e o que serve para comparar mês com mês sem meio mês no meio.
      monthsClosed: past.length,
      totalNetRevenue: totalNet,
      totalInvested,
      netResult: round2(totalNet - totalInvested),
      roiPct: totalInvested > 0 ? round2(((totalNet - totalInvested) / totalInvested) * 100) : null,
      cumulativeProfit,
      // Incluindo o mês corrente projetado — rotulado à parte de propósito.
      cumulativeProfitWithCurrent: cumulativeIncludingPresent,
    },
    // Cascata que liga o número daqui ao da Visão geral, linha por linha.
    reconciliation: {
      grossAllTime,
      affiliateCommissionsAllTime: commissionsAllTime,
      mpFeesAllTime: feesAllTime,
      refundsAllTime,
      netAllTime,
      // O mês corrente entra no placar, então a cascata termina nele. A linha
      // do mês fechado fica como detalhe, para conferir com a tabela.
      currentMonthGross: currentRevenue.gross,
      currentMonthNet: currentRevenue.net,
      // Confere: netAllTime === netToDate (o placar cobre todo o histórico).
      netToDate,
      // Confere: netToDate − currentMonthNet === totalNetRevenue.
      netClosedMonths: totalNet,
    },
    present,
    growth,
    future: {
      startMonth: futureStart,
      months: Math.max(1, projectionMonths),
      baselineNet: baseline,
      capacityCustomers,
      revenueCeiling,
      scenarios,
    },
  }
}
