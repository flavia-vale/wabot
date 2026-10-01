// Passada periódica que avisa quando as vagas de robô estão acabando (ver
// sessionCapacityAlertPolicy.js para o porquê e as travas).
//
// Onde roda: in-process na API (setInterval + unref no boot de server.js),
// MESMO padrão de startCredentialExpirySweep. **Sem processo PM2 novo, sem
// worker, sem dependência nova** — política de memória do AGENTS.md.
//
// O e-mail sai pelo caminho de AVISO INTERNO (`src/email/adminAlerts.js`), não
// pelo despachante da cliente: as travas do despachante (descadastro, conta
// parada, teto semanal, endereço fabricado) são regras de relacionamento com a
// CLIENTE e nenhuma pode calar um alerta de operação. De lá vêm também o
// endereço (`ADMIN_ALERT_EMAIL`), o cooldown por assunto e o histórico em
// `EmailSendLog`.
//
// Nunca lança para o chamador: o setInterval do boot não pode morrer por causa
// desta feature.

import { randomUUID } from 'crypto'
import { sendAdminAlert } from '../email/adminAlerts.js'
import {
  CAPACITY_ALERT_EVENT,
  CAPACITY_ALERT_SLUG,
  buildCapacityAlertVars,
  resolveAlertCooldownHours,
  resolveAlertFreeSlots,
  resolveSessionCapacityMax,
  isCapacityAlertEnabled,
  shouldAlertSessionCapacity,
} from './sessionCapacityAlertPolicy.js'

/** Contagem de robôs ligados, na MESMA fonte que o circuit breaker usa. */
export async function countRunningBots(listRunningBots) {
  try {
    const value = await listRunningBots()
    if (Array.isArray(value)) return value.length
    if (Number.isFinite(value)) return Number(value)
    if (Array.isArray(value?.bots)) return value.bots.length
    return null
  } catch {
    // Supervisor fora do ar / comando estourado: contagem indisponível, e a
    // política já trata isso como "não avisa".
    return null
  }
}

/**
 * Uma passada. Efeitos injetados para manter a decisão pura e testável.
 * @returns {Promise<{sent:number, reason:string, running:number|null, free:number|null}>}
 */
/**
 * Roteamento por nó: o aviso vale para o nó MAIS CHEIO entre os medidos. Nó
 * não medido (null) não conta como vaga nem como lotado; sem nenhum nó medido
 * devolve `running: null` (a política não avisa).
 * @returns {Promise<{running:number|null, nodeId:string|null, nodes:number}>}
 */
export async function countRunningBotsByNode(listRunningBotsByNode) {
  let counts = null
  try { counts = await listRunningBotsByNode() } catch { counts = null }
  const entries = Object.entries(counts ?? {})
  let worst = null
  for (const [nodeId, value] of entries) {
    if (value === null || value === undefined || value === '') continue
    const running = Number(value)
    if (!Number.isFinite(running) || running < 0) continue
    if (!worst || running > worst.running) worst = { nodeId, running }
  }
  return { running: worst?.running ?? null, nodeId: worst?.nodeId ?? null, nodes: entries.length }
}

export async function runSessionCapacityAlertSweep({
  db,
  listRunningBots,
  listRunningBotsByNode = null,
  sendAlert = sendAdminAlert,
  env = process.env,
  now = new Date(),
  logger = console,
} = {}) {
  if (!isCapacityAlertEnabled(env)) return { sent: 0, reason: 'desligado', running: null, free: null }

  const max = resolveSessionCapacityMax(env)
  const freeSlots = resolveAlertFreeSlots(env)
  // Com roteamento por nó o `max` já é por nó (MAX_SESSIONS_PER_PROCESS é por
  // processo): avalia o nó mais cheio, não a soma.
  const perNode = listRunningBotsByNode
    ? await countRunningBotsByNode(listRunningBotsByNode)
    : null
  const running = perNode ? perNode.running : await countRunningBots(listRunningBots)
  const nodeLabel = perNode && perNode.nodes > 1 && perNode.nodeId ? `servidor ${perNode.nodeId}` : null
  const decision = shouldAlertSessionCapacity({
    running,
    max,
    freeSlots,
  })
  if (!decision.alert) return { sent: 0, reason: decision.reason, running, free: decision.free }

  const result = await sendAlert({
    db,
    slug: CAPACITY_ALERT_SLUG,
    // Assunto do cooldown: o teto vigente. Subir o teto é uma situação nova e
    // pode avisar de novo sem esperar a janela do teto antigo.
    key: nodeLabel ? `max=${max};${nodeLabel}` : `max=${max}`,
    vars: buildCapacityAlertVars({ running, max, free: decision.free, nodeLabel }),
    cooldownHours: resolveAlertCooldownHours(env),
    now,
    env,
    logger,
  })
  if (!result?.sent) return { sent: 0, reason: result?.reason ?? 'nao_enviado', running, free: decision.free }

  // Sinal durável só de visibilidade (o histórico de envio já mora em
  // EmailSendLog). Best-effort: falhar aqui não desfaz o aviso.
  try {
    await db.analyticsEvent.create({
      data: {
        id: randomUUID(),
        event: CAPACITY_ALERT_EVENT,
        metadata: JSON.stringify({ running, max, free: decision.free }),
        createdAt: new Date(now),
      },
    })
  } catch (err) {
    logger?.warn?.({ err: err?.message }, 'aviso de vagas: falha ao registrar o sinal')
  }

  logger?.warn?.({ running, max, free: decision.free }, 'aviso de vagas de robô enviado')
  return { sent: 1, reason: decision.reason, running, free: decision.free }
}
