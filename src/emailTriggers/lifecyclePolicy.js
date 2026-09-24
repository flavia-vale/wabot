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

import { wasStoppedByUser } from '../email/accountActivity.js'
import { resolveExpiredPlanStep } from './expiredPlanJourney.js'
import { resolveExpiredTrialStep } from './expiredTrialJourney.js'
import { buildRecoveryVoucher } from '../domain/payments/recoveryVoucher.js'
import { buildTrialProofVars, shouldSendTrialProof } from './trialProof.js'

/**
 * Troca o passo `teste_acabou` (marcado `proofAware`) pelo irmão com prova
 * quando a conta já teve oferta publicada no teste. Não mexe em janela nem
 * nos outros passos da jornada — só qual e-mail sai NAQUELE dia.
 *
 * Sem oferta publicada (`buildTrialProofVars` devolve null), o passo original
 * segue valendo: mandar "veja o que o robô fez" para quem nunca viu nada
 * acontecer é a forma mais rápida de confirmar que o produto não funciona
 * (mesma regra de `shouldSendTrialProof`).
 */
function applyExpiredTrialProof(passo, snapshot) {
  if (!passo?.proofAware) return passo
  const prova = buildTrialProofVars({ offersPublished: snapshot.offersPublished, destGroupCount: snapshot.destGroupCount })
  if (!prova) return passo
  return { ...passo, slug: 'teste_acabou_com_prova', proofVars: prova }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000

// `premium` é plano pago: sem ele aqui a cliente do Instagram Stories caía
// na jornada de fim de TESTE GRÁTIS e na de plano vencido errada.
const PAID_PLANS = new Set(['basic', 'pro', 'premium'])

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

// Gatilho ancorado no CADASTRO ("faz 2 dias que você criou a conta e ainda não
// conectou") precisa de teto, senão vira retroativo: quem se cadastrou há oito
// meses também satisfaz "faz 2 dias ou mais" e recebe hoje um e-mail de
// boas-vindas atrasado. Aconteceu em produção (2026-08) quando o motor entrou
// no ar com a base já formada.
//
// Gatilho ancorado em FATO ATUAL (o plano vence em 3 dias, o robô caiu ontem,
// há saldo para sacar) não tem esse problema e continua valendo para todo
// mundo — não é retroativo, é o que está acontecendo agora.
const SIGNUP_WINDOW_DAYS = { onboarding: 30, configuracao: 30, afiliado: 90 }

/**
 * Data a partir da qual os gatilhos ancorados no cadastro passam a valer.
 * Sem a env, só as janelas acima protegem a base antiga.
 */
export function resolveTriggersStartAt(env = process.env) {
  const raw = String(env.EMAIL_TRIGGERS_START_AT ?? '').trim()
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
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
// Teto de quanto tempo ainda faz sentido avisar que o WhatsApp caiu. Sem ele,
// uma conta parada há meses receberia o mesmo aviso a cada 3 dias (a janela de
// repetição do template) para sempre — o oposto de ajudar. 30 dias cobre com
// folga quem esqueceu de re-parear e para de insistir com quem desistiu.
export const WHATSAPP_DESCONECTADO_MAX_HORAS = Math.max(
  48,
  Number(process.env.EMAIL_WHATSAPP_DESCONECTADO_MAX_HORAS || 30 * 24)
)

/**
 * Monta a decisão de uma etapa de jornada de acesso vencido (plano pago ou
 * teste grátis). A etapa marcada com `voucher` recebe junto o código, o
 * desconto e o prazo.
 *
 * O prazo é CALCULADO aqui, não escrito no texto: a janela de cada etapa tem
 * dois dias, então "faltam 3 dias" sairia errado no segundo deles.
 *
 * Sem voucher confiável (conta sem id, data de vencimento ilegível) devolve
 * null: melhor não mandar e-mail de desconto nenhum do que mandar um com código
 * ou prazo inventado. Quem chama trata isso como "esta etapa não tem e-mail
 * hoje" e segue para os gatilhos de menor prioridade.
 */
function buildJourneyDecision(passo, snapshot, now) {
  const vars = { data_vencimento: formatDateBR(snapshot.accessExpiresAt) }
  if (!passo.voucher) return { slug: passo.slug, vars }

  const voucher = buildRecoveryVoucher({
    userId: snapshot.id,
    expiredAt: snapshot.accessExpiresAt,
    now,
  })
  if (!voucher || voucher.diasRestantes <= 0) return null
  return {
    slug: passo.slug,
    vars: {
      ...vars,
      codigo_voucher: voucher.code,
      desconto_voucher: `${voucher.percent}%`,
      voucher_vale_ate: formatDateBR(voucher.validUntil),
      dias_do_voucher: String(voucher.diasRestantes),
    },
  }
}

export function decideLifecycleEmail(snapshot, now = new Date(), { triggersStartAt = null } = {}) {
  if (!snapshot) return null
  if (snapshot.status === 'banned' || snapshot.status === 'suspended') return null

  // Conta anterior à virada nunca dispara gatilho de "dias após o cadastro".
  const cadastroValeParaGatilho = !triggersStartAt || !snapshot.createdAt
    || new Date(snapshot.createdAt).getTime() >= new Date(triggersStartAt).getTime()
  const dentroDaJanelaDeCadastro = (dias, min, max) => (
    cadastroValeParaGatilho && dias !== null && dias >= min && dias <= max
  )

  const plan = String(snapshot.plan ?? 'trial').toLowerCase()
  const isPaidPlan = PAID_PLANS.has(plan)
  const restam = daysUntil(snapshot.accessExpiresAt, now)
  const acessoAtivo = restam !== null && restam > 0

  // 1) Cobrança primeiro: é o aviso que a pessoa mais precisa receber na hora.
  if (snapshot.accessExpiresAt && restam !== null) {
    if (isPaidPlan) {
      const slug = COUNTDOWN_SLUGS.paid[restam]
      if (slug) {
        return {
          slug,
          vars: { data_vencimento: formatDateBR(snapshot.accessExpiresAt), dias_restantes: String(restam) },
        }
      }
      // Já venceu: a jornada de recuperação decide o e-mail do dia (aviso no
      // vencimento, os dois voucher e os espaçados depois deles).
      if (restam <= 0) {
        const passo = resolveExpiredPlanStep(-restam)
        const decision = passo ? buildJourneyDecision(passo, snapshot, now) : null
        if (decision) return decision
      }
    } else {
      // Acabou: mesma ideia da jornada do plano pago, com textos de quem ainda
      // não assinou nenhuma vez. Antes daqui só existia o aviso do primeiro
      // dia, e depois dele a conta nunca mais recebia nada.
      if (restam <= 0) {
        const passoBase = resolveExpiredTrialStep(-restam)
        const passo = passoBase ? applyExpiredTrialProof(passoBase, snapshot) : null
        const decision = passo ? buildJourneyDecision(passo, snapshot, now) : null
        if (decision) {
          if (passo.proofVars) decision.vars = { ...decision.vars, ...passo.proofVars }
          return decision
        }
      }
      // D1/D2 do plano de ativação de 2026-09-08: a prova do que o robô já fez,
      // no 3º dia do teste. Fica ANTES da contagem regressiva na ordem porque
      // `restam === 4` não colide com nenhum dos avisos dela (3, 2 e 1) — e
      // depois dela, para não roubar o lugar de um aviso mais urgente.
      if (shouldSendTrialProof({ plan, daysLeft: restam, offersPublished: snapshot.offersPublished })) {
        const prova = buildTrialProofVars({
          offersPublished: snapshot.offersPublished,
          destGroupCount: snapshot.destGroupCount,
        })
        if (prova) {
          return { slug: 'teste_prova_de_valor', vars: { ...prova, fim_do_teste: formatDateBR(snapshot.accessExpiresAt) } }
        }
      }
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
    // Desconectar pelo painel é escolha (viagem, troca de chip, pausa), não
    // problema: avisar que "o robô está fora do ar" nesse caso é ruído.
    const horasDesconectado = hoursSince(snapshot.waDisconnectedSince, now)
    if (snapshot.waEverConnected && !snapshot.waConnected && !wasStoppedByUser(snapshot)
      && horasDesconectado !== null && horasDesconectado >= 24
      && horasDesconectado <= WHATSAPP_DESCONECTADO_MAX_HORAS) {
      return { slug: 'whatsapp_desconectado', vars: {} }
    }

    // Adiantado de D+2 para D+1 em 2026-09-23: medição do funil de ativação
    // (scripts/diag-funil-ativacao.mjs, 30 dias) achou 66 cadastros (32% do
    // total, maior grupo isolado) que nunca chegaram a pedir a conexão do
    // WhatsApp — e o e-mail é o ÚNICO canal para essa pessoa, já que ela ainda
    // não deu o número. Continua com folga de 1 dia inteiro do cadastro para
    // não soar como cobrança do minuto zero.
    const diasDeConta = daysSince(snapshot.createdAt, now)
    if (!snapshot.waEverConnected && dentroDaJanelaDeCadastro(diasDeConta, 1, SIGNUP_WINDOW_DAYS.onboarding)) {
      return { slug: 'onboarding_conecte_whatsapp', vars: {} }
    }

    // C5: sem NENHUMA loja o robô não publica nada — vem antes da configuração
    // de grupos porque é o bloqueio mais grave e o mais invisível: com grupos
    // escolhidos e sem etiqueta, o painel fica verde e nada chega ao grupo.
    // `hasAnyCredential === null` (não deu para saber) NÃO dispara: acusar
    // falta de cadastro por dúvida manda refazer o que já existe.
    if (snapshot.waEverConnected && snapshot.hasAnyCredential === false
      && dentroDaJanelaDeCadastro(diasDeConta, 1, SIGNUP_WINDOW_DAYS.configuracao)) {
      return { slug: 'sem_loja_cadastrada', vars: {} }
    }

    if (snapshot.waEverConnected && dentroDaJanelaDeCadastro(diasDeConta, 1, SIGNUP_WINDOW_DAYS.configuracao)
      && (!snapshot.hasMonitorGroup || !snapshot.hasPostGroup)) {
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
  // Convite de afiliada também é ancorado no cadastro: sem teto, a base antiga
  // inteira receberia de uma vez. Cliente de casa antiga é convidada pela aba
  // E-mails, no momento que a admin escolher.
  const diasDeConta = daysSince(snapshot.createdAt, now)
  if (!snapshot.isAffiliate && acessoAtivo && dentroDaJanelaDeCadastro(diasDeConta, 14, SIGNUP_WINDOW_DAYS.afiliado)) {
    return { slug: 'seja_afiliado', vars: { percentual: `${snapshot.commissionPercent ?? 30}%` } }
  }

  return null
}
