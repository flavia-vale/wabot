// Feature 017, Fatia 3 — leitor ÚNICO das atualizações do robô (long poll por
// getUpdates), dentro do processo `api`. O Telegram só aceita UM leitor por
// robô: dois processos lendo o mesmo robô recebem 409 e um deles para
// (research.md R0.1) — por isso `api` precisa continuar com `instances: 1`
// (plan.md, "Condição registrada"). Em 409 o laço espera e tenta de novo,
// sem derrubar nada.
//
// Cada atualização passa pelos tratadores registrados (Fatia 3: ligação de
// grupos; Fatia 5: leitura de origem). Tratador que falha não trava os
// outros nem as próximas atualizações.

import logger from '../../logger.js'

const CONFLICT_BACKOFF_MS = 60_000
const ERROR_BACKOFF_MS = 15_000

export const ALLOWED_UPDATES = Object.freeze(['message', 'channel_post', 'my_chat_member'])

export function startTelegramUpdatesLoop({ api, handlers = [], timeoutSec = 25, sleep = (ms) => new Promise((r) => setTimeout(r, ms).unref?.()) } = {}) {
  let stopped = false
  let offset
  let running = null

  async function processBatch() {
    const updates = await api.getUpdates({ offset, timeoutSec, allowedUpdates: ALLOWED_UPDATES })
    for (const update of updates ?? []) {
      offset = Number(update.update_id) + 1
      for (const handler of handlers) {
        try {
          await handler(update)
        } catch (err) {
          logger.warn({ err: err?.message, updateId: update.update_id }, 'telegram: tratador de atualização falhou; seguindo')
        }
      }
    }
  }

  async function loop() {
    while (!stopped) {
      try {
        await processBatch()
      } catch (err) {
        const conflict = Number(err?.errorCode) === 409
        logger.warn({ err: err?.message, conflict }, conflict
          ? 'telegram: outro processo está lendo o mesmo robô (409); aguardando'
          : 'telegram: falha ao ler atualizações; tentando de novo')
        await sleep(conflict ? CONFLICT_BACKOFF_MS : ERROR_BACKOFF_MS)
      }
    }
  }

  running = loop()
  return {
    stop() { stopped = true },
    get done() { return running },
  }
}
