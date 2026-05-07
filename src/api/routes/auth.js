import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import db from '../../db.js'
import { normalizeEmail } from '../auth-utils.js'

function setAuthCookie(reply, token) {
  const secure = process.env.COOKIE_SECURE !== 'false'
  const maxAge = 60 * 60 * 24 * 7
  const parts = [
    `wb_auth=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (secure) parts.push('Secure')
  reply.header('Set-Cookie', parts.join('; '))
}

function normalizeContactPhone(rawPhone) {
  const digits = String(rawPhone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < 10 || digits.length > 15) return null
  return `+${digits}`
}


function isPrismaShapeMismatch(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('no such column') || message.includes('does not exist in the current database')
}

async function findUserByNormalizedEmail(email) {
  const exactUser = await db.user.findUnique({ where: { email } })
  if (exactUser) return exactUser

  try {
    const rows = await db.$queryRaw`
      SELECT id FROM "User"
      WHERE lower(trim(email)) = ${email}
      LIMIT 1
    `
    const legacyUserId = rows?.[0]?.id
    if (!legacyUserId) return null
    return db.user.findUnique({ where: { id: legacyUserId } })
  } catch {
    return null
  }
}

async function createUserWithSecureFields(data) {
  try {
    return await db.user.create({ data })
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    const { contactPhone, contactPhoneOptInAt, status, lastLoginAt, lastActivityAt, supportStatus, ...legacyData } = data
    return db.user.create({ data: legacyData })
  }
}

async function updateLoginActivity(user) {
  try {
    return await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActivityAt: new Date() },
    })
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    return user
  }
}

async function findCurrentUser(userId) {
  const secureSelect = {
    id: true,
    email: true,
    contactPhone: true,
    contactPhoneVerifiedAt: true,
    contactPhoneOptInAt: true,
    plan: true,
    accessExpiresAt: true,
    referralCode: true,
    status: true,
    supportStatus: true,
    lastLoginAt: true,
    lastActivityAt: true,
    createdAt: true,
  }

  try {
    return await db.user.findUnique({ where: { id: userId }, select: secureSelect })
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    return db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plan: true, accessExpiresAt: true, referralCode: true, createdAt: true },
    })
  }
}

async function ensureReferralCode(userId) {
  const referralCode = randomBytes(4).toString('hex')
  try {
    return await db.user.update({
      where: { id: userId },
      data: { referralCode },
      select: {
        id: true,
        email: true,
        contactPhone: true,
        contactPhoneVerifiedAt: true,
        contactPhoneOptInAt: true,
        plan: true,
        accessExpiresAt: true,
        referralCode: true,
        status: true,
        supportStatus: true,
        lastLoginAt: true,
        lastActivityAt: true,
        createdAt: true,
      },
    })
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    return db.user.update({
      where: { id: userId },
      data: { referralCode },
      select: { id: true, email: true, plan: true, accessExpiresAt: true, referralCode: true, createdAt: true },
    })
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    contactPhone: user.contactPhone,
    plan: user.plan,
    accessExpiresAt: user.accessExpiresAt,
    referralCode: user.referralCode,
    status: user.status,
    supportStatus: user.supportStatus,
    createdAt: user.createdAt,
  }
}

export async function authRoutes(app) {
  app.post('/register', async (req, reply) => {
    const { email: rawEmail, password, contactPhone: rawContactPhone, ref } = req.body ?? {}
    const email = normalizeEmail(rawEmail)
    const contactPhone = normalizeContactPhone(rawContactPhone)
    if (!email || !password || !contactPhone) return reply.code(400).send({ error: 'email, password e celular obrigatórios' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Formato de email inválido' })
    if (password.length < 8) return reply.code(400).send({ error: 'Senha deve ter no mínimo 8 caracteres' })

    const existing = await findUserByNormalizedEmail(email)
    if (existing) return reply.code(409).send({ error: 'Email já cadastrado' })

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date()
    const accessExpiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const referralCode = randomBytes(4).toString('hex')

    let referrer = null
    if (ref) {
      const found = await db.user.findUnique({ where: { referralCode: ref } }).catch(() => null)
      if (found) {
        const useCount = await db.user.count({ where: { referredBy: found.id } })
        if (useCount < 20) referrer = found
      }
    }

    const user = await createUserWithSecureFields({
      email,
      passwordHash,
      contactPhone,
      contactPhoneOptInAt: now,
      status: 'active',
      plan: 'trial',
      accessExpiresAt,
      referralCode,
      referredBy: referrer?.id,
      lastLoginAt: now,
      lastActivityAt: now,
      supportStatus: 'new',
    })

    if (referrer) {
      const base = referrer.accessExpiresAt && referrer.accessExpiresAt > new Date()
        ? referrer.accessExpiresAt.getTime()
        : Date.now()
      await db.user.update({
        where: { id: referrer.id },
        data: { accessExpiresAt: new Date(base + 7 * 24 * 60 * 60 * 1000) },
      })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' })
    setAuthCookie(reply, token)
    return { user: publicUser(user) }
  })

  app.post('/login', async (req, reply) => {
    const { email: rawEmail, password } = req.body ?? {}
    const email = normalizeEmail(rawEmail)
    if (!email || !password) return reply.code(400).send({ error: 'email e password obrigatórios' })

    const user = await findUserByNormalizedEmail(email)
    if (!user) return reply.code(401).send({ error: 'Credenciais inválidas' })
    if (user.status === 'banned' || user.status === 'suspended') {
      return reply.code(403).send({ error: 'Conta bloqueada. Entre em contato com o suporte.' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Credenciais inválidas' })

    const updated = await updateLoginActivity(user)

    const token = app.jwt.sign({ sub: updated.id, email: updated.email }, { expiresIn: '7d' })
    setAuthCookie(reply, token)
    return { user: publicUser(updated) }
  })

  app.post('/logout', async (_req, reply) => {
    reply.header('Set-Cookie', 'wb_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    return { ok: true }
  })

  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    let user = await findCurrentUser(req.user.sub)
    if (!user.referralCode) {
      user = await ensureReferralCode(req.user.sub)
    }
    return user
  })
}
