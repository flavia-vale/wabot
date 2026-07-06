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

// Ação manual do painel (botão "Limpar ofertas da fila", aba Envios): destrava
// a fila reclassificando TODAS as mensagens em vôo (status 'queued' e 'sending')
// de um usuário para um estado terminal de skip benigno. Diferente do watchdog
// acima, é imediato (sem cutoff de tempo) e cobre 'queued' além de 'sending' —
// serve para o cliente "soltar" agarramentos visíveis no contador "em vôo".
//
// Não re-enfileira nem cancela envios em andamento no worker: o payload já não
// existe fora do processo que o criou. Apenas limpa o registro preso para que o
// painel pare de mostrar "na fila/enviando" eterno e novas ofertas fluam.
// Exige userId — nunca varre todos os usuários.
export async function clearUserQueuedSendLogs(deps = {}) {
  const db = deps.db ?? dbDefault
  const userId = deps.userId
  if (!userId) throw new Error('clearUserQueuedSendLogs: userId é obrigatório')
  const now = deps.now ? deps.now() : new Date()
  const res = await db.messageLog.updateMany({
    where: { userId, status: { in: ['queued', 'sending'] } },
    data: {
      status: 'skipped',
      errorMsg: classifyError(null, { kind: 'queue_cleared' }),
      sentAt: now,
    },
  })
  return { cleared: res.count ?? 0 }
}
