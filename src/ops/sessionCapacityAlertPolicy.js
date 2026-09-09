// Decisão pura do aviso "está acabando vaga de robô".
//
// Por que existe: `MAX_SESSIONS_PER_PROCESS` (src/supervisor/index.js) é o teto
// comercial da operação — cheio, NENHUMA cliente nova consegue conectar e quem
// desligou o próprio robô não volta (RCA 2026-09-01: 183 recusas acumularam sem
// ninguém perceber). O sinal `ops_session_capacity_limit` só nasce DEPOIS da
// primeira recusa, ou seja, quando o prejuízo já aconteceu. Este aviso é o
// contrário: chega ANTES, enquanto ainda dá tempo de subir RAM/teto.
//
// Módulo puro (sem banco, sem rede, sem Date.now implícito) — testável db-free,
// mesmo padrão de ops/modeRegressionGuard.js e ops/staleWorkerCodeGuard.js.

/** Endereço que recebe o aviso quando nada é configurado no `.env`. */
export const DEFAULT_CAPACITY_ALERT_EMAIL = 'flaviaroberta.1496@gmail.com'

/** Evento durável que persiste o anti-spam (sem tabela/migration nova). */
export const CAPACITY_ALERT_EVENT = 'ops_session_capacity_warning'

/** Mesma fórmula do supervisor — se divergir, o aviso mente sobre o teto. */
export function resolveSessionCapacityMax(env = process.env) {
  return Math.max(1, Number(env.MAX_SESSIONS_PER_PROCESS || 20))
}

/** Quantas vagas livres ainda disparam o aviso. Pedido da dona: 2. */
export function resolveAlertFreeSlots(env = process.env) {
  const raw = Number(env.CAPACITY_ALERT_FREE_SLOTS)
  if (!Number.isFinite(raw) || raw < 0) return 2
  return Math.floor(raw)
}

/** Janela anti-spam: no máximo um aviso por período (default 12h). */
export function resolveAlertCooldownMs(env = process.env) {
  const raw = Number(env.CAPACITY_ALERT_COOLDOWN_MS)
  if (!Number.isFinite(raw) || raw <= 0) return 12 * 60 * 60 * 1000
  return raw
}

/** Destinatários (lista separada por vírgula). Vazio explícito = desligado. */
export function resolveAlertRecipients(env = process.env) {
  const raw = env.CAPACITY_ALERT_EMAIL
  const value = raw === undefined ? DEFAULT_CAPACITY_ALERT_EMAIL : String(raw)
  return value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.includes('@'))
}

/** 'false' desliga a passada inteira, sem redeploy. */
export function isCapacityAlertEnabled(env = process.env) {
  return String(env.CAPACITY_ALERT_ENABLED ?? '').trim().toLowerCase() !== 'false'
}

/**
 * Decide se o aviso sai agora.
 *
 * Fail-safe em todos os caminhos: contagem não confiável (supervisor fora do
 * ar, comando estourado, resposta estranha) NÃO avisa. Alarme falso recorrente
 * treina a pessoa a ignorar justamente este alerta — mesma lição do
 * staleWorkerCodeGuard.
 *
 * @param {{running:number|null, max:number, freeSlots:number, lastAlertAt?:Date|number|null, now?:Date|number, cooldownMs:number}} input
 * @returns {{alert:boolean, reason:string, free:number|null}}
 */
export function shouldAlertSessionCapacity({
  running,
  max,
  freeSlots,
  lastAlertAt = null,
  now = new Date(),
  cooldownMs,
} = {}) {
  if (!Number.isFinite(running) || running < 0) return { alert: false, reason: 'contagem_indisponivel', free: null }
  if (!Number.isFinite(max) || max < 1) return { alert: false, reason: 'teto_indisponivel', free: null }

  const free = Math.max(0, max - running)
  if (free > freeSlots) return { alert: false, reason: 'ainda_tem_vaga', free }

  const lastMs = lastAlertAt ? new Date(lastAlertAt).getTime() : null
  if (Number.isFinite(lastMs)) {
    const elapsed = new Date(now).getTime() - lastMs
    if (elapsed < cooldownMs) return { alert: false, reason: 'avisado_recentemente', free }
  }
  return { alert: true, reason: free === 0 ? 'sem_vaga' : 'quase_sem_vaga', free }
}
