import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { performance } from 'node:perf_hooks'

const db = new PrismaClient()
const total = Number(process.env.LOG_PRESSURE_TOTAL) || Number(process.argv[2]) || 10_000
const batchSize = Number(process.env.LOG_PRESSURE_BATCH) || 500
const email = `pressure-${Date.now()}@BOTinho.local`

function nowMinus(index) {
  return new Date(Date.now() - index * 1000)
}

async function timed(name, fn) {
  const start = performance.now()
  const result = await fn()
  const ms = Math.round(performance.now() - start)
  console.log(`${name}: ${ms}ms`)
  return result
}

try {
  const user = await db.user.create({ data: { email, passwordHash: 'pressure' } })
  await db.group.createMany({ data: [
    { userId: user.id, waJid: 'source@g.us', name: 'Origem', role: 'monitor' },
    { userId: user.id, waJid: 'dest@g.us', name: 'Destino', role: 'post' },
  ] })

  await timed(`insert ${total} logs`, async () => {
    for (let offset = 0; offset < total; offset += batchSize) {
      const count = Math.min(batchSize, total - offset)
      await db.messageLog.createMany({
        data: Array.from({ length: count }, (_, i) => {
          const index = offset + i
          return {
            userId: user.id,
            platform: index % 2 ? 'shopee' : 'amazon',
            sourceGroup: 'source@g.us',
            destGroup: 'dest@g.us',
            originalUrl: `https://example.test/original/${index}`,
            convertedUrl: `https://example.test/converted/${index}`,
            messageText: `Log pressão ${index}`,
            status: index % 5 === 0 ? 'error' : 'success',
            sentAt: nowMinus(index),
          }
        }),
      })
    }
  })

  await timed('count all', () => db.messageLog.count({ where: { userId: user.id } }))
  await timed('page all desc', () => db.messageLog.findMany({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, take: 20 }))
  await timed('page success desc', () => db.messageLog.findMany({ where: { userId: user.id, status: 'success' }, orderBy: { sentAt: 'desc' }, take: 20 }))
  await timed('page error desc', () => db.messageLog.findMany({ where: { userId: user.id, status: 'error' }, orderBy: { sentAt: 'desc' }, take: 20 }))

  console.log(JSON.stringify({ userId: user.id, total }, null, 2))
} finally {
  await db.user.deleteMany({ where: { email } }).catch(() => {})
  await db.$disconnect()
}
