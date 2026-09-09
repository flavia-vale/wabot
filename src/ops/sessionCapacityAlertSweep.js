// Passada periódica que avisa por e-mail quando as vagas de robô estão
// acabando (ver sessionCapacityAlertPolicy.js para o porquê e as travas).
//
// Onde roda: in-process na API (setInterval + unref no boot de server.js),
// MESMO padrão de startCredentialExpirySweep. **Sem processo PM2 novo, sem
// worker, sem dependência nova** — política de memória do AGENTS.md.
//
// Por que NÃO passa pelo despachante de e-mails: o despachante existe para
// e-mail de CLIENTE — ele barra por descadastro, conta banida, conta parada e
// teto diário de divulgação, e todas essas travas leem um registro de `User`.
// Este aviso não tem cliente: é operacional, vai para um endereço fixo da dona
// do produto e não pode ser engolido por um teto que protege reputação de
// domínio em disparo em massa (mesma razão de DAILY_CAP_EXEMPT_SLUGS). O
// anti-spam próprio é o cooldown persistido em AnalyticsEvent.
//
// Nunca lança para o chamador: o setInterval do boot não pode morrer por causa
// desta feature.

import { randomUUID } from 'crypto'
import { wrapEmail } from '../email/layout.js'
import {
  CAPACITY_ALERT_EVENT,
  resolveAlertCooldownMs,
  resolveAlertFreeSlots,
  resolveAlertRecipients,
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

/** Último aviso enviado, para o cooldown. Banco indisponível = sem cooldown. */
export async function lastAlertAt({ db, now = new Date(), cooldownMs }) {
  try {
    const since = new Date(new Date(now).getTime() - cooldownMs)
    const row = await db.analyticsEvent.findFirst({
      where: { event: CAPACITY_ALERT_EVENT, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    })
    return row ? new Date(row.createdAt) : null
  } catch {
    return null
  }
}

/**
 * Texto do aviso. Linguagem leiga: "vagas de robô", nunca "sessão por
 * processo", "circuit breaker", "shard" ou "worker".
 */
export function buildCapacityAlertEmail({ running, max, free }) {
  const subject = free === 0
    ? `Sem vaga: ${running} de ${max} robôs ligados`
    : `Faltam ${free} vaga${free === 1 ? '' : 's'} de robô (${running} de ${max})`

  const lines = [
    `<p>Agora há <strong>${running} robôs ligados</strong>, e o servidor comporta <strong>${max}</strong>.</p>`,
    free === 0
      ? '<p>Não há mais vaga. Cliente nova <strong>não consegue conectar</strong>, e quem desligou o próprio robô não consegue voltar.</p>'
      : `<p>Sobra${free === 1 ? '' : 'm'} <strong>${free} vaga${free === 1 ? '' : 's'}</strong>. Quando acabar, cliente nova não consegue conectar e quem desligou o próprio robô não consegue voltar.</p>`,
    '<p>O que dá para fazer: liberar memória (desligar o staging quando não estiver validando) ou aumentar o servidor. Cada robô ocupa cerca de 272 MB.</p>',
    '<p>Este aviso se repete no máximo uma vez a cada 12 horas.</p>',
  ]

  const html = wrapEmail({ title: subject, body: lines.join('\n'), category: 'transactional' })
  const text = [
    `${running} de ${max} robôs ligados.`,
    free === 0 ? 'Não há mais vaga: cliente nova não consegue conectar.' : `Sobram ${free} vagas.`,
    'Liberar memória (desligar staging) ou aumentar o servidor. Cada robô ocupa ~272 MB.',
  ].join('\n')

  return { subject, html, text }
}

/**
 * Uma passada. Efeitos injetados para manter a decisão pura e testável.
 * @returns {Promise<{sent:number, reason:string, running:number|null, free:number|null}>}
 */
export async function runSessionCapacityAlertSweep({
  db,
  listRunningBots,
  sendMail,
  env = process.env,
  now = new Date(),
  logger = console,
} = {}) {
  if (!isCapacityAlertEnabled(env)) return { sent: 0, reason: 'desligado', running: null, free: null }

  const recipients = resolveAlertRecipients(env)
  if (recipients.length === 0) return { sent: 0, reason: 'sem_destinatario', running: null, free: null }

  const max = resolveSessionCapacityMax(env)
  const cooldownMs = resolveAlertCooldownMs(env)
  const running = await countRunningBots(listRunningBots)
  const decision = shouldAlertSessionCapacity({
    running,
    max,
    freeSlots: resolveAlertFreeSlots(env),
    lastAlertAt: await lastAlertAt({ db, now, cooldownMs }),
    now,
    cooldownMs,
  })
  if (!decision.alert) return { sent: 0, reason: decision.reason, running, free: decision.free }

  const message = buildCapacityAlertEmail({ running, max, free: decision.free })
  const result = await sendMail({ to: recipients.join(', '), ...message })
  // Sem SMTP nada foi enviado — a janela anti-spam não pode queimar à toa
  // (mesma regra do aviso de código de acesso vencido).
  if (result?.skipped) return { sent: 0, reason: 'sem_smtp', running, free: decision.free }

  try {
    await db.analyticsEvent.create({
      data: {
        id: randomUUID(),
        event: CAPACITY_ALERT_EVENT,
        metadata: JSON.stringify({ running, max, free: decision.free, recipients: recipients.length }),
        createdAt: new Date(now),
      },
    })
  } catch (err) {
    logger?.warn?.({ err: err?.message }, 'aviso de vagas: falha ao registrar o envio')
  }

  logger?.warn?.({ running, max, free: decision.free }, 'aviso de vagas de robô enviado')
  return { sent: 1, reason: decision.reason, running, free: decision.free }
}
