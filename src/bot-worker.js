import 'dotenv/config'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

import logger from './logger.js'
import { detectLinks } from './detector.js'
import { convertLink } from './converters/index.js'
import db from './db.js'

const userId = process.env.BOT_USER_ID
if (!userId) { logger.error('BOT_USER_ID não definido'); process.exit(1) }

let activeSock = null

const AUTH_DIR = resolve(`./auth_info/${userId}`)
const DEDUP_FILE = resolve(`./logs/dedup_${userId}.json`)

function loadDedup() {
  try { return JSON.parse(readFileSync(DEDUP_FILE, 'utf8')) }
  catch { return { msgIds: [], links: {} } }
}

function saveDedup(store) {
  writeFileSync(DEDUP_FILE, JSON.stringify(store), 'utf8')
}

async function loadConfig() {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { groups: true, credentials: true },
  })
  if (!user) throw new Error(`Usuário ${userId} não encontrado`)

  if (user.trialExpiresAt && user.trialExpiresAt < new Date()) {
    if (process.send) process.send({ type: 'status', data: 'blocked' })
    logger.error('Acesso expirado — bot bloqueado')
    process.exit(0)
  }

  const credentials = {}
  for (const c of user.credentials) credentials[c.platform] = JSON.parse(c.data)

  const groups = {
    monitor: user.groups.filter(g => g.role === 'monitor').map(g => g.waJid),
    post:    user.groups.filter(g => g.role === 'post').map(g => g.waJid),
  }

  return { credentials, groups, plan: user.plan }
}

const INVITE_RE = /🚀?\s*Participe do Grupo[:\s]+https:\/\/chat\.whatsapp\.com\/\S+/gi

function buildMessage(originalText, convertedUrl, originalUrl, groupInvite) {
  let text = originalText.replace(originalUrl, convertedUrl).trimEnd()
  if (!groupInvite) return text
  if (INVITE_RE.test(text)) {
    INVITE_RE.lastIndex = 0
    text = text.replace(INVITE_RE, `🚀 Participe do Grupo: ${groupInvite}`)
  } else {
    text = `${text}\n🚀 Participe do Grupo: ${groupInvite}`
  }
  return text
}

const AD_TEXT = '💡 Bot gerenciado pelo WaBot — automatize seus grupos de afiliados: wabot.com.br'
let adSendCount = 0

async function startBot() {
  const { credentials, groups, plan } = await loadConfig()

  const dedupeWindowMs = 300_000
  const dedup = loadDedup()
  const now = Date.now()
  dedup.msgIds = (dedup.msgIds || []).filter(e => now - e.ts < dedupeWindowMs)
  for (const key of Object.keys(dedup.links || {})) {
    if (now - dedup.links[key] >= dedupeWindowMs) delete dedup.links[key]
  }
  saveDedup(dedup)

  mkdirSync(AUTH_DIR, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: logger.child({ name: 'baileys' }),
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (process.send) process.send({ type: 'qr', data: qr })
      await db.waSession.upsert({
        where: { userId },
        create: { userId, status: 'connecting' },
        update: { status: 'connecting' },
      })
    }

    if (connection === 'open') {
      activeSock = sock
      const phone = sock.user?.id?.split(':')[0] ?? null
      if (process.send) process.send({ type: 'status', data: 'connected', phone })
      await db.waSession.upsert({
        where: { userId },
        create: { userId, status: 'connected', phone },
        update: { status: 'connected', phone },
      })
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      if (process.send) process.send({ type: 'status', data: 'disconnected' })
      await db.waSession.upsert({
        where: { userId },
        create: { userId, status: 'disconnected' },
        update: { status: 'disconnected' },
      }).catch(() => {})
      if (shouldReconnect) startBot()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const msgId = msg.key.id
      if (dedup.msgIds.some(e => e.id === msgId)) continue
      dedup.msgIds.push({ id: msgId, ts: Date.now() })
      saveDedup(dedup)

      const jid = msg.key.remoteJid
      if (!groups.monitor.includes(jid)) continue

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption || ''

      if (!text) continue

      const links = detectLinks(text)
      if (!links.length) continue

      for (const { platform, url } of links) {
        logger.info({ platform, url }, 'Link detectado')
        const converted = await convertLink(platform, url, credentials)
        if (!converted) { logger.warn({ platform, url }, 'Conversão falhou'); continue }

        const finalText = buildMessage(text, converted, url, null)

        for (const destJid of groups.post) {
          const key = `${destJid}:${converted}`
          if (dedup.links[key] && Date.now() - dedup.links[key] < dedupeWindowMs) {
            logger.info({ destJid, converted }, 'Duplicata ignorada'); continue
          }
          dedup.links[key] = Date.now()
          saveDedup(dedup)

          try {
            await sock.sendMessage(destJid, { text: finalText })
            logger.info({ destJid, platform }, 'Mensagem enviada')
            if (plan === 'basic') {
              adSendCount++
              if (adSendCount % 50 === 0) {
                await sock.sendMessage(destJid, { text: AD_TEXT }).catch(() => {})
              }
            }
          } catch (err) {
            logger.error({ destJid, err: err.message }, 'Erro ao enviar')
          }
        }
      }
    }
  })
}

process.on('message', msg => {
  if (msg?.type === 'stop') {
    logger.info('Bot parando por solicitação do manager')
    process.exit(0)
  }
  if (msg?.type === 'listGroups') {
    if (!activeSock) {
      process.send({ type: 'groups', requestId: msg.requestId, data: [], error: 'Bot não conectado' })
      return
    }
    activeSock.groupFetchAllParticipating()
      .then(groups => {
        const list = Object.entries(groups).map(([id, g]) => ({ waJid: id, name: g.subject }))
        process.send({ type: 'groups', requestId: msg.requestId, data: list })
      })
      .catch(err => {
        process.send({ type: 'groups', requestId: msg.requestId, data: [], error: err.message })
      })
  }
})

startBot().catch(err => {
  logger.error(err, 'Erro fatal no worker')
  process.exit(1)
})
