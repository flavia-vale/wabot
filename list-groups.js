import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import pino from 'pino'

const silentLogger = pino({ level: 'silent' })

async function listGroups() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      console.log('\nEscaneie o QR Code com o WhatsApp:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('\nConectado! Buscando grupos...\n')
      await new Promise(r => setTimeout(r, 3000))

      const chats = await sock.groupFetchAllParticipating()
      const groups = Object.values(chats)
        .map(g => ({ jid: g.id, nome: g.subject }))
        .sort((a, b) => a.nome.localeCompare(b.nome))

      console.log('='.repeat(70))
      for (const g of groups) {
        console.log(`${g.nome.padEnd(45)} | ${g.jid}`)
      }
      console.log('='.repeat(70))
      console.log(`\nTotal: ${groups.length} grupos`)
      process.exit(0)
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) listGroups()
    }
  })
}

listGroups()
