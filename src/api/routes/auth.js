import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import db from '../../db.js'

export async function authRoutes(app) {
  app.post('/register', async (req, reply) => {
    const { email: rawEmail, password, ref } = req.body ?? {}
    const email = rawEmail?.toLowerCase()
    if (!email || !password) return reply.code(400).send({ error: 'email e password obrigatórios' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Formato de email inválido' })
    if (password.length < 8) return reply.code(400).send({ error: 'Senha deve ter no mínimo 8 caracteres' })

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email já cadastrado' })

    const passwordHash = await bcrypt.hash(password, 10)
    const trialExpiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const referralCode = randomBytes(4).toString('hex')

    let referrer = null
    if (ref) {
      const found = await db.user.findUnique({ where: { referralCode: ref } }).catch(() => null)
      if (found) {
        const useCount = await db.user.count({ where: { referredBy: found.id } })
        if (useCount < 20) referrer = found
      }
    }

    const user = await db.user.create({
      data: { email, passwordHash, plan: 'trial', trialExpiresAt, referralCode, referredBy: referrer?.id },
    })

    if (referrer) {
      const base = referrer.trialExpiresAt && referrer.trialExpiresAt > new Date()
        ? referrer.trialExpiresAt.getTime()
        : Date.now()
      await db.user.update({
        where: { id: referrer.id },
        data: { trialExpiresAt: new Date(base + 7 * 24 * 60 * 60 * 1000) },
      })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email })
    return { token, user: { id: user.id, email: user.email, plan: user.plan, trialExpiresAt } }
  })

  app.post('/login', async (req, reply) => {
    const { email: rawEmail, password } = req.body ?? {}
    const email = rawEmail?.toLowerCase()
    if (!email || !password) return reply.code(400).send({ error: 'email e password obrigatórios' })

    const user = await db.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: 'Credenciais inválidas' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Credenciais inválidas' })

    const token = app.jwt.sign({ sub: user.id, email: user.email })
    return { token, user: { id: user.id, email: user.email, plan: user.plan, trialExpiresAt: user.trialExpiresAt } }
  })

  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    let user = await db.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, plan: true, trialExpiresAt: true, referralCode: true, createdAt: true },
    })
    if (!user.referralCode) {
      const referralCode = randomBytes(4).toString('hex')
      user = await db.user.update({
        where: { id: req.user.sub },
        data: { referralCode },
        select: { id: true, email: true, plan: true, trialExpiresAt: true, referralCode: true, createdAt: true },
      })
    }
    return user
  })
}
