/**
 * State machine do fluxo "conectar WhatsApp por número de celular" (pairing
 * code). Isolado em módulo próprio pra que a lógica de coordenação fique
 * testável sem o peso do bot-worker.js.
 *
 * Contrato:
 *   - createPairingState() retorna um controlador com setActive/clear/...
 *     e booleans suprimeQr() / suprimeAutoRestart() que o connection.update
 *     do worker consulta.
 *   - O proprietário externo (worker) faz tear-down do socket, limpa
 *     AUTH_DIR, chama setActive(...), e dispara startBot() — o trigger
 *     interno em startBot chama onSocketReady(sock) que requisita o código.
 *   - clear() é chamado em sucesso (connection.open) OU em qualquer falha.
 *
 * Por que viver fora do worker: torna o comportamento testável (estado +
 * transições) sem ter que stub-ar Baileys inteiro, Prisma, BullMQ, etc.
 */

export const PAIRING_WINDOW_MS_DEFAULT = 90_000

export function createPairingState({ windowMs = PAIRING_WINDOW_MS_DEFAULT, now = () => Date.now() } = {}) {
  let state = { active: false, phone: null, requestId: null, startedAt: 0, code: null }
  let expiryTimer = null

  function snapshot() {
    return { ...state }
  }

  function isActive() {
    return state.active === true
  }

  function setActive({ phone, requestId, onExpire }) {
    if (!phone || !requestId) throw new Error('setActive: phone e requestId obrigatórios')
    if (expiryTimer) clearTimeout(expiryTimer)
    state = { active: true, phone, requestId, startedAt: now(), code: null }
    expiryTimer = setTimeout(() => {
      if (state.active && state.requestId === requestId && !state.code) {
        const expired = { ...state }
        state = { active: false, phone: null, requestId: null, startedAt: 0, code: null }
        try { onExpire?.(expired) } catch {}
      }
    }, windowMs)
    expiryTimer.unref?.()
  }

  function markCode(code) {
    if (!state.active) return false
    state.code = code
    return true
  }

  function clear() {
    state = { active: false, phone: null, requestId: null, startedAt: 0, code: null }
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null }
  }

  function ownsRequest(requestId) {
    return state.active && state.requestId === requestId
  }

  // Connection.update do worker consulta esses dois pra decidir:
  //   - Emitir QR IPC?  Não, se pairing ativo (usuário pediu código, não scan).
  //   - Auto-restart em close não-loggedOut?  Não, se pairing ativo
  //     (preserva o socket que segura o código que o usuário tá digitando).
  function suppressQrEmission() { return state.active }
  function suppressAutoRestart() { return state.active }

  return {
    snapshot,
    isActive,
    setActive,
    markCode,
    clear,
    ownsRequest,
    suppressQrEmission,
    suppressAutoRestart,
  }
}
