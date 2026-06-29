import dbDefault from '../db.js'
import { classifyError } from '../errorTaxonomy.js'

// Watchdog de MessageLog preso em 'sending'. Safety net para o caso (raro) de um
// envio travar entre o set 'sending' e o estado terminal (success/error) — por
// exemplo um socket Baileys silenciosamente morto que escapou do withSendTimeout,
// ou o processo morrendo no meio. Sem isso a linha fica 'sending' para sempre: o
// painel mostra "enviando…" eterno e o card de erros nunca contabiliza a falha.
//
// Estratégia: reclassificar como timeout de envio preso, NÃO como
// worker_restart. O sintoma aqui é "ficou tempo demais em sending"; pode ter
// sido socket morto, await travado ou processo morto, mas o watchdog não tem
// evidência de restart real. Antes isso inflava `error:worker_restart` e
// escondia que a causa operacional dominante era timeout/stuck-send.
//
// NÃO re-enfileirar — o payload original (buildPayload/recipe) não existe mais
// fora do processo que o criou, então um re-envio cego mandaria conteúdo
// incompleto. A fonte (fila/automação) tem seus próprios retries e reenfileira o
// item por conta própria.
//
// Mede tempo-EM-'sending': processSendJob estampa `sentAt` ao entrar em 'sending',
// então `sentAt < cutoff` com `status:'sending'` é um envio genuinamente travado
// (não uma linha só recém-criada nem um job adiado, que volta para 'queued').

export const STUCK_SEND_LOG_CUTOFF_MS = Math.max(60_000, Number(process.env.STUCK_SEND_LOG_CUTOFF_MS || 15 * 60_000))

export async function recoverStuckSendLogs(deps = {}) {
  const db = deps.db ?? dbDefault
  const now = deps.now ? deps.now() : new Date()
  const cutoffMs = deps.cutoffMs ?? STUCK_SEND_LOG_CUTOFF_MS
  const cutoff = new Date(now.getTime() - cutoffMs)
  const where = { status: 'sending', sentAt: { lt: cutoff } }
  if (deps.userId) where.userId = deps.userId
  const res = await db.messageLog.updateMany({
    where,
    data: {
      status: 'error',
      errorMsg: classifyError(null, { kind: 'send_stuck' }),
      sentAt: now,
    },
  })
  return { recovered: res.count ?? 0 }
}
