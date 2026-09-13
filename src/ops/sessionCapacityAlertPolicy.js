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

/** Evento durável, só para visibilidade em /metrics e AnalyticsEvent. */
export const CAPACITY_ALERT_EVENT = 'ops_session_capacity_warning'

/** Template do grupo `interno` que carrega o texto (editável pela aba E-mails). */
export const CAPACITY_ALERT_SLUG = 'admin_vagas_acabando'

/**
 * Mesma fórmula do supervisor — se divergir, o aviso mente sobre o teto.
 *
 * ⚠️ API e supervisor leem o MESMO `.env`, mas cada um só relê no próprio boot:
 * mudar o teto sem reiniciar as duas pontas faz o aviso e a recusa real
 * discordarem por um tempo.
 */
export function resolveSessionCapacityMax(env = process.env) {
  return Math.max(1, Number(env.MAX_SESSIONS_PER_PROCESS || 20))
}

/** Quantas vagas livres ainda disparam o aviso. Pedido da dona: 2. */
export function resolveAlertFreeSlots(env = process.env) {
  const raw = Number(env.CAPACITY_ALERT_FREE_SLOTS)
  if (!Number.isFinite(raw) || raw < 0) return 2
  return Math.floor(raw)
}

/** Janela anti-spam, em horas (o caminho de aviso interno conta assim). */
export function resolveAlertCooldownHours(env = process.env) {
  const raw = Number(env.CAPACITY_ALERT_COOLDOWN_HOURS)
  if (!Number.isFinite(raw) || raw < 0) return 12
  return raw
}

/** 'false' desliga a passada inteira, sem redeploy. */
export function isCapacityAlertEnabled(env = process.env) {
  return String(env.CAPACITY_ALERT_ENABLED ?? '').trim().toLowerCase() !== 'false'
}

/**
 * Decide se o aviso sai agora (a repetição é travada depois, pelo cooldown do
 * caminho de aviso interno).
 *
 * Fail-safe em todos os caminhos: contagem não confiável (supervisor fora do
 * ar, comando estourado, resposta estranha) NÃO avisa. Alarme falso recorrente
 * treina a pessoa a ignorar justamente este alerta — mesma lição do
 * staleWorkerCodeGuard.
 *
 * @param {{running:number|null, max:number, freeSlots:number}} input
 * @returns {{alert:boolean, reason:string, free:number|null}}
 */
export function shouldAlertSessionCapacity({ running, max, freeSlots } = {}) {
  if (!Number.isFinite(running) || running < 0) return { alert: false, reason: 'contagem_indisponivel', free: null }
  if (!Number.isFinite(max) || max < 1) return { alert: false, reason: 'teto_indisponivel', free: null }

  const free = Math.max(0, max - running)
  if (free > freeSlots) return { alert: false, reason: 'ainda_tem_vaga', free }
  return { alert: true, reason: free === 0 ? 'sem_vaga' : 'quase_sem_vaga', free }
}

/**
 * Texto do aviso. Linguagem leiga: "vagas de robô", nunca "sessão por
 * processo", "circuit breaker", "shard" ou "worker".
 */
export function buildCapacityAlertVars({ running, max, free }) {
  return {
    resumo: `${running} robôs ligados de ${max} que cabem`,
    situacao: free === 0
      ? 'Não há mais vaga: cliente nova não consegue conectar agora.'
      : `Sobra${free === 1 ? '' : 'm'} ${free} vaga${free === 1 ? '' : 's'}.`,
  }
}
