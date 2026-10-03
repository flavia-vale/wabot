// Feature 017, Fatia 3 (T051) — entrega por aplicativo para quem já roda
// fora do worker (fila de ofertas, oferta automática, revisão). Destino de
// WhatsApp segue EXATAMENTE pelo `sendBroadcast` de sempre; destino de outro
// aplicativo (identificado pelo prefixo, ex.: `tg:`) vai para a caixa de
// saída, drenada dentro da API. Ordem: WhatsApp primeiro — se ele falhar, o
// chamador tenta o item de novo e o outro aplicativo ainda não recebeu nada
// (sem duplicar).

import logger from '../logger.js'
import { DELIVERY_NETWORK, canonicalDestinationId, deliveryNetworkOfDestinationId, isDeliveryNetworkEnabled } from '../core/delivery/networks.js'
import { broadcastSourceGroup } from '../offerQueue/sourceTag.js'
import { enqueueDeliveryOutbox } from './enqueue.js'

export function splitTargetsByDeliveryNetwork(jids = []) {
  const whatsapp = []
  const outros = []
  for (const jid of jids) {
    const deliveryNetwork = deliveryNetworkOfDestinationId(jid)
    if (deliveryNetwork === DELIVERY_NETWORK.WHATSAPP) whatsapp.push(jid)
    else outros.push({ deliveryNetwork, destinationId: canonicalDestinationId(jid) })
  }
  return { whatsapp, outros }
}

// O destino precisa da sessão do WhatsApp conectada? (Só se algum for
// WhatsApp — destino de outro aplicativo não depende do celular da cliente.)
export function needsWhatsappSession(jids = []) {
  return jids.some((jid) => deliveryNetworkOfDestinationId(jid) === DELIVERY_NETWORK.WHATSAPP)
}

// Mesmo rótulo de origem que o robô do WhatsApp grava (offerQueue:<id>,
// offerAutomation, manual) — o histórico mostra igual nos dois aplicativos.
function historySource(opts = {}) {
  return broadcastSourceGroup(opts)
}

/**
 * Embrulha um `sendBroadcast(userId, text, jids, opts)`: mesma assinatura,
 * mesmo comportamento para WhatsApp; destinos de outro aplicativo são
 * enfileirados na caixa de saída.
 */
export function withDeliveryNetworkHandOff(sendBroadcastFn, { env = process.env, enqueue = enqueueDeliveryOutbox } = {}) {
  return async function sendBroadcastByNetwork(userId, text, jids = [], opts = {}) {
    const { whatsapp, outros } = splitTargetsByDeliveryNetwork(jids)
    const result = whatsapp.length ? await sendBroadcastFn(userId, text, whatsapp, opts) : undefined
    for (const target of outros) {
      if (!isDeliveryNetworkEnabled(target.deliveryNetwork, env)) {
        logger.warn({ userId, destinationId: target.destinationId }, 'destino de aplicativo desligado no servidor; oferta não enfileirada')
        continue
      }
      await enqueue({
        userId,
        deliveryNetwork: target.deliveryNetwork,
        destinationId: target.destinationId,
        sourceId: historySource(opts),
        offer: {
          texto: String(text ?? ''),
          linkConvertido: '',
          imagem: opts.imageUrl ? { url: opts.imageUrl } : null,
          produto: { titulo: null, preco: null },
          historico: { origem: historySource(opts), loja: opts.loja ?? null },
        },
      })
    }
    return result
  }
}
