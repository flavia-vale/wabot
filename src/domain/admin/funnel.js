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

// A ordem é a JORNADA da cliente, não a ordem em que os dados aparecem no
// banco (pedido da dona do produto, 2026-09-05): ela conecta o WhatsApp,
// cadastra a loja, escolhe os grupos, vê a primeira oferta sair e só então
// paga. Cadastro da loja e escolha dos grupos já eram carregados para explicar
// POR QUE a pessoa parou — viraram etapas próprias sem nenhuma consulta nova.
//
// ⚠️ As etapas não são obrigatórias nesta sequência (dá para escolher grupo
// antes de cadastrar a loja). O que a torna legível como pipeline é a regra de
// implicação abaixo: etapa posterior alcançada conta as anteriores.
export const FUNNEL_STEPS = Object.freeze([
  { key: 'signups', label: 'Criaram a conta', short: 'Criou a conta' },
  { key: 'connected', label: 'Conectaram o WhatsApp', short: 'Conectou o WhatsApp' },
  { key: 'store', label: 'Cadastraram a loja', short: 'Cadastrou a loja' },
  { key: 'groups', label: 'Escolheram os grupos', short: 'Escolheu os grupos' },
  { key: 'delivered', label: 'Tiveram oferta publicada', short: 'Primeira oferta' },
  { key: 'checkout', label: 'Começaram o pagamento', short: 'Foi pagar' },
  { key: 'paid', label: 'Pagaram', short: 'Pagou' },
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
  triedPairingUserIds = new Set(),
  credentialUserIds = new Set(),
  sourceGroupUserIds = new Set(),
  destGroupUserIds = new Set(),
  attemptedUserIds = new Set(),
  // Conjunto vazio = não sabemos quem segue conectada (chamada antiga, consulta
  // que falhou). Nesse caso a classificação NÃO separa churn — ver
  // `classifyStallReason`.
  stillConnectedUserIds = new Set(),
  stoppedByUserIds = new Set(),
  peoplePerReason = 8,
} = {}) {
  const totals = { signups: 0, connected: 0, store: 0, groups: 0, delivered: 0, checkout: 0, paid: 0 }
  const byWeek = new Map()
  const byOrigin = new Map()
  const timeToPaid = []
  const timeToDelivery = []

  const emptyCounters = () => ({ signups: 0, connected: 0, store: 0, groups: 0, delivered: 0, checkout: 0, paid: 0 })
  const stallCounts = new Map()
  const stallPeople = new Map()

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
    const hasStore = credentialUserIds.has(id)
    const hasGroups = sourceGroupUserIds.has(id) && destGroupUserIds.has(id)
    const reached = {
      signups: true,
      connected: connected || delivered || checkout || paid,
      // Quem teve oferta publicada obviamente tinha loja e grupos na época —
      // mesmo que tenha apagado depois. Sem a implicação, o pipeline mostraria
      // etapa posterior maior que a anterior, que só confunde quem lê.
      store: hasStore || delivered || paid,
      groups: hasGroups || delivered || paid,
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

    // POR QUE parou — só para quem não pagou.
    const stallReason = classifyStallReason({
      triedPairing: triedPairingUserIds.has(id) || reached.connected,
      connected: reached.connected,
      hasCredential: hasStore,
      hasSourceGroup: sourceGroupUserIds.has(id),
      hasDestGroup: destGroupUserIds.has(id),
      attempted: attemptedUserIds.has(id) || delivered,
      delivered: reached.delivered,
      checkout: reached.checkout,
      paid,
      stillConnected: stillConnectedUserIds.size ? stillConnectedUserIds.has(id) : undefined,
      stoppedByUser: stoppedByUserIds.has(id),
    })
    if (stallReason) {
      stallCounts.set(stallReason, (stallCounts.get(stallReason) ?? 0) + 1)
      if (!stallPeople.has(stallReason)) stallPeople.set(stallReason, [])
      const lista = stallPeople.get(stallReason)
      // Lista curta de propósito: ela existe para a conversa começar hoje, não
      // para virar exportação de base.
      if (lista.length < peoplePerReason) {
        lista.push({ id, name: user.name ?? null, email: user.email ?? null, createdAt: user.createdAt ?? null })
      }
    }

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
      short: step.short,
      position: index + 1,
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
    pctStore: pct(row.store, row.signups),
    pctGroups: pct(row.groups, row.signups),
    pctDelivered: pct(row.delivered, row.signups),
    pctPaid: pct(row.paid, row.signups),
  })

  const naoPagaram = totals.signups - totals.paid
  const stalls = STALL_REASONS
    .map((reason) => ({
      key: reason.key,
      label: reason.label,
      hint: reason.hint,
      count: stallCounts.get(reason.key) ?? 0,
      pctOfUnpaid: pct(stallCounts.get(reason.key) ?? 0, naoPagaram),
      people: stallPeople.get(reason.key) ?? [],
    }))
    .filter((reason) => reason.count > 0)
    .sort((a, b) => b.count - a.count)

  return {
    totals,
    steps,
    stalls,
    unpaidCount: naoPagaram,
    biggestDrop: biggestDrop && biggestDrop.lostFromPrevious > 0
      ? { key: biggestDrop.key, label: biggestDrop.label, lost: biggestDrop.lostFromPrevious }
      : null,
    weeks: [...byWeek.values()].sort((a, b) => (a.week < b.week ? 1 : -1)).map(withRates),
    origins: [...byOrigin.values()].sort((a, b) => b.signups - a.signups).map(withRates),
    medianDaysToDelivery: median(timeToDelivery),
    medianDaysToPaid: median(timeToPaid),
  }
}

/**
 * POR QUE parou — os oito motivos, na ordem em que o produto os produz.
 *
 * A ordem importa: a classificação devolve o PRIMEIRO motivo que se aplica,
 * porque é o primeiro obstáculo que a pessoa encontrou. Alguém sem credencial
 * e sem grupo parou na credencial; dizer "sem grupo" mandaria a conversa para
 * o lugar errado.
 *
 * `hint` é o que fazer — a tela existe para virar ação, não para informar.
 */
export const STALL_REASONS = Object.freeze([
  {
    key: 'never_tried_pairing',
    label: 'Nem chegou a pedir a conexão do WhatsApp',
    hint: 'Criou a conta e não abriu a tela de conectar. Aqui a conversa é de confiança e de expectativa — ela ainda não decidiu entregar o número.',
  },
  {
    // Separado do de cima porque são problemas OPOSTOS: um é decisão da
    // pessoa, o outro é obstáculo nosso (QR que não lê, servidor sem vaga,
    // recusa do WhatsApp). Juntos, viravam um balde cego onde defeito de
    // produto se escondia atrás de "ela não quis".
    key: 'pairing_failed',
    label: 'Tentou conectar o WhatsApp e NÃO conseguiu',
    hint: 'Ela quis, pediu a conexão e não chegou a conectar. Isso é obstáculo nosso: leitura do QR, servidor sem vaga ou recusa do WhatsApp. Vale abrir o histórico dela e ver o que aconteceu.',
  },
  {
    key: 'no_credential',
    label: 'Conectou, mas não cadastrou nenhuma loja',
    hint: 'Sem a etiqueta de afiliada o robô não publica nada — ele se recusa a mandar link que daria comissão para outra pessoa.',
  },
  {
    key: 'no_source_group',
    label: 'Tem loja cadastrada, falta escolher de onde vêm as ofertas',
    hint: 'Falta indicar os grupos ou canais que o robô deve acompanhar.',
  },
  {
    key: 'no_dest_group',
    label: 'Tem origem, falta escolher para onde as ofertas vão',
    hint: 'Falta indicar o grupo ou canal dela, onde a oferta deve aparecer.',
  },
  {
    key: 'tried_nothing_sent',
    label: 'O robô tentou e NENHUMA oferta saiu',
    hint: 'O pior caso: o painel mostra atividade e nada chega no grupo. Quase sempre é loja sem cadastro completo ou chave recusada. Ela acha que o produto é fraco.',
  },
  {
    key: 'configured_never_sent',
    label: 'Configurou tudo e nunca chegou a enviar',
    hint: 'Montou e não usou. Vale perguntar se as origens escolhidas publicam oferta de verdade.',
  },
  {
    // E1 do plano de ativação de 2026-09-08. Antes, estas caíam em
    // `sent_no_checkout` junto com quem está usando o robô agora — e as duas
    // conversas são opostas: uma é "por que você não comprou", a outra é "por
    // que você parou de usar". Na medição de 60 dias, 52 contas tiveram envio
    // real e só 19 seguiam conectadas: 33 pessoas viram o robô funcionando e
    // hoje estão fora, contadas como se nunca tivessem ativado.
    key: 'activated_then_stopped',
    label: 'Usou o robô e DESLIGOU por escolha',
    hint: 'Ela viu funcionar e pediu para desconectar. Desligar é decisão, não defeito — a pergunta aqui é o que deixou de valer a pena.',
  },
  {
    key: 'activated_then_dropped',
    label: 'Usou o robô e a conexão CAIU',
    hint: 'Viu funcionar e hoje está fora do ar sem ter pedido. Isso é confiabilidade, não preço: confira as quedas dela antes de tratar como desistência.',
  },
  {
    key: 'sent_no_checkout',
    label: 'Está usando o robô e não foi para o pagamento',
    hint: 'Aqui o produto funcionou e ela continua conectada. Se este grupo for grande, o assunto é preço, prazo do teste ou confiança — não configuração.',
  },
  {
    key: 'checkout_no_payment',
    label: 'Começou o pagamento e não concluiu',
    hint: 'Parou no Mercado Pago. Vale conferir se o e-mail da conta é aceito e se o meio de pagamento é o que ela usa.',
  },
])

const STALL_REASON_BY_KEY = new Map(STALL_REASONS.map((reason) => [reason.key, reason]))

/**
 * Devolve o motivo (chave) ou `null` para quem pagou.
 *
 * As etapas NÃO são uma sequência obrigatória — dá para escolher grupo sem ter
 * salvado a loja —, então a leitura correta é "primeiro obstáculo encontrado",
 * nunca "última etapa concluída".
 */
export function classifyStallReason({
  triedPairing = false,
  connected = false,
  hasCredential = false,
  hasSourceGroup = false,
  hasDestGroup = false,
  attempted = false,
  delivered = false,
  checkout = false,
  paid = false,
  stillConnected = undefined,
  stoppedByUser = false,
} = {}) {
  if (paid) return null
  // "Pediu a conexão" e "conectou" são sinais diferentes: o primeiro é a
  // sessão criada quando ela clica em conectar; o segundo é o WhatsApp ter
  // aceitado de fato.
  if (!connected) return triedPairing ? 'pairing_failed' : 'never_tried_pairing'
  if (!hasCredential) return 'no_credential'
  if (!hasSourceGroup) return 'no_source_group'
  if (!hasDestGroup) return 'no_dest_group'
  // Separado de "nunca enviou": aqui o robô TENTOU e não publicou nenhuma vez.
  if (attempted && !delivered) return 'tried_nothing_sent'
  if (!delivered) return 'configured_never_sent'
  if (!checkout) {
    // "Nunca ativou" e "ativou e largou" pedem conversas opostas, e antes eram
    // o mesmo balde. Só separamos quando SABEMOS que ela não está mais
    // conectada: `stillConnected` indefinido mantém o motivo histórico — dado
    // faltando não pode virar acusação de churn.
    if (stillConnected === false) {
      return stoppedByUser ? 'activated_then_stopped' : 'activated_then_dropped'
    }
    return 'sent_no_checkout'
  }
  return 'checkout_no_payment'
}

export function describeStallReason(key) {
  return STALL_REASON_BY_KEY.get(key) ?? null
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return Math.round(value * 10) / 10
}
