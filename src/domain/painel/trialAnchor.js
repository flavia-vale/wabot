// Contar o teste a partir da PRIMEIRA CONEXÃO, não do cadastro.
//
// Item A1 do plano de ativação de 2026-09-08, e a mudança mais estrutural dele.
//
// O problema medido: o teste dura 7 dias contados do cadastro
// (`STANDARD_TRIAL_DAYS`, src/api/routes/auth.js) e a mediana entre cadastro e
// primeiro pagamento é 6,2 a 7 dias — ou seja, a decisão de pagar acontece
// exatamente quando o teste morre. Só que 46 das 114 pessoas que não pagaram
// nos 60 dias medidos nunca chegaram sequer a pedir a conexão. Quem leva quatro
// dias para conectar não testa 7 dias: testa 3. Estamos cobrando pelo tempo
// corrido, não pelo produto usado.
//
// Módulo PURO (padrão da casa): recebe a foto da conta e devolve a decisão.
// Nada aqui importa `db.js`, então o teste roda sem banco.
//
// TRÊS INVARIANTES QUE NÃO PODEM AFROUXAR:
//
// 1. **Só ESTENDE, nunca encurta.** Mesma regra da reconciliação de assinatura
//    (`decideAccessExtensionFromSubscription`): encurtar acesso por causa de uma
//    regra nova é tirar da cliente algo que ela já tinha.
// 2. **Só na PRIMEIRA conexão da conta.** Sem isso, reconectar viraria um jeito
//    de renovar o teste para sempre — e a base inteira ganharia dias grátis no
//    primeiro deploy.
// 3. **Só para conta nova.** Conta criada há mais de `maxSignupAgeDays` não é
//    ancorada: quem se cadastrou há meses e resolve conectar hoje não tem teste
//    novo a receber. É a mesma lição do RCA "gatilho ancorado no cadastro não
//    pode ser retroativo" (AGENTS.md) — regra nova encontrando base formada.
//
// Fail-safe em todo caminho: dado faltando, plano diferente, data inválida →
// **não mexe em nada**. Estender acesso por engano é dar produto de graça; não
// estender só mantém o comportamento histórico.

const DAY_MS = 24 * 60 * 60 * 1000

/** Janela máxima, em dias desde o cadastro, para ancorar o teste. */
export const TRIAL_ANCHOR_MAX_SIGNUP_AGE_DAYS = Number(
  process.env.TRIAL_ANCHOR_MAX_SIGNUP_AGE_DAYS || 21,
)

/**
 * Interruptor de rollout, no mesmo padrão de `COUPON_LINK_CONVERT` e
 * `WA_CHAT_SCOPE_MODE`: **desligado por padrão**.
 *
 * Isto mexe em acesso pago — dá dias de produto de graça —, então não entra em
 * produção sem validação explícita em staging e OK da dona do produto. Ligar e
 * desligar é uma linha no `.env`, sem redeploy (lembrando da pegadinha #1:
 * `pm2 delete` + `start`, não `restart --update-env`).
 */
export function trialAnchorEnabled() {
  return String(process.env.TRIAL_ANCHOR_ON_CONNECT ?? '') === 'true'
}

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * @param {object} args
 * @param {string} args.plan  plano atual da conta
 * @param {Date|string} args.createdAt  quando a conta foi criada
 * @param {Date|string|null} args.accessExpiresAt  fim do acesso hoje
 * @param {boolean} args.alreadyAnchored  já ancoramos esta conta antes?
 * @param {number} args.trialDays  duração do teste
 * @param {Date} [args.now]
 * @param {number} [args.maxSignupAgeDays]
 * @returns {{ anchor: boolean, until: Date|null, reason: string }}
 */
export function decideTrialAnchor({
  plan,
  createdAt,
  accessExpiresAt,
  alreadyAnchored = false,
  trialDays,
  now = new Date(),
  maxSignupAgeDays = TRIAL_ANCHOR_MAX_SIGNUP_AGE_DAYS,
} = {}) {
  const nao = (reason) => ({ anchor: false, until: null, reason })

  if (!trialAnchorEnabled()) return nao('desligado')
  if (alreadyAnchored) return nao('ja_ancorado')
  // Conta paga não tem teste a ancorar — e mexer no acesso dela seria grave.
  if (plan !== 'trial') return nao('nao_e_teste')

  const criada = toDate(createdAt)
  if (!criada) return nao('sem_data_de_cadastro')

  const dias = Number(trialDays)
  if (!Number.isFinite(dias) || dias <= 0) return nao('duracao_invalida')

  const idadeDias = (now.getTime() - criada.getTime()) / DAY_MS
  if (!Number.isFinite(idadeDias) || idadeDias > maxSignupAgeDays) return nao('conta_antiga')

  const until = new Date(now.getTime() + dias * DAY_MS)
  const atual = toDate(accessExpiresAt)
  // Já vale até depois disso: não há o que estender, e encurtar está proibido.
  if (atual && atual.getTime() >= until.getTime()) return nao('ja_vale_mais')

  return { anchor: true, until, reason: 'primeira_conexao' }
}
