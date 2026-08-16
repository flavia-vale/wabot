// Quando cada e-mail de ciclo de vida é devido. PURO: recebe uma "foto" do
// cliente e o `now`, devolve o e-mail que cabe agora. Sem banco, sem rede.
//
// Regra de convivência: no máximo UM e-mail de ciclo de vida por cliente por
// passada, na ordem de prioridade abaixo. Quem está com o plano vencendo não
// pode receber, no mesmo dia, convite de afiliada e aviso de robô parado — isso
// é o que transforma aviso útil em spam ignorado.
//
// A trava de repetição (o mesmo e-mail não sair duas vezes) NÃO mora aqui: é o
// `dedupDays` de cada e-mail no catálogo, aplicado pelo despachante.

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000

const PAID_PLANS = new Set(['basic', 'pro'])

export function formatDateBR(value, timeZone = 'America/Sao_Paulo') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date)
}

export function formatMoneyBR(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100)
}

/**
 * Dias inteiros que faltam até uma data (negativo = já passou).
 * O corte é por dia cheio para o aviso de "faltam 3 dias" não virar "faltam 2"
 * por causa de algumas horas de diferença.
 */
export function daysUntil(target, now) {
  if (!target) return null
  const diff = new Date(target).getTime() - new Date(now).getTime()
  if (!Number.isFinite(diff)) return null
  return Math.ceil(diff / MS_PER_DAY)
}

function hoursSince(value, now) {
  if (!value) return null
  const diff = new Date(now).getTime() - new Date(value).getTime()
  return Number.isFinite(diff) ? diff / MS_PER_HOUR : null
}

function daysSince(value, now) {
  const hours = hoursSince(value, now)
  return hours === null ? null : hours / 24
}

const COUNTDOWN_SLUGS = {
  trial: { 3: 'teste_acaba_em_3_dias', 2: 'teste_acaba_em_2_dias', 1: 'teste_acaba_em_1_dia' },
  paid: { 3: 'plano_vence_em_3_dias', 2: 'plano_vence_em_2_dias', 1: 'plano_vence_em_1_dia' },
}

/**
 * @param {object} snapshot foto do cliente (ver lifecycleSweep.js)
 * @param {Date|number} now
 * @returns {{ slug: string, vars: Record<string, any> } | null}
 */
export function decideLifecycleEmail(snapshot, now = new Date()) {
  if (!snapshot) return null
  if (snapshot.status === 'banned' || snapshot.status === 'suspended') return null

  const plan = String(snapshot.plan ?? 'trial').toLowerCase()
  const isPaidPlan = PAID_PLANS.has(plan)
  const restam = daysUntil(snapshot.accessExpiresAt, now)
  const acessoAtivo = restam !== null && restam > 0

  // 1) Cobrança primeiro: é o aviso que a pessoa mais precisa receber na hora.
  if (snapshot.accessExpiresAt && restam !== null) {
    if (isPaidPlan) {
      if (restam <= 0 && restam >= -2) return { slug: 'plano_venceu', vars: {} }
      const slug = COUNTDOWN_SLUGS.paid[restam]
      if (slug) {
        return {
          slug,
          vars: { data_vencimento: formatDateBR(snapshot.accessExpiresAt), dias_restantes: String(restam) },
        }
      }
      if (restam <= -6 && restam >= -9) return { slug: 'plano_vencido_volta', vars: {} }
    } else {
      if (restam <= 0 && restam >= -2) return { slug: 'teste_acabou', vars: {} }
      const slug = COUNTDOWN_SLUGS.trial[restam]
      if (slug) {
        return {
          slug,
          vars: { fim_do_teste: formatDateBR(snapshot.accessExpiresAt), dias_restantes: String(restam) },
        }
      }
    }
  }

  // 2) Pagamento começado e não concluído (só faz sentido enquanto não há acesso).
  const horasPendente = hoursSince(snapshot.pendingPaymentAt, now)
  if (!acessoAtivo && horasPendente !== null && horasPendente >= 2 && horasPendente <= 48) {
    return { slug: 'pagamento_pendente', vars: { plano: snapshot.pendingPaymentPlan || 'escolhido' } }
  }

  // 3) Saúde do robô — só para quem está pagando/testando de verdade.
  if (acessoAtivo) {
    const horasDesconectado = hoursSince(snapshot.waDisconnectedSince, now)
    if (snapshot.waEverConnected && !snapshot.waConnected && horasDesconectado !== null && horasDesconectado >= 24) {
      return { slug: 'whatsapp_desconectado', vars: {} }
    }

    const diasDeConta = daysSince(snapshot.createdAt, now)
    if (!snapshot.waEverConnected && diasDeConta !== null && diasDeConta >= 2) {
      return { slug: 'onboarding_conecte_whatsapp', vars: {} }
    }

    if (snapshot.waEverConnected && diasDeConta !== null && diasDeConta >= 1 && (!snapshot.hasMonitorGroup || !snapshot.hasPostGroup)) {
      const faltando = []
      if (!snapshot.hasMonitorGroup) faltando.push('os grupos de onde as ofertas vêm')
      if (!snapshot.hasPostGroup) faltando.push('os grupos para onde as ofertas vão')
      return { slug: 'configuracao_incompleta', vars: { o_que_falta: faltando.join(' e ') } }
    }

    const diasSemEnvio = daysSince(snapshot.lastSuccessAt, now)
    if (isPaidPlan && snapshot.waConnected && snapshot.hasMonitorGroup && snapshot.hasPostGroup
      && snapshot.lastSuccessAt && diasSemEnvio !== null && diasSemEnvio >= 2) {
      return { slug: 'robo_parado', vars: {} }
    }
  }

  // 4) Dinheiro parado na conta de afiliada.
  if (snapshot.isAffiliate && Number(snapshot.affiliateAvailableCents) > 0
    && Number(snapshot.affiliateAvailableCents) >= Number(snapshot.minPayoutCents ?? 0)) {
    return {
      slug: 'saque_disponivel',
      vars: {
        saldo: formatMoneyBR(snapshot.affiliateAvailableCents),
        minimo: formatMoneyBR(snapshot.minPayoutCents ?? 0),
      },
    }
  }

  // 5) Convite de afiliada por último: é o único de divulgação da lista.
  const diasDeConta = daysSince(snapshot.createdAt, now)
  if (!snapshot.isAffiliate && acessoAtivo && diasDeConta !== null && diasDeConta >= 14) {
    return { slug: 'seja_afiliado', vars: { percentual: `${snapshot.commissionPercent ?? 30}%` } }
  }

  return null
}
