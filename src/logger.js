import pino from 'pino'
import { mkdirSync } from 'fs'

mkdirSync('./logs', { recursive: true })

const logger = pino({
  level: 'info',
  transport: {
    targets: [
      { target: 'pino-pretty', options: { colorize: true }, level: 'info' },
      { target: 'pino/file', options: { destination: './logs/bot.log' }, level: 'info' },
    ],
  },
})

export default logger
