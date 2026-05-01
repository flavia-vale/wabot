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

const app = Fastify({ logger: true })

await app.register(fastifyCors, { origin: true })
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

app.get('/health', () => ({ ok: true }))

const port = Number(process.env.API_PORT) || 3001
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
