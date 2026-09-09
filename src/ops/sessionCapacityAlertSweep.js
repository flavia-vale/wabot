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
export async function runSessionCapacityAlertSweep({
  db,
  listRunningBots,
  sendAlert = sendAdminAlert,
  env = process.env,
  now = new Date(),
  logger = console,
} = {}) {
  if (!isCapacityAlertEnabled(env)) return { sent: 0, reason: 'desligado', running: null, free: null }

  const max = resolveSessionCapacityMax(env)
  const running = await countRunningBots(listRunningBots)
  const decision = shouldAlertSessionCapacity({
    running,
    max,
    freeSlots: resolveAlertFreeSlots(env),
  })
  if (!decision.alert) return { sent: 0, reason: decision.reason, running, free: decision.free }

  const result = await sendAlert({
    db,
    slug: CAPACITY_ALERT_SLUG,
    // Assunto do cooldown: o teto vigente. Subir o teto é uma situação nova e
    // pode avisar de novo sem esperar a janela do teto antigo.
    key: `max=${max}`,
    vars: buildCapacityAlertVars({ running, max, free: decision.free }),
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
