import pino from 'pino'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { getLogsBaseDir } from './paths.js'

const logDir = getLogsBaseDir()
mkdirSync(logDir, { recursive: true })
const logFile = join(logDir, 'bot.log')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      { target: 'pino-pretty', options: { colorize: true }, level: 'info' },
      { target: 'pino/file', options: { destination: logFile }, level: 'info' },
    ],
  },
})

logger.info({ logFile }, 'logger inicializado')

export default logger
