// Política de persistência do estado WhatsApp.
//
// Regra de segurança: um close transitório do socket Baileys NÃO pode marcar a
// sessão como `disconnected` no banco. Se o worker morrer logo depois, o
// auto-resume só retoma sessões `connected/connecting`; persistir
// `disconnected` transforma uma queda recuperável em sessão offline até ação
// manual. Só estados terminais explícitos devem derrubar o status durável.

export function buildCloseSessionPatch({
  code = null,
  terminal = false,
  ownerInstance = null,
  now = new Date(),
} = {}) {
  const lastDisconnectCode = code != null ? String(code) : null
  const base = {
    ownerInstance,
    lastHeartbeatAt: now,
    lastDisconnectCode,
  }

  if (terminal) {
    return {
      ...base,
      status: 'disconnected',
      lifecycle: 'disconnected',
    }
  }

  return {
    ...base,
    status: 'connecting',
    lifecycle: 'reconnecting',
  }
}

// Estado reportado pelo heartbeat periódico do worker (IPC + WaSession.status).
// Existe um intervalo real entre o close do socket (sem activeSock/pendingSock)
// e o próximo startBot() de fato criar um socket novo — de segundos a até
// 30min em cooldowns de flap/quedas estáveis/replaced. Sem considerar uma
// reconexão automática já agendada (`hasReconnectScheduled`), esse intervalo
// seria reportado como 'idle', sobrescrevendo o status 'connecting' que
// buildCloseSessionPatch setou de propósito — reintroduzindo o falso
// "desconectado" que a policy acima existe pra evitar.
//
// Válvula de segurança (a favor da outra direção): se a sessão ficar tempo
// DEMAIS sem voltar a `connected` — encadeando cooldowns de flap/replaced/
// stable-close, cada um reagendando o próximo antes do anterior expirar —
// `hasReconnectScheduled` ficaria sempre true e o cliente nunca veria
// "desconectado" mesmo estando preso num loop havia 20-30min. `disconnectedForMs`
// (tempo desde a última vez que a sessão esteve `connected`) e `maxReconnectingMs`
// (teto configurável, default abaixo) fazem o heartbeat "desistir" de esconder
// e reportar `idle` — não porque o worker parou de tentar (ele continua), mas
// porque o cliente merece saber que algo está errado em vez de confiar
// cegamente num "conectando" que nunca termina.
export const DEFAULT_MAX_RECONNECTING_MS = 2 * 60_000 // 2min — alta disponibilidade: não esconder reconexão presa por muito tempo

export function computeHeartbeatState({
  hasActiveSock,
  hasPendingSock,
  hasReconnectScheduled,
  disconnectedForMs = 0,
  maxReconnectingMs = DEFAULT_MAX_RECONNECTING_MS,
}) {
  if (hasActiveSock) return 'connected'
  if (disconnectedForMs >= maxReconnectingMs) return 'idle'
  if (hasPendingSock || hasReconnectScheduled) return 'connecting'
  return 'idle'
}

export function buildAuthResetSessionPatch({
  code = null,
  ownerInstance = null,
  now = new Date(),
} = {}) {
  return {
    ownerInstance,
    lastHeartbeatAt: now,
    lastDisconnectCode: code != null ? String(code) : null,
    status: 'disconnected',
    lifecycle: 'auth_reset_required',
  }
}
