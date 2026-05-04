import 'dotenv/config'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'

import { authRoutes } from './routes/auth.js'
import { sessionRoutes } from './routes/session.js'
import { groupsRoutes } from './routes/groups.js'
import { credentialsRoutes } from './routes/credentials.js'
import { paymentsRoutes } from './routes/payments.js'
import { configRoutes } from './routes/config.js'
import { broadcastRoutes } from './routes/broadcast.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { logsRoutes } from './routes/logs.js'
import db from '../db.js'

const app = Fastify({ logger: true })

async function verifyDatabase() {
  await db.$queryRaw`SELECT 1`
  // Verifica schema esperado (captura banco sem migrations)
  await db.user.count()
}

async function ensureDatabaseReady() {
  try {
    await verifyDatabase()
    app.log.info('Banco de dados pronto para receber tráfego')
  } catch (err) {
    app.log.error({ err: err.message }, 'Banco de dados indisponível ou sem migrations aplicadas')
    throw new Error('Falha na inicialização do banco. Execute: npx prisma migrate deploy e reinicie a API.')
  }
}

await app.register(fastifyCors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'] })
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET })
await app.register(fastifyWebsocket)

app.decorate('authenticate', async function (req, reply) {
  try { await req.jwtVerify() }
  catch { reply.code(401).send({ error: 'Não autorizado' }) }
})

app.register(authRoutes, { prefix: '/api/auth' })
app.register(sessionRoutes, { prefix: '/api/session' })
app.register(groupsRoutes, { prefix: '/api/groups' })
app.register(credentialsRoutes, { prefix: '/api/credentials' })
app.register(paymentsRoutes, { prefix: '/api/payments' })
app.register(configRoutes, { prefix: '/api/config' })
app.register(broadcastRoutes, { prefix: '/api/broadcast' })
app.register(dashboardRoutes, { prefix: '/api/dashboard' })
app.register(logsRoutes, { prefix: '/api/logs' })

// Liveness: processo está de pé
app.get('/health', () => ({ ok: true }))

// Readiness: dependências estão prontas para receber tráfego
app.get('/ready', async (req, reply) => {
  try {
    await verifyDatabase()
    return { ok: true }
  } catch {
    return reply.code(503).send({ ok: false, error: 'Banco indisponível' })
  }
})

const port = Number(process.env.API_PORT) || 3001
await ensureDatabaseReady()
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
