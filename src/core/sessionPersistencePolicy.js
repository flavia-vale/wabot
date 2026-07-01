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
export function computeHeartbeatState({ hasActiveSock, hasPendingSock, hasReconnectScheduled }) {
  if (hasActiveSock) return 'connected'
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
