/**
 * "A máquina de cobrança está de pé?" — regras PURAS, sem banco e sem rede.
 *
 * Existe porque TODO elo dessa corrente quebra em silêncio: o aviso do Mercado
 * Pago que deixa de chegar, a chave que expira, a rede de segurança que não
 * está rodando, a cobrança que passa a ser recusada. Nenhum deles derruba nada
 * — o sistema segue verde e o dinheiro para de entrar.
 *
 * Duas invariantes que valem para tudo aqui:
 *
 *  1. **Sem medição confiável NÃO se alarma.** Alarme falso recorrente treina a
 *     pessoa a ignorar justamente este alerta (mesma lição do
 *     `staleWorkerCodeGuard`).
 *  2. **Nada aqui cobra, cancela ou muda acesso.** Só descreve o estado e diz o
 *     que fazer — a ação é humana.
 */

/** Gravidade, na ordem em que a pessoa deve olhar. */
export const BILLING_SEVERITY = Object.freeze({
  CRITICO: 'critico',
  ATENCAO: 'atencao',
  OK: 'ok',
  SEM_MEDICAO: 'sem_medicao',
})

const SEVERITY_ORDER = ['ok', 'sem_medicao', 'atencao', 'critico']

function pickWorst(a, b) {
  return SEVERITY_ORDER.indexOf(b) > SEVERITY_ORDER.indexOf(a) ? b : a
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function hoursBetween(from, to) {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return null
  return (b.getTime() - a.getTime()) / 3600000
}

function flag(value) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

/**
 * Configuração da cobrança lida do `.env`. NÃO devolve segredo nenhum — só o
 * que está certo e o que está faltando.
 *
 * `isProduction` decide o rigor: em staging, chave de teste e webhook sem
 * assinatura são o estado CORRETO, e acusar isso ali seria alarme falso todo
 * dia.
 */
export function checkBillingConfig({ env = process.env, isProduction = false, isSandboxToken = false } = {}) {
  const problems = []
  const token = String(env.MP_ACCESS_TOKEN ?? '').trim()

  if (!token) {
    problems.push({
      code: 'sem_chave',
      severity: BILLING_SEVERITY.CRITICO,
      title: 'A chave do Mercado Pago não está configurada',
      detail: 'Nenhuma cobrança pode ser criada nem confirmada assim.',
      fix: 'Preencher MP_ACCESS_TOKEN no .env e aplicar com pm2 delete + start.',
    })
  } else if (isProduction && isSandboxToken) {
    problems.push({
      code: 'chave_de_teste',
      severity: BILLING_SEVERITY.CRITICO,
      title: 'A chave em uso é de TESTE',
      detail: 'Nenhum cartão de verdade é aceito — a cliente vê "pagamento recusado" e o problema não é o cartão dela.',
      fix: 'Trocar por uma chave de produção (APP_USR-...) e aplicar com pm2 delete + start.',
    })
  }

  if (isProduction && !String(env.MP_WEBHOOK_SECRET ?? '').trim()) {
    problems.push({
      code: 'sem_assinatura_webhook',
      severity: BILLING_SEVERITY.CRITICO,
      title: 'Os avisos do Mercado Pago não estão sendo aceitos',
      detail: 'Sem a chave de assinatura, todo aviso de pagamento é recusado com erro.',
      fix: 'Preencher MP_WEBHOOK_SECRET no .env e aplicar com pm2 delete + start.',
    })
  }

  // Sem processar aviso, a confirmação de pagamento fica esperando a passada
  // horária: a cliente paga e o acesso demora a valer.
  if (!flag(env.BILLING_WEBHOOK_AUTOPROCESS ?? 'false')) {
    problems.push({
      code: 'aviso_nao_processado_na_hora',
      severity: BILLING_SEVERITY.ATENCAO,
      title: 'Os avisos de pagamento só são processados de hora em hora',
      detail: 'Quem paga agora pode esperar até uma hora para o acesso valer.',
      fix: 'Ligar BILLING_WEBHOOK_AUTOPROCESS=true no .env e aplicar com pm2 delete + start.',
    })
  }

  // Esta é a rede de segurança: sem ela, um aviso perdido vira cliente que
  // pagou e ficou sem robô, e ninguém fica sabendo.
  if (!flag(env.PAYMENT_RECONCILIATION_ENABLED ?? 'true')) {
    problems.push({
      code: 'sem_rede_de_seguranca',
      severity: BILLING_SEVERITY.CRITICO,
      title: 'A rede de segurança da cobrança está DESLIGADA',
      detail: 'Se um aviso do Mercado Pago se perder, ninguém conserta: a cliente paga e fica sem robô.',
      fix: 'Remover PAYMENT_RECONCILIATION_ENABLED=false do .env e aplicar com pm2 delete + start.',
    })
  }

  const severity = problems.reduce((worst, item) => pickWorst(worst, item.severity), BILLING_SEVERITY.OK)
  return { ok: problems.length === 0, severity, problems }
}

/** Janelas em que o silêncio deixa de ser normal e passa a ser sintoma. */
export const BILLING_SILENCE_WARN_HOURS = 48
export const BILLING_SILENCE_CRITICAL_HOURS = 24 * 7
export const BILLING_RECONCILIATION_STALE_HOURS = 3

/**
 * Estado da máquina de cobrança a partir do que foi medido.
 *
 * `null` em qualquer entrada significa "não medido" — e não medido NUNCA vira
 * alarme: vira `sem_medicao`, que a tela mostra como cinza.
 *
 * @returns {{ severity: string, problems: Array, checkedAt: Date }}
 */
export function assessBillingMachine({
  config = { ok: true, problems: [] },
  activeSubscriptions = null,
  lastChargeAt = null,
  lastApprovedChargeAt = null,
  lastReconciliationAt = null,
  recentRejected = null,
  recentApproved = null,
  now = new Date(),
} = {}) {
  const problems = [...(config.problems ?? [])]
  const nowDate = toDate(now) ?? new Date()

  // A rede de segurança tem que ter rodado há pouco. Se ela parou, o resto
  // deste diagnóstico também está velho — por isso vem antes.
  const sinceReconciliation = hoursBetween(lastReconciliationAt, nowDate)
  if (lastReconciliationAt && sinceReconciliation > BILLING_RECONCILIATION_STALE_HOURS) {
    problems.push({
      code: 'rede_de_seguranca_parada',
      severity: BILLING_SEVERITY.CRITICO,
      title: 'A conferência com o Mercado Pago parou de rodar',
      detail: `A última passada foi há ${Math.round(sinceReconciliation)} horas — ela deveria rodar a cada hora.`,
      fix: 'Conferir se a API está de pé e se a rede de segurança está ligada no .env.',
    })
  }

  // Assinatura ativa sem NENHUMA cobrança há muito tempo é o sintoma clássico
  // de aviso que deixou de chegar. Só vale quando há assinatura para cobrar.
  const temAssinatura = Number.isFinite(Number(activeSubscriptions)) && Number(activeSubscriptions) > 0
  const sinceCharge = hoursBetween(lastChargeAt, nowDate)
  if (temAssinatura && lastChargeAt === null) {
    problems.push({
      code: 'nenhuma_cobranca_registrada',
      severity: BILLING_SEVERITY.ATENCAO,
      title: 'Existe assinatura ativa e nenhuma cobrança registrada',
      detail: 'Ou nenhuma assinatura chegou a cobrar ainda, ou os avisos do Mercado Pago não estão chegando.',
      fix: 'Conferir no painel do Mercado Pago se os eventos de assinatura e de pagamento estão marcados.',
    })
  } else if (temAssinatura && sinceCharge !== null && sinceCharge > BILLING_SILENCE_WARN_HOURS) {
    const critico = sinceCharge > BILLING_SILENCE_CRITICAL_HOURS
    problems.push({
      code: 'silencio_de_cobranca',
      severity: critico ? BILLING_SEVERITY.CRITICO : BILLING_SEVERITY.ATENCAO,
      title: 'Faz tempo que nenhuma cobrança de assinatura acontece',
      detail: `A última foi há ${Math.round(sinceCharge / 24)} dia(s), com ${activeSubscriptions} assinatura(s) ativa(s).`,
      fix: 'Conferir os avisos no painel do Mercado Pago e rodar o diagnóstico de recorrência em uma conta.',
    })
  }

  // Recusa em série é dinheiro parando de entrar — e a causa costuma ser
  // nossa (chave errada, tentativa repetida), não o cartão de cada cliente.
  const recusadas = Number(recentRejected)
  const aprovadas = Number(recentApproved)
  if (Number.isFinite(recusadas) && Number.isFinite(aprovadas) && recusadas + aprovadas >= 5) {
    const taxaRecusa = recusadas / (recusadas + aprovadas)
    if (taxaRecusa >= 0.5) {
      problems.push({
        code: 'recusa_em_serie',
        severity: BILLING_SEVERITY.CRITICO,
        title: 'A maioria das cobranças está sendo recusada',
        detail: `${recusadas} recusadas contra ${aprovadas} aprovadas — quando é assim, a causa costuma ser nossa, não o cartão de cada cliente.`,
        fix: 'Abrir Financeiro → Cobranças recorrentes e olhar o motivo que mais aparece.',
      })
    }
  }

  const severity = problems.length
    ? problems.reduce((worst, item) => pickWorst(worst, item.severity), BILLING_SEVERITY.OK)
    : (lastReconciliationAt === null ? BILLING_SEVERITY.SEM_MEDICAO : BILLING_SEVERITY.OK)

  return { severity, problems, checkedAt: nowDate }
}

/**
 * Uma frase para o topo da tela. Curta de propósito: quem abre o Financeiro
 * precisa saber em um segundo se pode seguir a vida.
 */
export function describeBillingMachine(assessment) {
  switch (assessment?.severity) {
    case BILLING_SEVERITY.CRITICO: return 'A cobrança tem problema agora — veja abaixo o que fazer.'
    case BILLING_SEVERITY.ATENCAO: return 'A cobrança está funcionando, mas tem ponto para arrumar.'
    case BILLING_SEVERITY.SEM_MEDICAO: return 'Ainda sem medição suficiente para dizer se está tudo certo.'
    default: return 'A cobrança está funcionando.'
  }
}
