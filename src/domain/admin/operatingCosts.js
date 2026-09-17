/**
 * Custos de operação do BOTinho — o outro lado da conta do ROI.
 *
 * O Financeiro sempre soube quanto ENTRA (pagamentos aprovados) e o que sai
 * para afiliados e para o Mercado Pago. O que nunca esteve em lugar nenhum é
 * quanto custa MANTER o produto de pé: a assinatura do Claude (onde o produto
 * é construído) e o servidor. Sem isso, "receita" não é lucro e não havia como
 * responder a pergunta que a dona do produto faz: valeu a pena até agora, e
 * quando passa a valer?
 *
 * Como o ledger funciona:
 *
 * - `HISTORICAL_COSTS` são as faturas JÁ PAGAS, uma linha por fatura, com o mês
 *   em que saiu do bolso. É dado, não estimativa.
 * - A partir de `RECURRING_COSTS.startMonth` o custo passa a ser o PATAMAR FIXO
 *   mensal (Claude + VPS). Todo mês a partir dali, inclusive os futuros, usa
 *   esse valor — é o que a dona do produto se comprometeu a gastar.
 * - Fatura em dólar é guardada EM DÓLAR (`amountUsd`) e convertida na leitura
 *   pela cotação de `USD_BRL_RATE`. Guardar já convertido esconderia a moeda
 *   original e travaria a conta numa cotação que ninguém lembra de onde saiu.
 *
 * ⚠️ Setembro/2026 é o mês da virada: a fatura de R$ 535,22 (17/09) é o que
 * estabeleceu o novo patamar do Claude, e por decisão da dona do produto
 * set/2026 entra com o custo fixo cheio (R$ 565), que é MAIOR que a fatura —
 * ou seja, a conta do passado nunca fica subestimada. Por isso as faturas
 * históricas do Claude param em agosto: setembro em diante vem da recorrência,
 * e somar os dois contaria o mesmo mês duas vezes.
 *
 * Módulo PURO: sem banco, sem rede, sem `Date.now()` implícito.
 */

export const COST_CATEGORIES = Object.freeze({
  CLAUDE: 'claude',
  VPS: 'vps',
})

export const COST_CATEGORY_LABELS = Object.freeze({
  [COST_CATEGORIES.CLAUDE]: 'Claude (desenvolvimento)',
  [COST_CATEGORIES.VPS]: 'Servidor (VPS)',
})

/** Cotação usada para converter fatura em dólar. Ajustável por env. */
export const DEFAULT_USD_BRL_RATE = 5.8

/**
 * Faturas já pagas. Claude em reais (fatura em R$); VPS em dólar.
 *
 * As quatro faturas da VPS não tinham data informada — foram distribuídas nos
 * quatro meses anteriores ao início do custo fixo, na ordem dos valores.
 * Corrigir data aqui é uma linha.
 */
export const HISTORICAL_COSTS = Object.freeze([
  { month: '2026-04', category: COST_CATEGORIES.CLAUDE, amountBrl: 110, note: 'Fatura de 21/04' },
  { month: '2026-05', category: COST_CATEGORIES.CLAUDE, amountBrl: 110, note: 'Fatura de 21/05' },
  { month: '2026-06', category: COST_CATEGORIES.CLAUDE, amountBrl: 110, note: 'Fatura de 21/06' },
  { month: '2026-06', category: COST_CATEGORIES.CLAUDE, amountBrl: 5, note: 'Fatura de 30/06' },
  { month: '2026-06', category: COST_CATEGORIES.CLAUDE, amountBrl: 5, note: 'Fatura de 30/06' },
  { month: '2026-07', category: COST_CATEGORIES.CLAUDE, amountBrl: 110, note: 'Fatura de 21/07' },
  { month: '2026-08', category: COST_CATEGORIES.CLAUDE, amountBrl: 110, note: 'Fatura de 21/08' },
  { month: '2026-05', category: COST_CATEGORIES.VPS, amountUsd: 5.59, note: 'Fatura da hospedagem' },
  { month: '2026-06', category: COST_CATEGORIES.VPS, amountUsd: 17.78, note: 'Fatura da hospedagem' },
  { month: '2026-07', category: COST_CATEGORIES.VPS, amountUsd: 17.78, note: 'Fatura da hospedagem' },
  { month: '2026-08', category: COST_CATEGORIES.VPS, amountUsd: 10.59, note: 'Fatura da hospedagem (servidor ampliado)' },
])

/** Patamar fixo mensal a partir de `startMonth` (inclusive). */
export const RECURRING_COSTS = Object.freeze({
  startMonth: '2026-09',
  [COST_CATEGORIES.CLAUDE]: 565,
  [COST_CATEGORIES.VPS]: 190,
})

const MONTH_RE = /^(\d{4})-(\d{2})$/

export function isMonthKey(value) {
  return MONTH_RE.test(String(value ?? ''))
}

/** '2026-09' -> 2026*12 + 8. Usado só para comparar/andar meses. */
export function monthIndex(monthKey) {
  const match = MONTH_RE.exec(String(monthKey ?? ''))
  if (!match) return null
  return Number(match[1]) * 12 + (Number(match[2]) - 1)
}

export function monthKeyFromIndex(index) {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

export function addMonths(monthKey, amount) {
  const index = monthIndex(monthKey)
  if (index === null) return null
  return monthKeyFromIndex(index + amount)
}

/** Mês de uma data, no fuso de Brasília — é lá que o dinheiro acontece. */
export function monthKeyOf(date, timeZone = 'America/Sao_Paulo') {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(value)
    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    if (year && month) return `${year}-${month}`
  } catch {
    // Fuso inválido nunca pode derrubar a conta — cai para UTC.
  }
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
}

export function round2(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric * 100) / 100
}

function positiveNumber(raw, fallback) {
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback
}

/**
 * Configuração efetiva do ledger, com os pontos ajustáveis por env:
 * `USD_BRL_RATE`, `COST_CLAUDE_MONTHLY_BRL`, `COST_VPS_MONTHLY_BRL`,
 * `COST_RECURRING_START_MONTH`.
 */
export function resolveCostConfig(env = process.env) {
  const usdBrlRate = positiveNumber(env?.USD_BRL_RATE, DEFAULT_USD_BRL_RATE)
  const startMonth = isMonthKey(env?.COST_RECURRING_START_MONTH)
    ? env.COST_RECURRING_START_MONTH
    : RECURRING_COSTS.startMonth
  return {
    usdBrlRate,
    recurring: {
      startMonth,
      [COST_CATEGORIES.CLAUDE]: positiveNumber(env?.COST_CLAUDE_MONTHLY_BRL, RECURRING_COSTS[COST_CATEGORIES.CLAUDE]),
      [COST_CATEGORIES.VPS]: positiveNumber(env?.COST_VPS_MONTHLY_BRL, RECURRING_COSTS[COST_CATEGORIES.VPS]),
    },
    historical: HISTORICAL_COSTS,
  }
}

/** Valor da fatura em reais (converte o que está em dólar). */
export function costEntryAmountBrl(entry, usdBrlRate = DEFAULT_USD_BRL_RATE) {
  if (Number.isFinite(entry?.amountBrl)) return round2(entry.amountBrl)
  if (Number.isFinite(entry?.amountUsd)) return round2(entry.amountUsd * usdBrlRate)
  return 0
}

export function monthlyRecurringCost(config) {
  const recurring = config?.recurring ?? RECURRING_COSTS
  return round2((recurring[COST_CATEGORIES.CLAUDE] ?? 0) + (recurring[COST_CATEGORIES.VPS] ?? 0))
}

/**
 * Custo de UM mês: patamar fixo a partir de `startMonth`, faturas reais antes.
 * Devolve também a composição por categoria e de onde veio o número.
 */
export function costForMonth(monthKey, config = resolveCostConfig()) {
  const index = monthIndex(monthKey)
  const startIndex = monthIndex(config?.recurring?.startMonth)
  if (index === null) {
    return { month: monthKey, claude: 0, vps: 0, total: 0, source: 'desconhecido', entries: [] }
  }

  if (startIndex !== null && index >= startIndex) {
    const claude = round2(config.recurring[COST_CATEGORIES.CLAUDE] ?? 0)
    const vps = round2(config.recurring[COST_CATEGORIES.VPS] ?? 0)
    return { month: monthKey, claude, vps, total: round2(claude + vps), source: 'fixo', entries: [] }
  }

  const entries = (config?.historical ?? []).filter(entry => entry.month === monthKey)
  let claude = 0
  let vps = 0
  for (const entry of entries) {
    const amount = costEntryAmountBrl(entry, config.usdBrlRate)
    if (entry.category === COST_CATEGORIES.VPS) vps += amount
    else claude += amount
  }
  return {
    month: monthKey,
    claude: round2(claude),
    vps: round2(vps),
    total: round2(claude + vps),
    source: entries.length ? 'realizado' : 'sem_custo',
    entries: entries.map(entry => ({ ...entry, amountBrl: costEntryAmountBrl(entry, config.usdBrlRate) })),
  }
}

/** Primeiro mês com custo conhecido — é onde a linha do tempo começa. */
export function firstCostMonth(config = resolveCostConfig()) {
  const months = (config?.historical ?? []).map(entry => entry.month).filter(isMonthKey).sort()
  return months[0] ?? config?.recurring?.startMonth ?? null
}

export function costSeries(fromMonth, toMonth, config = resolveCostConfig()) {
  const from = monthIndex(fromMonth)
  const to = monthIndex(toMonth)
  if (from === null || to === null || to < from) return []
  const series = []
  for (let index = from; index <= to; index += 1) series.push(costForMonth(monthKeyFromIndex(index), config))
  return series
}
