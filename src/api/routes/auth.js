import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import db from '../../db.js'
import { normalizeEmail } from '../auth-utils.js'

function setAuthCookie(reply, req, token) {
  const secureByEnv = process.env.COOKIE_SECURE !== 'false'
  const requestIsHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https'
  const secure = secureByEnv && requestIsHttps
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

function normalizeName(rawName) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ')
  return name || null
}

function randomToken(size = 8) {
  return randomBytes(size).toString('hex')
}

function generateFallbackEmail() {
  return `user_${randomToken(6)}@sistema.com`
}

function generateFallbackPassword() {
  return `wb_${randomToken(8)}_${Date.now()}`
}

function generatePromoContactPhone() {
  return `+79${String(Date.now()).slice(-9)}${randomBytes(2).toString('hex').slice(0, 3).replace(/[^0-9]/g, '7')}`.slice(0, 16)
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
    const { contactPhone, contactPhoneOptInAt, status, lastLoginAt, lastActivityAt, supportStatus, name, ...legacyData } = data
    return db.user.create({ data: legacyData })
  }
}

async function ensureUniqueContactPhone(contactPhone) {
  const existing = await db.user.findFirst({ where: { contactPhone }, select: { id: true } })
  if (existing) {
    const err = new Error('Este número de telefone já está cadastrado')
    err.statusCode = 409
    throw err
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
    name: true,
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
        name: true,
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
    name: user.name,
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
    const { name: rawName, email: rawEmail, password: rawPassword, contactPhone: rawContactPhone, ref, source, coupon_code: couponCode } = req.body ?? {}
    const name = normalizeName(rawName)
    const email = normalizeEmail(rawEmail) || generateFallbackEmail()
    const isPromoVipFlow = source === 'promo_vip_7dias' && couponCode === 'VIP7DIAS'
    const contactPhone = normalizeContactPhone(rawContactPhone) || (isPromoVipFlow ? generatePromoContactPhone() : null)
    const password = String(rawPassword || generateFallbackPassword())

    if (!name || !contactPhone) return reply.code(400).send({ error: 'nome e celular obrigatórios' })
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Formato de email inválido' })
    if (rawPassword && password.length < 8) return reply.code(400).send({ error: 'Senha deve ter no mínimo 8 caracteres' })

    const [existingEmail] = await Promise.all([
      findUserByNormalizedEmail(email),
      ensureUniqueContactPhone(contactPhone),
    ])
    if (existingEmail) return reply.code(409).send({ error: 'Email já cadastrado' })

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date()
    const accessExpiresAt = isPromoVipFlow
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 3 * 60 * 60 * 1000)
    const referralCode = randomBytes(4).toString('hex')

    let referrer = null
    if (ref) {
      const found = await db.user.findUnique({ where: { referralCode: ref } }).catch(() => null)
      if (found) {
        const useCount = await db.user.count({ where: { referredBy: found.id } })
        if (useCount < 20) referrer = found
      }
    }

    try {
      const user = await createUserWithSecureFields({
        name,
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
      setAuthCookie(reply, req, token)
      return { user: publicUser(user) }
    } catch (err) {
      if (String(err?.code) === 'P2002' || String(err?.message ?? '').includes('Unique constraint failed')) {
        return reply.code(409).send({ error: 'Este número de telefone já está cadastrado' })
      }
      throw err
    }
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
    setAuthCookie(reply, req, token)
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
