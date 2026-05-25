/**
 * Envolve uma promise (tipicamente `sock.sendMessage(...)` do Baileys) num
 * timeout duro. Sem isso, um socket silenciosamente morto trava o await
 * indefinidamente, e como a fila em memória do bot-worker processa
 * serialmente, todo job posterior fica preso em "queued" até reinício.
 *
 * Em timeout lança um Error com `code: 'SEND_MESSAGE_TIMEOUT'`, que reentra
 * no retry loop existente em processSendJob; após SEND_MAX_ATTEMPTS o job é
 * marcado 'error' e a fila avança.
 */
export function withSendTimeout(promise, { timeoutMs, destJid, route }) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`sendMessage timeout após ${timeoutMs}ms (destJid=${destJid}, route=${route})`)
      err.code = 'SEND_MESSAGE_TIMEOUT'
      reject(err)
    }, timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
