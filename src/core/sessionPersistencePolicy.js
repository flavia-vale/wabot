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
