/**
 * Funil de ativação para o painel admin: cadastro → conectou o WhatsApp →
 * primeira oferta entregue → começou o pagamento → pagou.
 *
 * Módulo PURO (padrão da casa, igual a `customerHistory.js`): recebe as linhas
 * já carregadas e devolve a tela pronta. Nada aqui importa `db.js`, então o
 * teste roda sem banco.
 *
 * Duas decisões que mudam a leitura e não podem regredir:
 *
 * 1. **"Enviou" é só envio com SUCESSO.** A linha mais comum de quem não
 *    cadastrou a etiqueta de afiliada é `skip:no_valid_conversions` — o robô se
 *    recusa a publicar link não convertido para não dar a comissão ao
 *    concorrente. Contar qualquer linha de `MessageLog` colocaria no grupo "viu
 *    o produto funcionar" justamente quem nunca teve uma oferta publicada.
 * 2. **Coorte é a semana do CADASTRO**, não a semana do evento. Só assim
 *    "quantos dos que entraram em agosto pagaram" faz sentido; misturar as duas
 *    coisas produz percentual acima de 100% quando alguém paga semanas depois.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export const FUNNEL_STEPS = Object.freeze([
  { key: 'signups', label: 'Criaram a conta' },
  { key: 'connected', label: 'Conectaram o WhatsApp' },
  { key: 'delivered', label: 'Tiveram oferta publicada' },
  { key: 'checkout', label: 'Começaram o pagamento' },
  { key: 'paid', label: 'Pagaram' },
])

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Segunda-feira (UTC) da semana da data — âncora estável das coortes. */
export function startOfWeek(value) {
  const date = toDate(value)
  if (!date) return null
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = (monday.getUTCDay() + 6) % 7
  return new Date(monday.getTime() - weekday * DAY_MS)
}

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function daysBetween(from, to) {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return null
  return Math.round(((b - a) / DAY_MS) * 10) / 10
}

/**
 * @param {object} input
 * @param {Array<{id:string, createdAt:Date}>} input.users cadastros da janela
 * @param {Map<string, object>} input.originByUserId metadata de origem já resolvida
 * @param {Set<string>} input.connectedUserIds quem chegou a conectar o WhatsApp
 * @param {Map<string, Date>} input.firstDeliveryByUserId 1º envio com sucesso
 * @param {Map<string, Date>} input.firstCheckoutByUserId 1º checkout iniciado
 * @param {Map<string, Date>} input.firstPaymentByUserId 1º pagamento aprovado
 */
export function buildActivationFunnel({
  users = [],
  originByUserId = new Map(),
  connectedUserIds = new Set(),
  firstDeliveryByUserId = new Map(),
  firstCheckoutByUserId = new Map(),
  firstPaymentByUserId = new Map(),
} = {}) {
  const totals = { signups: 0, connected: 0, delivered: 0, checkout: 0, paid: 0 }
  const byWeek = new Map()
  const byOrigin = new Map()
  const timeToPaid = []
  const timeToDelivery = []

  const emptyCounters = () => ({ signups: 0, connected: 0, delivered: 0, checkout: 0, paid: 0 })

  for (const user of users) {
    const id = user?.id
    if (!id) continue

    const connected = connectedUserIds.has(id)
    const delivered = firstDeliveryByUserId.has(id)
    const checkout = firstCheckoutByUserId.has(id)
    const paid = firstPaymentByUserId.has(id)

    // Etapa alcançada implica as anteriores: quem pagou passou pelo cadastro,
    // e quem teve oferta publicada obviamente conectou. Sem isso o funil mostra
    // etapa posterior maior que a anterior quando um sinal antigo se perdeu
    // (retenção de evento, conta migrada), o que só confunde quem lê.
    const reached = {
      signups: true,
      connected: connected || delivered || checkout || paid,
      delivered: delivered || paid,
      checkout: checkout || paid,
      paid,
    }

    for (const step of FUNNEL_STEPS) if (reached[step.key]) totals[step.key] += 1

    const week = startOfWeek(user.createdAt)
    const weekKey = week ? week.toISOString().slice(0, 10) : 'sem data'
    if (!byWeek.has(weekKey)) byWeek.set(weekKey, { week: weekKey, ...emptyCounters() })
    const weekRow = byWeek.get(weekKey)
    for (const step of FUNNEL_STEPS) if (reached[step.key]) weekRow[step.key] += 1

    const origin = originByUserId.get(id)?.bucket ?? 'Sem registro'
    if (!byOrigin.has(origin)) byOrigin.set(origin, { origin, ...emptyCounters() })
    const originRow = byOrigin.get(origin)
    for (const step of FUNNEL_STEPS) if (reached[step.key]) originRow[step.key] += 1

    if (paid) {
      const dias = daysBetween(user.createdAt, firstPaymentByUserId.get(id))
      if (dias !== null) timeToPaid.push(dias)
    }
    if (delivered) {
      const dias = daysBetween(user.createdAt, firstDeliveryByUserId.get(id))
      if (dias !== null) timeToDelivery.push(dias)
    }
  }

  const steps = FUNNEL_STEPS.map((step, index) => {
    const previous = index === 0 ? totals.signups : totals[FUNNEL_STEPS[index - 1].key]
    return {
      key: step.key,
      label: step.label,
      count: totals[step.key],
      pctOfSignups: pct(totals[step.key], totals.signups),
      // Quanto se perde NESTA passagem — é o número que diz onde mexer.
      lostFromPrevious: index === 0 ? 0 : Math.max(0, previous - totals[step.key]),
      pctOfPrevious: index === 0 ? 100 : pct(totals[step.key], previous),
    }
  })

  const biggestDrop = steps
    .slice(1)
    .reduce((worst, step) => (worst && worst.lostFromPrevious >= step.lostFromPrevious ? worst : step), null)

  const withRates = (row) => ({
    ...row,
    pctConnected: pct(row.connected, row.signups),
    pctDelivered: pct(row.delivered, row.signups),
    pctPaid: pct(row.paid, row.signups),
  })

  return {
    totals,
    steps,
    biggestDrop: biggestDrop && biggestDrop.lostFromPrevious > 0
      ? { key: biggestDrop.key, label: biggestDrop.label, lost: biggestDrop.lostFromPrevious }
      : null,
    weeks: [...byWeek.values()].sort((a, b) => (a.week < b.week ? 1 : -1)).map(withRates),
    origins: [...byOrigin.values()].sort((a, b) => b.signups - a.signups).map(withRates),
    medianDaysToDelivery: median(timeToDelivery),
    medianDaysToPaid: median(timeToPaid),
  }
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return Math.round(value * 10) / 10
}
