// Feature 017 (arquitetura multicanal de entrega), D-A2/R1 do plano:
// sendPreparedPayload é o ÚNICO ponto que fala com o socket Baileys — o
// caminho mais crítico do produto, com dezenas de contas em produção. Este
// arquivo é a MESMA função de src/bot-worker.js, movida com o corpo
// INALTERADO (byte a byte). Nenhuma linha de lógica foi reescrita nesta
// extração — só os imports mudaram de lugar, porque o arquivo é outro.
//
// Guarda: test/delivery-whatsapp-send-inalterado.test.js falha se a forma
// mudar (as quatro rotas de envio, o messageId estável, o strip de campos de
// canal, e o timeout por tentativa).
//
// O que NÃO entra aqui e continua exatamente onde está em bot-worker.js:
// injeção do botão "Ver canal", waitDestinationRateLimit, atraso de
// digitação, lastSendByDest, atualização do MessageLog, preservação e smart
// delay. O adaptador é a PONTA, não o pipeline (contracts/delivery-network-adapter.md).

import { withSendTimeout as withSendTimeoutImpl } from '../../sendMessageTimeout.js'
import { buildStableSendMessageId } from '../../core/stableMessageId.js'
import { resolveSendTimeoutOverrideMs, resolveSendTimeoutMs as resolveSendTimeoutMsPure, DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS } from '../../core/sendTimeout.js'
import { detectKind } from '../../core/jid.js'
import { stripChannelUnsafeFields, isChannelDestination } from '../../core/channelSend.js'
import logger from '../../logger.js'

// Override uniforme opcional; vazio/0 => null para cair no array por-tentativa.
// (Lógica pura em core/sendTimeout.js — corrige o bug em que a expressão antiga
// `Math.max(5000, envNumber(...,0)) || null` devolvia 5000 SEMPRE, travando
// todo envio em 5s e deixando o array [90,60,45]s morto.)
const SEND_MESSAGE_TIMEOUT_MS = resolveSendTimeoutOverrideMs(process.env.SEND_MESSAGE_TIMEOUT_MS)
const SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS = DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS
function resolveSendTimeoutMs(attempt) {
  return resolveSendTimeoutMsPure(attempt, { overrideMs: SEND_MESSAGE_TIMEOUT_MS, byAttempt: SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS })
}

function withSendTimeout(promise, ctx) {
  const timeoutMs = resolveSendTimeoutMs(ctx?.attempt)
  return withSendTimeoutImpl(promise, { ...ctx, timeoutMs })
}

export async function sendPreparedPayload({ sock, job, payload, attempt = 1 }) {
  // messageId ESTÁVEL por job (derivado do logId), reutilizado em TODAS as rotas
  // e tentativas: o WhatsApp deduplica no servidor pela key.id, então um
  // timeout/Connection Closed que já entregou não vira duplicata quando o
  // retry/fallback reenvia. null => Baileys gera o id normalmente (comportamento
  // histórico) quando não há logId.
  const stableMessageId = buildStableSendMessageId(job.logId)
  const sendOptionsWith = (opts) => {
    if (!stableMessageId) return opts || undefined
    return { ...(opts || {}), messageId: stableMessageId }
  }

  if (payload && payload._route === 'relay' && payload.relay?.type && payload.relay?.proto) {
    await withSendTimeout(
      sock.relayMessage(job.destJid, { [payload.relay.type]: payload.relay.proto }, stableMessageId ? { messageId: stableMessageId } : {}),
      { destJid: job.destJid, route: 'relay', attempt },
    )
    return
  }

  if (payload && payload.primary) {
    const channelDest = isChannelDestination(job.destJid)
    if (detectKind(job.destJid) === null) {
      logger.warn({ destJid: job.destJid }, 'JID kind inesperado chegou ao send path; usando sendMessage como fallback')
    }
    const routes = [
      {
        body: channelDest ? stripChannelUnsafeFields(payload.primary) : payload.primary,
        sendOptions: payload.primarySendOptions,
      },
      ...(payload.fallbacks || []).map((body, idx) => ({
        body: channelDest ? stripChannelUnsafeFields(body) : body,
        sendOptions: payload.fallbackSendOptions?.[idx],
      })),
    ]
    let lastErr = null
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]
      try {
        await withSendTimeout(
          sock.sendMessage(job.destJid, route.body, sendOptionsWith(route.sendOptions)),
          { destJid: job.destJid, route: i === 0 ? 'primary' : `fallback[${i - 1}]`, attempt },
        )
        return
      } catch (err) {
        lastErr = err
        if (err?.code === 'SEND_MESSAGE_TIMEOUT') {
          logger.warn({ destJid: job.destJid, route: i === 0 ? 'primary' : `fallback[${i - 1}]` }, 'sendMessage timeout; tentando próximo fallback se houver')
        }
      }
    }
    throw lastErr || new Error('Todos os fallbacks de envio falharam')
  }

  await withSendTimeout(
    sock.sendMessage(job.destJid, payload, sendOptionsWith()),
    { destJid: job.destJid, route: 'default', attempt },
  )
}
