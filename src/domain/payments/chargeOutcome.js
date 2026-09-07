/**
 * Retorno do banco/Mercado Pago em uma tentativa de cobrança — regras PURAS.
 *
 * Fonte ÚNICA da tradução: a mesma tabela é usada pela aba Financeiro do admin
 * e pelo `scripts/diag-assinatura-recusada.mjs`. Duplicada, tela e script
 * discordariam sobre o motivo da recusa e não haveria como saber qual está
 * certo (mesma lição de `signupOrigin.js`).
 *
 * O código cru (`status_detail`) NUNCA é escondido: quem opera precisa dele
 * para falar com o Mercado Pago. O que a tradução acrescenta é DE QUEM É A
 * AÇÃO — sem isso o mesmo código manda a pessoa fazer coisas opostas (trocar de
 * cartão, esperar, ligar para o banco, ou consertar algo nosso).
 */

/** Quem precisa agir. É o que muda a conversa com a cliente. */
export const CHARGE_ACTION_OWNERS = Object.freeze({
  NINGUEM: 'ninguem',
  CLIENTE: 'cliente',
  NOSSA: 'nossa',
  MERCADO_PAGO: 'mercado_pago',
  ESPERAR: 'esperar',
})

/**
 * Códigos de retorno do Mercado Pago (`status_detail`). Linguagem leiga: nada
 * de "antifraude", "gateway", "chargeback" na frase que a pessoa lê.
 */
export const CHARGE_STATUS_DETAILS = Object.freeze({
  accredited: { texto: 'Aprovado — o dinheiro entrou.', dono: CHARGE_ACTION_OWNERS.NINGUEM },
  pending_contingency: { texto: 'Em análise pelo Mercado Pago — costuma resolver sozinho.', dono: CHARGE_ACTION_OWNERS.ESPERAR },
  pending_review_manual: { texto: 'Em análise manual pelo Mercado Pago.', dono: CHARGE_ACTION_OWNERS.ESPERAR },
  pending_waiting_payment: { texto: 'Esperando a cliente pagar (Pix/boleto gerado).', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  pending_waiting_transfer: { texto: 'Esperando a transferência da cliente.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_high_risk: { texto: 'O Mercado Pago barrou por suspeita. NÃO foi o banco dela. Ação nossa: não deixar repetir tentativa idêntica; ação dela: pagar do aparelho e cartão que costuma usar.', dono: CHARGE_ACTION_OWNERS.NOSSA },
  cc_rejected_duplicated_payment: { texto: 'O Mercado Pago entendeu como cobrança repetida. Ação nossa: espaçar as tentativas.', dono: CHARGE_ACTION_OWNERS.NOSSA },
  cc_rejected_insufficient_amount: { texto: 'Sem limite ou saldo no cartão. Ação dela: usar outro cartão.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_call_for_authorize: { texto: 'O banco quer que ela autorize a compra. Ação dela: ligar para o banco e liberar.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_card_disabled: { texto: 'Cartão não habilitado para compra on-line. Ação dela: falar com o banco.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_card_type_not_allowed: { texto: 'Esse tipo de cartão não é aceito. Ação dela: usar cartão de crédito.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_card_error: { texto: 'O banco não conseguiu processar o cartão. Ação dela: tentar de novo ou usar outro.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_invalid_installments: { texto: 'O parcelamento pedido não é aceito nesse cartão.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_max_attempts: { texto: 'Tentativas demais no mesmo cartão. Ação dela: esperar e usar outro.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_blacklist: { texto: 'Recusado por restrição do próprio Mercado Pago. Ação dela: falar com o Mercado Pago.', dono: CHARGE_ACTION_OWNERS.MERCADO_PAGO },
  cc_rejected_other_reason: { texto: 'O banco recusou sem dizer o motivo. Ação dela: outro cartão ou o pagamento avulso.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_bad_filled_card_number: { texto: 'Número do cartão digitado errado.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_bad_filled_date: { texto: 'Validade digitada errada.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_bad_filled_security_code: { texto: 'Código de segurança digitado errado.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_rejected_bad_filled_other: { texto: 'Algum dado do cartão digitado errado.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  cc_amount_rate_limit_exceeded: { texto: 'Valor acima do limite permitido para esse meio de pagamento.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  rejected_insufficient_data: { texto: 'Faltou dado obrigatório na cobrança.', dono: CHARGE_ACTION_OWNERS.NOSSA },
  rejected_by_bank: { texto: 'O banco emissor recusou. Ação dela: falar com o banco ou usar outro cartão.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  expired: { texto: 'A cobrança venceu sem ser paga.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
  by_collector: { texto: 'Cancelada por nós.', dono: CHARGE_ACTION_OWNERS.NOSSA },
  by_payer: { texto: 'Cancelada pela própria cliente.', dono: CHARGE_ACTION_OWNERS.CLIENTE },
})

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * @returns {{ code: string|null, label: string, owner: string, known: boolean }}
 */
export function describeChargeStatusDetail(statusDetail) {
  const code = normalize(statusDetail)
  if (!code) {
    return { code: null, label: 'O Mercado Pago não informou o motivo.', owner: CHARGE_ACTION_OWNERS.NINGUEM, known: false }
  }
  const found = CHARGE_STATUS_DETAILS[code]
  if (!found) {
    // Código novo não pode virar tela vazia: mostra o código cru e diz que
    // ele não está na nossa lista, em vez de fingir que sabe o que significa.
    return { code, label: `Motivo fora da nossa lista ("${code}") — conferir na tabela de recusas do Mercado Pago.`, owner: CHARGE_ACTION_OWNERS.NINGUEM, known: false }
  }
  return { code, label: found.texto, owner: found.dono, known: true }
}

/** Status da tentativa em três baldes, que são as três ações possíveis. */
export function classifyChargeOutcome(status) {
  const value = normalize(status)
  if (['approved', 'accredited', 'processed'].includes(value)) return 'aprovada'
  if (['rejected', 'cancelled', 'expired'].includes(value)) return 'recusada'
  if (['refunded', 'charged_back'].includes(value)) return 'devolvida'
  if (!value) return 'desconhecida'
  return 'pendente'
}

export function describeChargeStatus(status) {
  switch (classifyChargeOutcome(status)) {
    case 'aprovada': return 'Cobrou'
    case 'recusada': return 'Recusada'
    case 'devolvida': return 'Estornada'
    case 'pendente': return 'Em andamento'
    default: return 'Sem informação'
  }
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Resumo do período. Tudo PURO: a tela não recalcula nada por conta própria,
 * senão dois lugares passam a discordar sobre a taxa de sucesso.
 *
 * `clientesEmRisco` é o número que mais importa: assinatura cuja ÚLTIMA
 * tentativa foi recusada é receita que já existe e está indo embora sem
 * ninguém decidir nada (churn involuntário).
 */
export function summarizeSubscriptionCharges(charges = []) {
  const rows = Array.isArray(charges) ? charges : []
  const resumo = {
    tentativas: rows.length,
    aprovadas: 0,
    recusadas: 0,
    pendentes: 0,
    devolvidas: 0,
    valorAprovado: 0,
    valorRecusado: 0,
    taxaSucesso: null,
    motivos: [],
    clientesEmRisco: 0,
    assinaturasCobradas: 0,
  }

  const porMotivo = new Map()
  const ultimaPorAssinatura = new Map()
  const assinaturasComAprovacao = new Set()

  for (const row of rows) {
    const outcome = classifyChargeOutcome(row?.status)
    const valor = Number(row?.amount) || 0
    const chave = row?.mpSubscriptionId || row?.subscriptionId || row?.userId || null
    const quando = toDate(row?.attemptedAt)

    if (outcome === 'aprovada') {
      resumo.aprovadas += 1
      resumo.valorAprovado += valor
      if (chave) assinaturasComAprovacao.add(chave)
    } else if (outcome === 'recusada') {
      resumo.recusadas += 1
      resumo.valorRecusado += valor
      const { code, label } = describeChargeStatusDetail(row?.statusDetail)
      const id = code ?? 'sem_motivo'
      const atual = porMotivo.get(id) ?? { code: id, label, total: 0, valor: 0 }
      atual.total += 1
      atual.valor += valor
      porMotivo.set(id, atual)
    } else if (outcome === 'devolvida') {
      resumo.devolvidas += 1
    } else if (outcome === 'pendente') {
      resumo.pendentes += 1
    }

    if (chave) {
      const anterior = ultimaPorAssinatura.get(chave)
      const anteriorQuando = anterior ? toDate(anterior.attemptedAt) : null
      if (!anterior || (quando && anteriorQuando && quando > anteriorQuando) || (quando && !anteriorQuando)) {
        ultimaPorAssinatura.set(chave, row)
      }
    }
  }

  for (const row of ultimaPorAssinatura.values()) {
    if (classifyChargeOutcome(row?.status) === 'recusada') resumo.clientesEmRisco += 1
  }

  const decididas = resumo.aprovadas + resumo.recusadas
  resumo.taxaSucesso = decididas > 0 ? Math.round((resumo.aprovadas / decididas) * 1000) / 10 : null
  resumo.assinaturasCobradas = assinaturasComAprovacao.size
  resumo.valorAprovado = Math.round(resumo.valorAprovado * 100) / 100
  resumo.valorRecusado = Math.round(resumo.valorRecusado * 100) / 100
  resumo.motivos = [...porMotivo.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(motivo => ({ ...motivo, valor: Math.round(motivo.valor * 100) / 100 }))

  return resumo
}

/**
 * Linha pronta para a tela. O identificador do provedor CONTINUA aqui, ao
 * contrário do painel da cliente: quem opera precisa dele para abrir o caso no
 * Mercado Pago — esta rota é do admin e exige `billing:read`.
 */
export function presentSubscriptionCharge(row, { email = null } = {}) {
  const detail = describeChargeStatusDetail(row?.statusDetail)
  return {
    id: row?.id ?? null,
    email,
    userId: row?.userId ?? null,
    plan: row?.plan ?? null,
    amount: row?.amount ?? null,
    attemptedAt: row?.attemptedAt ?? null,
    outcome: classifyChargeOutcome(row?.status),
    statusLabel: describeChargeStatus(row?.status),
    providerStatus: row?.status ?? null,
    returnCode: detail.code,
    returnMessage: detail.label,
    actionOwner: detail.owner,
    knownReturnCode: detail.known,
    paymentMethod: row?.paymentMethod ?? null,
    retryAttempt: row?.retryAttempt ?? null,
    nextRetryAt: row?.nextRetryAt ?? null,
    mpSubscriptionId: row?.mpSubscriptionId ?? null,
    mpPaymentId: row?.mpPaymentId ?? null,
    mpAuthorizedPaymentId: row?.mpAuthorizedPaymentId ?? null,
    source: row?.source ?? null,
  }
}
