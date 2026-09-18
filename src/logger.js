import pino from 'pino'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { getLogsBaseDir } from './paths.js'
import { resolveLogTransportMode, LOG_TRANSPORT_MODES } from './core/loggerTransport.js'

const logDir = getLogsBaseDir()
mkdirSync(logDir, { recursive: true })
const logFile = join(logDir, 'bot.log')

const level = process.env.LOG_LEVEL || 'info'
const mode = resolveLogTransportMode(process.env)

// Modo `inline`: multistream roda NO PRÓPRIO processo — sem worker thread, sem
// isolate extra do V8 (ver src/core/loggerTransport.js). Escreve nos MESMOS dois
// lugares de sempre: o `bot.log` e a saída padrão que o PM2 captura. O que muda
// é só o formato do stdout, que passa a ser JSON como o `bot.log`.
//
// Modo `worker` (padrão, histórico): `transport` sobe um thread-stream.
const logger =
  mode === LOG_TRANSPORT_MODES.INLINE
    ? pino(
        { level },
        pino.multistream([
          { level, stream: pino.destination({ dest: logFile, sync: false }) },
          { level, stream: process.stdout },
        ])
      )
    : pino({
        level,
        transport: {
          targets: [
            { target: 'pino-pretty', options: { colorize: true }, level: 'info' },
            { target: 'pino/file', options: { destination: logFile }, level: 'info' },
          ],
        },
      })

logger.info({ logFile, logTransportMode: mode }, 'logger inicializado')

export default logger
