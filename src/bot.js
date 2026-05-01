import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

import logger from './logger.js'
import { detectLinks } from './detector.js'
import { convertLink } from './converters/index.js'

const config = JSON.parse(readFileSync(resolve('./config.json'), 'utf8'))
const { credentials, groups, groupInvite, dedupeWindowMs = 300_000 } = config

// ── Dedup persistente ──────────────────────────────────────────────────────
// Guarda IDs de mensagens WA já processadas + URLs já enviadas por grupo.
// Persiste em disco: sobrevive a restarts.

const DEDUP_FILE = './logs/dedup.json'

function loadDedup() {
  try {
    return JSON.parse(readFileSync(DEDUP_FILE, 'utf8'))
  } catch {
    return { msgIds: [], links: {} }
  }
}

function saveDedup(store) {
  writeFileSync(DEDUP_FILE, JSON.stringify(store), 'utf8')
}

const dedup = loadDedup()

// Limpa entradas antigas ao iniciar (> dedupeWindowMs)
const now = Date.now()
dedup.msgIds = (dedup.msgIds || []).filter(e => now - e.ts < dedupeWindowMs)
for (const key of Object.keys(dedup.links || {})) {
  if (now - dedup.links[key] >= dedupeWindowMs) delete dedup.links[key]
}
saveDedup(dedup)

function isMsgSeen(msgId) {
  return dedup.msgIds.some(e => e.id === msgId)
}

function markMsgSeen(msgId) {
  dedup.msgIds.push({ id: msgId, ts: Date.now() })
  saveDedup(dedup)
}

function isLinkDuplicate(jid, url) {
  const key = `${jid}:${url}`
  const last = dedup.links[key]
  if (last && Date.now() - last < dedupeWindowMs) return true
  dedup.links[key] = Date.now()
  saveDedup(dedup)
  return false
}

// ── Mensagem ───────────────────────────────────────────────────────────────

const INVITE_RE = /🚀?\s*Participe do Grupo[:\s]+https:\/\/chat\.whatsapp\.com\/\S+/gi

function buildMessage(originalText, convertedUrl, originalUrl) {
  let text = originalText.replace(originalUrl, convertedUrl).trimEnd()

  if (!groupInvite) return text

  // Se já tem convite, substitui pelo nosso; senão, adiciona
  if (INVITE_RE.test(text)) {
    INVITE_RE.lastIndex = 0
    text = text.replace(INVITE_RE, `🚀 Participe do Grupo: ${groupInvite}`)
  } else {
    text = `${text}\n🚀 Participe do Grupo: ${groupInvite}`
  }
  return text
}

// ── Bot ────────────────────────────────────────────────────────────────────

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: logger.child({ name: 'baileys' }),
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      logger.info('Escaneie o QR Code abaixo com o WhatsApp:')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') logger.info('WhatsApp conectado ✅')
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      logger.warn({ code }, `Conexão encerrada — reconectando: ${shouldReconnect}`)
      if (shouldReconnect) startBot()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue

      const msgId = msg.key.id
      if (isMsgSeen(msgId)) continue   // já processado em sessão anterior
      markMsgSeen(msgId)

      const jid = msg.key.remoteJid
      if (!groups.monitor.includes(jid)) continue

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        ''

      if (!text) continue

      const links = detectLinks(text)
      if (!links.length) continue

      for (const { platform, url } of links) {
        logger.info({ platform, url }, 'Link detectado')

        const converted = await convertLink(platform, url, credentials)

        if (!converted) {
          logger.warn({ platform, url }, 'Conversão falhou — link ignorado')
          continue
        }

        logger.info({ platform, original: url, converted }, 'Link convertido')

        const finalText = buildMessage(text, converted, url)

        for (const destJid of groups.post) {
          if (isLinkDuplicate(destJid, converted)) {
            logger.info({ destJid, converted }, 'Duplicata ignorada')
            continue
          }

          try {
            await sock.sendMessage(destJid, { text: finalText })
            logger.info({ destJid, platform }, 'Mensagem enviada ✅')
          } catch (err) {
            logger.error({ destJid, err: err.message }, 'Erro ao enviar')
          }
        }
      }
    }
  })
}

startBot().catch(err => {
  logger.error(err, 'Erro fatal')
  process.exit(1)
})
