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

const sleep = ms => new Promise(res => setTimeout(res, ms))

// Config cache com TTL de 60s
let configCache = null
let configCacheTime = 0

async function loadConfig() {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { groups: true, credentials: true, botConfig: true },
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

  const botConfig = user.botConfig ?? {
    delayMin: 5,
    delayMax: 15,
    platforms: 'shopee,amazon,mercadolivre,magazineluiza',
    blockedKeywords: '',
    welcomeMsg: '',
  }

  return { credentials, groups, plan: user.plan, botConfig }
}

async function getConfig() {
  if (!configCache || Date.now() - configCacheTime > 60_000) {
    configCache = await loadConfig()
    configCacheTime = Date.now()
  }
  return configCache
}

// Checa e envia mensagens agendadas pendentes
async function checkScheduledMessages() {
  if (!activeSock) return
  try {
    const pending = await db.scheduledMessage.findMany({
      where: { userId, status: 'pending', scheduledAt: { lte: new Date() } },
    })
    for (const msg of pending) {
      const jids = JSON.parse(msg.targetJids)
      let allOk = true
      for (const jid of jids) {
        try {
          await activeSock.sendMessage(jid, { text: msg.text })
          logger.info({ jid }, 'Mensagem agendada enviada')
        } catch (err) {
          logger.error({ jid, err: err.message }, 'Erro ao enviar mensagem agendada')
          allOk = false
        }
      }
      await db.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: allOk ? 'sent' : 'failed', sentAt: new Date() },
      })
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao processar agendamentos')
  }
}

setInterval(checkScheduledMessages, 30_000)

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
  const { credentials, groups, plan, botConfig } = await getConfig()

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
      activeSock = null
      if (process.send) process.send({ type: 'status', data: 'disconnected' })
      await db.waSession.upsert({
        where: { userId },
        create: { userId, status: 'disconnected' },
        update: { status: 'disconnected' },
      }).catch(() => {})
      if (shouldReconnect) startBot()
    }
  })

  // Welcome msg quando alguém entra nos grupos de postagem
  sock.ev.on('group-participants.update', async ({ id: groupJid, participants, action }) => {
    if (action !== 'add') return
    const cfg = await getConfig()
    if (!cfg.botConfig.welcomeMsg || !cfg.groups.post.includes(groupJid)) return
    for (const participantJid of participants) {
      try {
        await sock.sendMessage(groupJid, {
          text: cfg.botConfig.welcomeMsg,
          mentions: [participantJid],
        })
        logger.info({ groupJid, participantJid }, 'Welcome msg enviada')
      } catch (err) {
        logger.error({ err: err.message }, 'Erro ao enviar welcome msg')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.info({ type, count: messages.length }, 'messages.upsert recebido')
    if (type !== 'notify' && type !== 'append') return
    const cutoff = Date.now() - 30_000

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const msgTs = (msg.messageTimestamp ?? 0) * 1000
      if (msgTs < cutoff) continue
      const msgId = msg.key.id
      if (dedup.msgIds.some(e => e.id === msgId)) continue
      dedup.msgIds.push({ id: msgId, ts: Date.now() })
      saveDedup(dedup)

      const jid = msg.key.remoteJid
      const cfg = await getConfig()
      logger.info({ jid, monitorGroups: cfg.groups.monitor }, 'mensagem recebida')
      if (!cfg.groups.monitor.includes(jid)) continue

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption || ''

      if (!text) continue

      // Filtro por palavras bloqueadas
      if (cfg.botConfig.blockedKeywords) {
        const blocked = cfg.botConfig.blockedKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        const lower = text.toLowerCase()
        if (blocked.some(kw => lower.includes(kw))) {
          logger.info({ blocked }, 'Mensagem bloqueada por keyword'); continue
        }
      }

      const links = detectLinks(text)
      if (!links.length) continue

      // Filtro por plataforma
      const enabledPlatforms = new Set(cfg.botConfig.platforms.split(',').filter(Boolean))

      for (const { platform, url } of links) {
        if (!enabledPlatforms.has(platform)) {
          logger.info({ platform }, 'Plataforma desabilitada — pulando')
          continue
        }

        logger.info({ platform, url }, 'Link detectado')
        const converted = await convertLink(platform, url, cfg.credentials)
        if (!converted) { logger.warn({ platform, url }, 'Conversão falhou'); continue }

        const finalText = buildMessage(text, converted, url, null)

        for (const destJid of cfg.groups.post) {
          const key = `${destJid}:${converted}`
          if (dedup.links[key] && Date.now() - dedup.links[key] < dedupeWindowMs) {
            logger.info({ destJid, converted }, 'Duplicata ignorada'); continue
          }
          dedup.links[key] = Date.now()
          saveDedup(dedup)

          // Delay configurável antes de cada envio
          const { delayMin, delayMax } = cfg.botConfig
          if (delayMax > 0) {
            const ms = (delayMin + Math.random() * Math.max(0, delayMax - delayMin)) * 1000
            await sleep(ms)
          }

          try {
            await sock.sendMessage(destJid, { text: finalText })
            logger.info({ destJid, platform }, 'Mensagem enviada')
            if (cfg.plan === 'basic') {
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

process.on('message', async msg => {
  if (msg?.type === 'stop') {
    logger.info('Bot parando por solicitação do manager')
    process.exit(0)
  }

  if (msg?.type === 'reloadConfig') {
    configCache = null
    logger.info('Config recarregada')
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

  if (msg?.type === 'broadcast') {
    if (!activeSock) {
      process.send({ type: 'broadcastResult', requestId: msg.requestId, error: 'Bot não conectado' })
      return
    }
    let sent = 0
    const errors = []
    for (const jid of msg.jids) {
      try {
        await activeSock.sendMessage(jid, { text: msg.text })
        sent++
      } catch (err) {
        errors.push({ jid, error: err.message })
        logger.error({ jid, err: err.message }, 'Erro no broadcast')
      }
    }
    process.send({ type: 'broadcastResult', requestId: msg.requestId, data: { sent, errors } })
  }
})

startBot().catch(err => {
  logger.error(err, 'Erro fatal no worker')
  process.exit(1)
})
