// Feature 017, Fatia 3 — como um grupo do Telegram chega à conta certa sem a
// cliente copiar nada (FR-017/US2 cenário 7).
//
// A tela Aplicativos mostra um link oficial do Telegram para "adicionar o
// robô a um grupo" com um código da conta embutido (`startgroup`). A cliente
// toca, escolhe o grupo, e o próprio Telegram entrega ao robô a mensagem
// `/start <código>` dentro daquele grupo. Com o código, o robô sabe a conta e
// cadastra o grupo como destino. O código é aleatório, não é segredo de
// infraestrutura e pode ser trocado (gera outro) sem efeito colateral.

import { randomBytes } from 'node:crypto'
import { DELIVERY_NETWORK } from '../../core/delivery/networks.js'
import { toDestinationId } from './adapter.js'
import { FORWARD_MODE } from '../../forwardingPolicy.js'

const NETWORK = DELIVERY_NETWORK.TELEGRAM

export function newLinkCode() {
  return randomBytes(12).toString('base64url')
}

export async function ensureTelegramLink(db, userId) {
  const existing = await db.deliveryNetworkLink.findUnique({
    where: { userId_deliveryNetwork: { userId, deliveryNetwork: NETWORK } },
  })
  if (existing) return existing
  return db.deliveryNetworkLink.create({ data: { userId, deliveryNetwork: NETWORK, linkCode: newLinkCode() } })
}

export async function findTelegramLink(db, userId) {
  return db.deliveryNetworkLink.findUnique({
    where: { userId_deliveryNetwork: { userId, deliveryNetwork: NETWORK } },
  })
}

export function buildAddToGroupUrl(username, linkCode) {
  if (!username || !linkCode) return null
  return `https://t.me/${encodeURIComponent(username)}?startgroup=${encodeURIComponent(linkCode)}&admin=post_messages`
}

// `/start <código>` ou `/start@NomeDoRobo <código>`.
export function parseStartCommand(text, botUsername) {
  const match = String(text ?? '').trim().match(/^\/start(?:@([A-Za-z0-9_]+))?\s+([A-Za-z0-9_-]{8,64})$/)
  if (!match) return null
  if (match[1] && botUsername && match[1].toLowerCase() !== String(botUsername).toLowerCase()) return null
  return match[2]
}

const GROUP_CHAT_TYPES = new Set(['group', 'supergroup'])

/**
 * Trata as mensagens que mexem na ligação entre grupos e contas. Devolve um
 * resumo do que fez (para log/teste); nunca lança para o laço de leitura.
 *
 * @param {object} deps
 * @param {object} deps.db
 * @param {object} deps.adapter - adaptador do Telegram (migrateDestination)
 * @param {(userId: string) => Promise<boolean>} deps.canUseMultiNetwork
 * @param {() => Promise<string|null>} deps.botUsername
 */
export async function handleLinkUpdate(update, { db, adapter, canUseMultiNetwork, botUsername }) {
  const message = update?.message
  const chat = message?.chat
  if (!message || !chat || !GROUP_CHAT_TYPES.has(chat.type)) return { acao: 'ignorado' }

  if (message.migrate_to_chat_id) {
    await adapter.migrateDestination(String(chat.id), String(message.migrate_to_chat_id))
    return { acao: 'migrado' }
  }

  if (message.new_chat_title) {
    await db.group.updateMany({
      where: { waJid: toDestinationId(chat.id), deliveryNetwork: NETWORK },
      data: { name: String(message.new_chat_title).slice(0, 120) },
    })
    return { acao: 'renomeado' }
  }

  const code = parseStartCommand(message.text, await botUsername())
  if (!code) return { acao: 'ignorado' }

  const link = await db.deliveryNetworkLink.findUnique({ where: { linkCode: code } })
  if (!link || link.deliveryNetwork !== NETWORK) return { acao: 'codigo_desconhecido' }
  if (!(await canUseMultiNetwork(link.userId))) return { acao: 'sem_plano', userId: link.userId }

  const waJid = toDestinationId(chat.id)
  // Anti-eco: o mesmo grupo não pode ser origem e destino da mesma conta.
  const asSource = await db.group.findFirst({ where: { userId: link.userId, waJid, role: 'monitor' }, select: { id: true } })
  if (asSource) return { acao: 'ja_e_origem', userId: link.userId }

  const name = String(chat.title ?? 'Grupo do Telegram').slice(0, 120)
  const existing = await db.group.findFirst({ where: { userId: link.userId, waJid, role: 'post' }, select: { id: true } })
  if (existing) {
    await db.group.update({ where: { id: existing.id }, data: { name } })
    return { acao: 'atualizado', userId: link.userId, groupId: existing.id }
  }
  const group = await db.group.create({
    data: {
      userId: link.userId,
      waJid,
      name,
      role: 'post',
      kind: 'group',
      deliveryNetwork: NETWORK,
      forwardMode: FORWARD_MODE.LINK_ONLY,
      imageMode: 'original',
    },
  })
  return { acao: 'cadastrado', userId: link.userId, groupId: group.id }
}
