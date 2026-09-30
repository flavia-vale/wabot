// Fase 0 do "vários números por conta" (docs/rca/multi-numero.md):
// validar a procura ANTES de escrever a parte técnica. A cliente entra numa
// lista de espera com o preço já aprovado (R$29/mês por número extra, só no
// PRO); o diagnóstico `scripts/diag-multi-numero-demanda.mjs` lê essa lista.
//
// Guardado em `AnalyticsEvent` (sem migration): cada entrada é um evento, e a
// intenção vigente da conta é o evento MAIS RECENTE — sair da lista é um evento
// de saída, não um delete.
import { PLAN_IDS, normalizePlan, isTrialActive } from '../../billing/plans.js'

export const MULTI_NUMBER_WAITLIST_JOINED = 'multi_number_waitlist_joined'
export const MULTI_NUMBER_WAITLIST_LEFT = 'multi_number_waitlist_left'
export const MULTI_NUMBER_WAITLIST_EVENTS = Object.freeze([
  MULTI_NUMBER_WAITLIST_JOINED,
  MULTI_NUMBER_WAITLIST_LEFT,
])

// Preço aprovado pela dona do produto em 2026-09-30.
export const EXTRA_NUMBER_PRICE_CENTS = 2900
export const EXTRA_NUMBER_PRICE_LABEL = 'R$29'

// "4" significa "4 ou mais" — acima disso a conversa é o plano Escala.
export const EXTRA_NUMBER_OPTIONS = Object.freeze([1, 2, 3, 4])

export const WAITLIST_REASONS = Object.freeze({
  continuidade: 'Não parar se um número cair',
  rodizio: 'Dividir os envios entre números',
  mais_grupos: 'Enviar para mais grupos',
  varias_contas: 'Juntar as contas que já tenho',
})

export function validateWaitlistInput(body = {}) {
  const extraNumbers = Number(body?.extraNumbers)
  if (!EXTRA_NUMBER_OPTIONS.includes(extraNumbers)) {
    return { ok: false, error: 'Escolha quantos números a mais você quer (1 a 4 ou mais).' }
  }
  const reason = String(body?.reason ?? '')
  if (!Object.hasOwn(WAITLIST_REASONS, reason)) {
    return { ok: false, error: 'Escolha o principal motivo.' }
  }
  return { ok: true, value: { extraNumbers, reason } }
}

// O adicional é só do PRO; Trial ativo conta como PRO, como no resto do produto.
export function waitlistPlanStatus(user = {}, now = new Date()) {
  const plan = normalizePlan(user?.plan)
  const hasPro = [PLAN_IDS.PRO, PLAN_IDS.PREMIUM].includes(plan) || isTrialActive(user, now)
  return { plan, requiresUpgrade: !hasPro }
}

function parseMetadata(raw) {
  try {
    const parsed = JSON.parse(raw || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Recebe os eventos de UMA conta (qualquer ordem) e devolve a intenção vigente.
export function currentWaitlistEntry(events = []) {
  const latest = [...events]
    .filter((e) => MULTI_NUMBER_WAITLIST_EVENTS.includes(e?.event))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  if (!latest || latest.event !== MULTI_NUMBER_WAITLIST_JOINED) return { joined: false }
  const meta = parseMetadata(latest.metadata)
  return {
    joined: true,
    extraNumbers: Number(meta.extraNumbers) || null,
    reason: meta.reason ?? null,
    joinedAt: new Date(latest.createdAt).toISOString(),
  }
}

// Receita mensal potencial da lista (quem é PRO/Trial paga o adicional; quem
// é Basic precisaria subir de plano, então entra à parte).
export function summarizeWaitlist(entries = []) {
  const joined = entries.filter((e) => e?.joined)
  const byReason = {}
  const byExtraNumbers = {}
  let extraNumbersTotal = 0
  let needsUpgrade = 0
  for (const entry of joined) {
    byReason[entry.reason] = (byReason[entry.reason] || 0) + 1
    byExtraNumbers[entry.extraNumbers] = (byExtraNumbers[entry.extraNumbers] || 0) + 1
    extraNumbersTotal += entry.extraNumbers || 0
    if (entry.requiresUpgrade) needsUpgrade += 1
  }
  return {
    accounts: joined.length,
    needsUpgrade,
    extraNumbersTotal,
    potentialMonthlyCents: extraNumbersTotal * EXTRA_NUMBER_PRICE_CENTS,
    byReason,
    byExtraNumbers,
  }
}

// Critério de "seguir para a Fase 1" do plano: ≥5 contas PRO na lista OU ≥10%
// dos PROs ativos. O atalho dos 10% exige ao menos 3 contas, senão uma base
// pequena (1 de 2 PROs = 50%) decide sozinha.
export const GO_MIN_ACCOUNTS = 5
export const GO_MIN_PRO_SHARE = 0.1
export const GO_MIN_ACCOUNTS_FOR_SHARE = 3

export function phaseOneDecision({ proAccounts = 0, waitlistProAccounts = 0 } = {}) {
  const share = proAccounts > 0 ? waitlistProAccounts / proAccounts : 0
  const go = waitlistProAccounts >= GO_MIN_ACCOUNTS
    || (share >= GO_MIN_PRO_SHARE && waitlistProAccounts >= GO_MIN_ACCOUNTS_FOR_SHARE)
  return { go, share, waitlistProAccounts, proAccounts }
}
