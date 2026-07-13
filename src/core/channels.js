import { detectKind, JID_KIND } from './jid.js'

const FOLLOW_JITTER_MIN_MS = 30_000
const FOLLOW_JITTER_MAX_MS = 60_000

function defaultJitterMs() {
  return FOLLOW_JITTER_MIN_MS + Math.random() * (FOLLOW_JITTER_MAX_MS - FOLLOW_JITTER_MIN_MS)
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Garante follow + subscribe-updates de cada canal-monitor de forma idempotente.
// followedSet (Set<string>) acumula JIDs já processados nesta vida do processo,
// evitando re-trabalho em reloads de config. Falha de um canal não interrompe os outros.
//
// inFlight (Set<string>, opcional): JIDs sendo processados por outra invocação
// concorrente. Permite que connection.open + reloadConfig disparem em paralelo
// sem causar double-follow no mesmo JID. Se não fornecido, sem proteção contra
// race (compatível com testes legados).
//
// delayBetweenMs: se null/undefined, usa jitter aleatório 30–60s.
//                 Em testes, injete 0 para velocidade.
// waitFn: injetável só em teste, pra assertar o delay sem depender de
//         tempo real de parede (setTimeout real é flaky por natureza —
//         resolução de timer do SO pode disparar ~1ms antes do previsto).
export async function subscribeToMonitorChannels({
  sock,
  channelMonitors,
  followedSet,
  inFlight,
  logger,
  delayBetweenMs = null,
  jitterFn = defaultJitterMs,
  waitFn = wait,
}) {
  const log = logger ?? console
  if (!sock || !Array.isArray(channelMonitors) || !followedSet) {
    return { followed: 0, skipped: 0, failed: 0, attempted: 0 }
  }

  const candidates = channelMonitors.filter(m => detectKind(m?.waJid) === JID_KIND.CHANNEL)
  const pending = candidates.filter(m => !followedSet.has(m.waJid) && !inFlight?.has(m.waJid))

  // Reserva os JIDs no inFlight antes de iniciar para que invocações
  // concorrentes vejam a reserva. TOCTOU resolvido porque a filtragem +
  // reserva acontecem sincronamente, antes de qualquer await.
  if (inFlight) {
    for (const m of pending) inFlight.add(m.waJid)
  }

  let followed = 0
  let failed = 0

  try {
    for (let i = 0; i < pending.length; i++) {
      const { waJid } = pending[i]
      try {
        await sock.newsletterFollow(waJid)
        try {
          const sub = await sock.subscribeNewsletterUpdates(waJid)
          // TODO(fase-5): persistir sub.duration para reagendar subscribe antes de expirar.
          log.info?.({ waJid, duration: sub?.duration }, 'canal: follow + subscribe ok')
        } catch (err) {
          log.warn?.({ waJid, err: err?.message }, 'canal: subscribe falhou; follow ok')
        }
        followedSet.add(waJid)
        followed++
      } catch (err) {
        log.error?.({ waJid, err: err?.message }, 'canal: follow falhou')
        failed++
      }

      if (i < pending.length - 1) {
        const ms = delayBetweenMs == null ? jitterFn() : delayBetweenMs
        if (ms > 0) await waitFn(ms)
      }
    }
  } finally {
    if (inFlight) {
      for (const m of pending) inFlight.delete(m.waJid)
    }
  }

  return {
    followed,
    failed,
    attempted: pending.length,
    skipped: candidates.length - pending.length,
  }
}
