// Feature 017 (arquitetura multicanal de entrega) — a primeira implementação
// real do contrato de
// specs/017-multicanal-telegram-instagram/contracts/delivery-network-adapter.md.
//
// Este adaptador NÃO decide política (ritmo, repetição, roteamento, direito
// de plano, idade na fila, taxonomia de erro) — isso continua sendo dos
// módulos compartilhados. Ele só sabe DESCREVER o WhatsApp e reconhecer o
// próprio formato de identificador; o ENVIO em si continua sendo
// send.js/sendPreparedPayload, chamado diretamente por bot-worker.js (o
// pipeline de envio do WhatsApp não foi reescrito para passar por aqui —
// D-A2/D-A3 do plano: "o WhatsApp não muda de caminho").
//
// `send()` aqui existe para o adaptador cumprir o contrato de forma completa
// (é o que a rede fictícia de teste e o Telegram vão implementar de verdade),
// mas NADA no caminho de produção do WhatsApp o chama nesta fatia.

import { detectKind } from '../../core/jid.js'
import { DELIVERY_NETWORK, CAPABILITIES } from '../../core/delivery/networks.js'
import { sendPreparedPayload } from './send.js'

export const capabilities = CAPABILITIES[DELIVERY_NETWORK.WHATSAPP]

// Identificador de destino/origem de WhatsApp é o próprio JID Baileys
// (`@g.us` / `@newsletter`), sem prefixo de rede — é o formato histórico, e
// R10/D-A10 do plano garantem que ele nunca colide com o prefixo `tg:` das
// redes novas.
export function isOwnDestination(destinationId) {
  return detectKind(destinationId) !== null
}

export function describeDestination(destinationId) {
  return {
    nome: destinationId,
    identificadorExibido: destinationId,
  }
}

// A sessão de WhatsApp é por conta (WaSession), não um estado global do
// adaptador — quem sabe se está pronta é o chamador (bot-worker/manager),
// que já tem essa informação. Aqui só devolvemos o contrato padrão.
export async function readiness() {
  return { pronto: true, motivo: null, comoResolver: null }
}

export async function listDestinations() {
  // O WhatsApp lista destinos pela config já montada em
  // src/billing/groupEntitlements.js (cfg.groups.post), não por este
  // adaptador — ele não introduz uma segunda fonte da verdade.
  return []
}

export async function listSources() {
  return []
}

// send() delega para sendPreparedPayload por completude de contrato. O
// caminho de produção do WhatsApp CONTINUA chamando sendPreparedPayload
// diretamente em bot-worker.js — isso não muda nesta fatia.
export async function send(_ofertaNeutra, destino, ctx = {}) {
  try {
    await sendPreparedPayload({ sock: ctx.sock, job: { destJid: destino, logId: ctx.logId }, payload: ctx.payload, attempt: ctx.attempt })
    return { ok: true }
  } catch (err) {
    return { ok: false, motivo: err?.message || 'falha_desconhecida' }
  }
}

const whatsappAdapter = {
  id: DELIVERY_NETWORK.WHATSAPP,
  capabilities,
  describeDestination,
  isOwnDestination,
  readiness,
  listDestinations,
  listSources,
  send,
}

export default whatsappAdapter
