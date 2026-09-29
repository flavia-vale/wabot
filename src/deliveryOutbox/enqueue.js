// Feature 017 (arquitetura multicanal de entrega) — escrita compartilhada da
// caixa de saída (`DeliveryOutbox`, data-model.md §3.1). Usada pelo ÚNICO
// ramo de hand-off do worker (src/bot-worker.js, T022) e, nas fatias
// seguintes, pelos dispatchers de fila/oferta automática que já rodam fora
// do worker (contracts/delivery-outbox.md, "Quem escreve").
//
// Este módulo NUNCA fala com uma rede de entrega — só grava a oferta NEUTRA
// (src/core/delivery/neutralOffer.js) e segue. Quem drena e fala com o
// Telegram é `src/deliveryOutbox/sweep.js` (Fatia 3), dentro do processo da
// API, nunca do processo por conta.

import defaultDb from '../db.js'
import logger from '../logger.js'
import { resolveDeliveryNetwork, DELIVERY_NETWORK } from '../core/delivery/networks.js'

/**
 * Insere uma linha `pending` na caixa de saída. NUNCA lança para o chamador
 * — falha ao enfileirar é best-effort (o chamador já loga e segue, mesma
 * postura de outras escritas best-effort no bot-worker.js). Devolve a linha
 * criada, ou `null` em caso de falha.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.deliveryNetwork - rede de entrega do destino (nunca 'whatsapp' — ver D-A6)
 * @param {string} params.destinationId - identificador namespaceado ('tg:-100...')
 * @param {string|null} [params.sourceId] - origem, quando veio de espelhamento
 * @param {string|null} [params.messageLogId] - linha do histórico que esta entrega atualiza
 * @param {object} params.offer - a oferta NEUTRA (ver src/core/delivery/neutralOffer.js)
 * @param {{ db?: object }} [opts]
 */
export async function enqueueDeliveryOutbox(params = {}, opts = {}) {
  const db = opts.db ?? defaultDb
  const deliveryNetwork = resolveDeliveryNetwork(params.deliveryNetwork)
  if (deliveryNetwork === DELIVERY_NETWORK.WHATSAPP) {
    // Salvaguarda: a caixa de saída existe só para redes que NÃO são
    // WhatsApp (D-A6). Um chamador que tentasse enfileirar WhatsApp aqui
    // seria um erro de programação — não silenciamos, mas também não
    // gravamos a linha (o WhatsApp segue seu caminho de sempre).
    logger.warn({ userId: params.userId, destinationId: params.destinationId }, 'enqueueDeliveryOutbox chamado com deliveryNetwork=whatsapp; ignorado')
    return null
  }
  if (!params.userId || !params.destinationId) {
    logger.warn({ params }, 'enqueueDeliveryOutbox: userId/destinationId ausente; nada foi enfileirado')
    return null
  }

  try {
    return await db.deliveryOutbox.create({
      data: {
        userId: params.userId,
        deliveryNetwork,
        destinationId: params.destinationId,
        sourceId: params.sourceId ?? null,
        messageLogId: params.messageLogId ?? null,
        offerJson: JSON.stringify(params.offer ?? {}),
        status: 'pending',
      },
    })
  } catch (err) {
    logger.warn({ err: err?.message, userId: params.userId, destinationId: params.destinationId }, 'Falha ao gravar DeliveryOutbox; hand-off multicanal perdido para este item')
    return null
  }
}
