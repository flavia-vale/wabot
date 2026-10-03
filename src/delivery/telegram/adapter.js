// Feature 017, Fatia 3 (T044) — implementação do contrato de adaptador para
// o Telegram (contracts/delivery-network-adapter.md). Só FALA com o
// Telegram: plano, ritmo, repetição e histórico são dos módulos
// compartilhados (regra 1); `send` nunca lança (regra 2); nenhum segredo sai
// daqui (regra 5).
//
// Identificador de destino: `tg:<id do grupo no Telegram>` (R10) — nenhum
// endereço do WhatsApp tem esse formato, então a unicidade de Group continua
// valendo sem alteração.

import { CAPABILITIES, DELIVERY_NETWORK } from '../../core/delivery/networks.js'
import { TELEGRAM_CAPTION_LIMIT, TELEGRAM_TEXT_LIMIT, clampText, whatsappTextToTelegramHtml } from './format.js'
import { DELIVERY_REDUCTION } from '../../core/delivery/neutralOffer.js'

export const TELEGRAM_DESTINATION_PREFIX = 'tg:'

export const capabilities = CAPABILITIES[DELIVERY_NETWORK.TELEGRAM]

export function isOwnDestination(destinationId) {
  return typeof destinationId === 'string' && destinationId.startsWith(TELEGRAM_DESTINATION_PREFIX)
}

export function toDestinationId(chatId) {
  return `${TELEGRAM_DESTINATION_PREFIX}${chatId}`
}

export function chatIdOf(destinationId) {
  return isOwnDestination(destinationId) ? destinationId.slice(TELEGRAM_DESTINATION_PREFIX.length) : null
}

// Motivos (catálogo com texto leigo em src/core/delivery/deliveryFailure.js).
export const TELEGRAM_REASON = Object.freeze({
  ROBO_NAO_ADICIONADO: 'robo_nao_adicionado',
  SEM_PERMISSAO: 'sem_permissao',
  DESTINO_APAGADO: 'destino_apagado',
  OFERTA_INCOMPATIVEL: 'oferta_incompativel',
  LIMITE_DE_RITMO: 'limite_de_ritmo',
  ROBO_INDISPONIVEL: 'robo_indisponivel',
})

// Traduz a recusa do Telegram num motivo. `temporario` = vale tentar de novo
// mais tarde (o item continua na caixa de saída); os demais são definitivos
// para aquela oferta.
export function classifyTelegramError(err) {
  const code = Number(err?.errorCode ?? err?.status ?? 0)
  const description = String(err?.description ?? '').toLowerCase()
  // `sinal` alimenta o estado do robô inteiro (networkHealth.js); recusa de
  // UM grupo não tem sinal — não diz nada sobre o robô.
  if (code === 429) return { motivo: TELEGRAM_REASON.LIMITE_DE_RITMO, temporario: true, retryAfterSec: err?.retryAfterSec ?? 30, sinal: 'limite' }
  if (code === 401) return { motivo: TELEGRAM_REASON.ROBO_INDISPONIVEL, temporario: true, retryAfterSec: 300, sinal: 'bloqueado' }
  if (code === 0 || code >= 500) return { motivo: TELEGRAM_REASON.ROBO_INDISPONIVEL, temporario: true, retryAfterSec: 60, sinal: 'indisponivel' }
  if (/kicked|not a member|bot was blocked|user is deactivated/.test(description)) return { motivo: TELEGRAM_REASON.ROBO_NAO_ADICIONADO, temporario: false }
  if (/chat not found|group chat was deleted|chat was upgraded/.test(description)) return { motivo: TELEGRAM_REASON.DESTINO_APAGADO, temporario: false }
  if (code === 403 || /not enough rights|have no rights|write_forbidden|need administrator rights/.test(description)) return { motivo: TELEGRAM_REASON.SEM_PERMISSAO, temporario: false }
  return { motivo: TELEGRAM_REASON.OFERTA_INCOMPATIVEL, temporario: false }
}

// Estado do robô dentro de um grupo, pela resposta de getChatMember.
export function readinessFromMember(member) {
  const status = member?.status
  if (!status || status === 'left' || status === 'kicked') return { pronto: false, motivo: TELEGRAM_REASON.ROBO_NAO_ADICIONADO }
  if (status === 'restricted' && member.can_send_messages === false) return { pronto: false, motivo: TELEGRAM_REASON.SEM_PERMISSAO }
  if (status === 'administrator' && member.can_post_messages === false) return { pronto: false, motivo: TELEGRAM_REASON.SEM_PERMISSAO }
  return { pronto: true, motivo: null }
}

function composeText(oferta) {
  const texto = String(oferta?.texto ?? '').trim()
  const link = String(oferta?.linkConvertido ?? '').trim()
  if (link && !texto.includes(link)) return texto ? `${texto}\n\n${link}` : link
  return texto
}

const CACHE_TTL_MS = 60_000

export function createTelegramAdapter({ api, db, now = () => Date.now(), cacheTtlMs = CACHE_TTL_MS } = {}) {
  if (!api) throw new Error('createTelegramAdapter: api obrigatória')
  let me = null
  const readinessCache = new Map() // chatId → { at, value }

  async function botId() {
    if (!me) me = await api.getMe()
    return me.id
  }

  async function botUsername() {
    if (!me) me = await api.getMe()
    return me.username ?? null
  }

  async function destinationReadiness(chatId) {
    const cached = readinessCache.get(chatId)
    if (cached && now() - cached.at < cacheTtlMs) return cached.value
    let value
    try {
      value = readinessFromMember(await api.getChatMember(chatId, await botId()))
    } catch (err) {
      const { motivo, temporario } = classifyTelegramError(err)
      value = { pronto: false, motivo, temporario }
    }
    readinessCache.set(chatId, { at: now(), value })
    return value
  }

  async function listDestinations(userId) {
    const groups = await db.group.findMany({
      where: { userId, deliveryNetwork: DELIVERY_NETWORK.TELEGRAM, role: 'post' },
      select: { id: true, waJid: true, name: true },
      orderBy: { name: 'asc' },
    })
    const out = []
    for (const g of groups) {
      const state = await destinationReadiness(chatIdOf(g.waJid))
      out.push({ groupId: g.id, destinationId: g.waJid, nome: g.name, pronto: state.pronto, motivo: state.motivo })
    }
    return out
  }

  async function readiness(userId) {
    const destinos = await listDestinations(userId)
    if (destinos.length === 0) return { pronto: false, motivo: TELEGRAM_REASON.ROBO_NAO_ADICIONADO }
    if (destinos.some((d) => d.pronto)) return { pronto: true, motivo: null }
    return { pronto: false, motivo: destinos[0].motivo }
  }

  // Texto que cabe no limite DEPOIS de virar HTML (revisão crítica, item 6):
  // "&" vira "&amp;", então medir o texto cru deixava passar legenda que o
  // Telegram recusava — e a oferta sumia. Encolhe até caber.
  function renderFit(raw, limit, html) {
    if (!html) return { text: clampText(raw, limit), cortado: raw.length > limit }
    let budget = limit
    for (let i = 0; i < 6; i++) {
      const rendered = whatsappTextToTelegramHtml(clampText(raw, budget))
      if (rendered.length <= limit) return { text: rendered, cortado: raw.length > budget }
      budget = Math.max(1, budget - (rendered.length - limit) - 8)
    }
    return { text: clampText(raw, limit), cortado: true, semHtml: true }
  }

  // Recusa que é DA FOTO (o Telegram não conseguiu baixar, formato, tamanho)
  // e não do grupo ou do robô: a oferta sai só com o texto (revisão crítica,
  // item 5), em vez de sumir.
  function isPhotoOnlyFailure(err) {
    if (err?.migrateToChatId) return false
    if (/parse entities/i.test(String(err?.description ?? ''))) return false
    const { motivo, temporario } = classifyTelegramError(err)
    if (temporario) return false
    return motivo !== TELEGRAM_REASON.ROBO_NAO_ADICIONADO && motivo !== TELEGRAM_REASON.DESTINO_APAGADO
  }

  async function sendText(chatId, raw, html) {
    const fitted = renderFit(raw, TELEGRAM_TEXT_LIMIT, html)
    return api.sendMessage(chatId, fitted.text, html && !fitted.semHtml ? { parse_mode: 'HTML' } : {})
  }

  async function sendOnce(chatId, oferta, html) {
    const raw = composeText(oferta)
    const imageUrl = oferta?.imagem?.url
    if (imageUrl && capabilities.acceptsImage) {
      try {
        const caption = renderFit(raw, TELEGRAM_CAPTION_LIMIT, html)
        if (!caption.cortado) {
          return { result: await api.sendPhoto(chatId, imageUrl, caption.text, html && !caption.semHtml ? { parse_mode: 'HTML' } : {}), reducoes: [] }
        }
        // Texto maior que a legenda: foto sozinha e o texto inteiro depois.
        await api.sendPhoto(chatId, imageUrl, undefined, {})
      } catch (err) {
        if (!isPhotoOnlyFailure(err)) throw err
        return { result: await sendText(chatId, raw, html), reducoes: [DELIVERY_REDUCTION.IMAGEM_REMOVIDA] }
      }
    }
    return { result: await sendText(chatId, raw, html), reducoes: [] }
  }

  // Grupo comum que vira "supergrupo" (acontece, por exemplo, ao tornar o
  // robô administrador) muda de identificador no Telegram. O destino da
  // cliente é o mesmo grupo: só o identificador gravado acompanha.
  async function migrateDestination(oldChatId, newChatId) {
    if (!db || !newChatId) return
    const from = toDestinationId(oldChatId)
    const to = toDestinationId(newChatId)
    const rows = await db.group.findMany({ where: { waJid: from, deliveryNetwork: DELIVERY_NETWORK.TELEGRAM }, select: { id: true } })
    for (const row of rows) {
      // Colisão (o grupo novo já foi ligado de novo pela cliente): o
      // cadastro novo segue valendo; o antigo fica como estava.
      await db.group.update({ where: { id: row.id }, data: { waJid: to } }).catch(() => {})
    }
    // Revisão crítica, item 9: as ofertas que já esperavam na caixa de saída
    // acompanham o grupo — antes eram descartadas como "grupo desligado".
    await db.deliveryOutbox?.updateMany?.({
      where: { destinationId: from, status: { in: ['pending', 'sending'] } },
      data: { destinationId: to },
    }).catch(() => {})
    readinessCache.delete(oldChatId)
  }

  async function send(oferta, destino) {
    let chatId = chatIdOf(destino)
    if (!chatId) return { ok: false, motivo: TELEGRAM_REASON.DESTINO_APAGADO, temporario: false }
    try {
      try {
        return await sendAndWrap(chatId, oferta)
      } catch (err) {
        if (!err?.migrateToChatId) throw err
        await migrateDestination(chatId, String(err.migrateToChatId))
        chatId = String(err.migrateToChatId)
        return await sendAndWrap(chatId, oferta)
      }
    } catch (err) {
      readinessCache.delete(chatId)
      return { ok: false, ...classifyTelegramError(err) }
    }
  }

  async function sendAndWrap(chatId, oferta) {
    try {
      const { result, reducoes } = await sendOnce(chatId, oferta, true)
      return { ok: true, messageId: result?.message_id != null ? String(result.message_id) : null, reducoes }
    } catch (err) {
      // Marcação recusada ("can't parse entities"): reenvia em texto puro.
      if (!/parse entities/i.test(String(err?.description ?? ''))) throw err
      const { result, reducoes } = await sendOnce(chatId, oferta, false)
      return { ok: true, messageId: result?.message_id != null ? String(result.message_id) : null, reducoes }
    }
  }

  return {
    id: DELIVERY_NETWORK.TELEGRAM,
    capabilities,
    describeDestination: (destinationId) => ({ nome: null, identificadorExibido: chatIdOf(destinationId) }),
    isOwnDestination,
    readiness,
    listDestinations,
    listSources: async () => [],
    send,
    migrateDestination,
    destinationReadiness,
    botUsername,
    botId,
  }
}
