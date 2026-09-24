import bcrypt from 'bcryptjs'
import { randomBytes, createHash, randomUUID } from 'crypto'
import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { normalizeEmail } from '../auth-utils.js'
import { DEFAULT_COPY_VARIATION_POOL_JSON } from '../../core/copyVariation.js'
import { notifyWelcome, notifyReferralSignup, notifyPasswordReset } from '../../emailTriggers/events.js'
import { signPasswordResetToken, verifyPasswordResetToken, peekPasswordResetUserId, DEFAULT_TTL_MS as PASSWORD_RESET_TTL_MS } from '../../auth/passwordResetToken.js'
import { attachAffiliateAttributionTouchesToUser, attachOrphanTouchesByDevice, recordAffiliateAttributionTouch } from '../../domain/affiliate/service.js'
import { DEFAULT_TERMS_VERSION, getEffectiveTermsVersion } from '../../legalTerms.js'
import { isRealEmail } from '../../leadNurture/policy.js'
import { isUnsubscribed } from '../../leadNurture/sweep.js'
import { checkDuplicateTrialAtSignup } from '../../domain/signup/duplicateTrialAlert.js'
// O celular do cadastro precisa do código do país para ser discável — ver
// src/domain/signup/contactPhone.js para o porquê e a regra por comprimento.
import { normalizeContactPhone } from '../../domain/signup/contactPhone.js'
import { isReservedAdminEmail } from '../../auth/reservedAdminEmails.js'
import { passwordVersion } from '../../auth/sessionVersion.js'

// Hash descartável usado só para igualar o custo de tempo do bcrypt.compare
// no caminho "usuário não existe". Sem ele, login com e-mail inexistente
// retorna ~instantâneo enquanto e-mail válido + senha errada paga o custo do
// bcrypt — diferença de timing que permite enumerar e-mails cadastrados.
const TIMING_SAFE_DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', 10)

// US2 (specs/010-seo-lead-capture): mesma regra de sanitização de
// `dashboard/lib/marketing-attribution.js` (sanitizeAttributionValue), reimplementada aqui
// porque backend (src/) e dashboard (dashboard/) são árvores/pacotes separados sem import
// compartilhado. Usada só para `landingPage` -> `landing_page` na metadata do evento
// `signup_created` (sem migration; FR-014).
const ATTRIBUTION_UNSAFE_VALUE_RE = /[^\p{L}\p{N}._~:@/-]/gu
export function sanitizeAttributionValue(value, maxLength = 500) {
  if (value === undefined || value === null) return ''
  return String(value)
    .trim()
    .replace(ATTRIBUTION_UNSAFE_VALUE_RE, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength)
}

// A-1 (anti brute-force): dois mapas de tentativas. `loginAttempts` é por
// (email|ip) — pega o caso comum de força bruta de um IP. `loginAttemptsByEmail`
// é só por email — pega ataque DISTRIBUÍDO (mesma conta atacada de vários IPs),
// que o limite por IP e o rate limit global do servidor não cobririam.
const loginAttempts = new Map()
const loginAttemptsByEmail = new Map()

// Balde SEPARADO para "esqueci minha senha" (RCA 2026-09).
//
// Antes esta rota consumia o MESMO balde do login — e é justamente quem errou a
// senha várias vezes que vai pedir a recuperação. Oito tentativas de entrar
// queimavam o orçamento inteiro, e o clique em "esqueci minha senha" logo em
// seguida devolvia 429 em vez de mandar o e-mail: a recuperação ficava
// indisponível exatamente para quem precisa dela. O limite continua existindo
// (a rota não pode virar varredura de e-mails), só que com contagem própria.
const passwordResetAttempts = new Map()
const passwordResetAttemptsByEmail = new Map()
export const STANDARD_TRIAL_DAYS = 7
export const PROMO_VIP_TRIAL_DAYS = 7
export const TERMS_VERSION = DEFAULT_TERMS_VERSION

function getLoginAttemptMaxEntries() {
  const value = Number(process.env.LOGIN_RATE_LIMIT_MAX_ENTRIES ?? 20000)
  return Number.isFinite(value) && value > 100 ? Math.trunc(value) : 20000
}

function pruneMap(map, now, maxEntries) {
  for (const [key, value] of map.entries()) {
    if (!value || now > value.resetAt) map.delete(key)
  }
  if (map.size <= maxEntries) return
  const overflow = map.size - maxEntries
  let dropped = 0
  for (const key of map.keys()) {
    map.delete(key)
    dropped += 1
    if (dropped >= overflow) break
  }
}

function pruneLoginAttempts(now = Date.now()) {
  const maxEntries = getLoginAttemptMaxEntries()
  pruneMap(loginAttempts, now, maxEntries)
  pruneMap(loginAttemptsByEmail, now, maxEntries)
  pruneMap(passwordResetAttempts, now, maxEntries)
  pruneMap(passwordResetAttemptsByEmail, now, maxEntries)
}

// Limpeza periódica: sem isso, uma chave só some na próxima requisição que a
// toca — chaves de ataques que param ficam retidas até o cap de entradas.
let loginAttemptsCleanupTimer = null
export function startLoginAttemptsCleanup() {
  if (loginAttemptsCleanupTimer) return loginAttemptsCleanupTimer
  loginAttemptsCleanupTimer = setInterval(() => pruneLoginAttempts(), 5 * 60_000)
  loginAttemptsCleanupTimer.unref?.()
  return loginAttemptsCleanupTimer
}


function setAuthCookie(reply, token, req) {
  const secureOverride = process.env.COOKIE_SECURE
  const requestProtocol = String(req?.protocol ?? '').toLowerCase()
  const secure = secureOverride === 'true' || (secureOverride !== 'false' && requestProtocol === 'https')
  const maxAge = 60 * 60 * 24 * 7
  const sameSite = String(process.env.COOKIE_SAMESITE ?? (secure ? 'Strict' : 'Lax')).trim()
  const cookieDomain = String(process.env.COOKIE_DOMAIN ?? '').trim()
  const parts = [
    `wb_auth=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${maxAge}`,
  ]
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`)
  if (secure) parts.push('Secure')
  reply.header('Set-Cookie', parts.join('; '))
}

function normalizeName(rawName) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ')
  return name || null
}

function randomToken(size = 8) {
  return randomBytes(size).toString('hex')
}

// Identificador de auditoria sem PII: hash curto do email. Permite correlacionar
// tentativas contra a mesma conta (ataque distribuído) nos logs de analytics sem
// gravar o email em claro — o sanitizador já removeria a chave `email` mesmo.
function accountAuditId(email) {
  return createHash('sha256').update(String(email ?? '')).digest('hex').slice(0, 12)
}

function generateFallbackEmail() {
  return `user_${randomToken(6)}@sistema.com`
}

function bumpAttempt(map, key, windowMs, now) {
  const existing = map.get(key)
  const item = !existing || now > existing.resetAt ? { attempts: 0, resetAt: now + windowMs } : existing
  item.attempts += 1
  map.set(key, item)
  return item
}

function consumeAttempt({ email, ip, byIp, byEmail, windowMs, maxAttempts, emailMaxAttempts }) {
  const ipKey = `${email}|${ip ?? 'unknown'}`
  const now = Date.now()
  pruneLoginAttempts(now)

  const ipItem = bumpAttempt(byIp, ipKey, windowMs, now)
  const emailItem = bumpAttempt(byEmail, email, windowMs, now)

  const ipBlocked = ipItem.attempts > maxAttempts
  const emailBlocked = emailItem.attempts > emailMaxAttempts
  // resetAt reportado é o do escopo que efetivamente bloqueou (o maior, se ambos).
  const resetAt = emailBlocked && !ipBlocked ? emailItem.resetAt
    : ipBlocked && !emailBlocked ? ipItem.resetAt
    : Math.max(ipItem.resetAt, emailItem.resetAt)
  return {
    blocked: ipBlocked || emailBlocked,
    blockedScope: emailBlocked && !ipBlocked ? 'email' : ipBlocked ? 'ip' : null,
    resetAt,
    attempts: ipItem.attempts,
    emailAttempts: emailItem.attempts,
  }
}

export function consumeLoginAttempt({ email, ip }) {
  return consumeAttempt({
    email,
    ip,
    byIp: loginAttempts,
    byEmail: loginAttemptsByEmail,
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    maxAttempts: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 8),
    emailMaxAttempts: Number(process.env.LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS ?? 8),
  })
}

// Pedido de link de nova senha. Balde próprio (ver comentário lá em cima) e
// teto mais folgado: cada pedido é uma ação deliberada da pessoa, e o custo de
// um pedido a mais é um e-mail — bem menor que o de trancar quem perdeu a senha
// para fora da conta.
export function consumePasswordResetAttempt({ email, ip }) {
  return consumeAttempt({
    email,
    ip,
    byIp: passwordResetAttempts,
    byEmail: passwordResetAttemptsByEmail,
    windowMs: Number(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000),
    maxAttempts: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS ?? 5),
    emailMaxAttempts: Number(process.env.PASSWORD_RESET_RATE_LIMIT_EMAIL_MAX_ATTEMPTS ?? 5),
  })
}

export function clearLoginAttempts({ email, ip }) {
  loginAttempts.delete(`${email}|${ip ?? 'unknown'}`)
  loginAttemptsByEmail.delete(email)
  passwordResetAttempts.delete(`${email}|${ip ?? 'unknown'}`)
  passwordResetAttemptsByEmail.delete(email)
}

function isPrismaShapeMismatch(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('no such column') || message.includes('does not exist in the current database')
}

function resolveJwtSecretForReset() {
  return process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || process.env.JWT_TOKEN || null
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

async function createDefaultBotConfigForUser(userId) {
  try {
    await db.botConfig.create({
      data: { userId, copyVariationPoolJson: DEFAULT_COPY_VARIATION_POOL_JSON },
    })
  } catch (err) {
    if (String(err?.code) === 'P2002' || isPrismaShapeMismatch(err)) return
    throw err
  }
}

async function createUserWithSecureFields(data) {
  try {
    return await db.user.create({ data })
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    const { contactPhone, contactPhoneOptInAt, status, lastLoginAt, lastActivityAt, supportStatus, name, termsAcceptedAt, termsVersion, termsAcceptedIp, termsAcceptedUserAgent, ...legacyData } = data
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


/**
 * Dispara o e-mail de nova senha para um endereço. Caminho ÚNICO: usado pela
 * rota /forgot-password e pelo botão da tela de conexão recusada
 * (POST /session/blocked-recover), que precisa mandar o link para a conta
 * ANTERIOR sem nunca expor aquele endereço ao navegador.
 *
 * Nunca lança e nunca revela se a conta existe — quem chama responde sempre a
 * mesma coisa.
 */
export async function requestPasswordResetForEmail({ email, logger } = {}) {
  const alvo = normalizeEmail(email)
  if (!alvo) return { sent: false }
  const user = await findUserByNormalizedEmail(alvo).catch(() => null)
  if (!user || user.status === 'banned' || user.status === 'suspended' || String(user.email).endsWith('@sistema.com')) {
    return { sent: false }
  }
  const secret = resolveJwtSecretForReset()
  if (!secret) return { sent: false }

  const token = signPasswordResetToken({ userId: user.id, passwordHash: user.passwordHash, secret })
  const dashboardUrl = String(process.env.DASHBOARD_URL || process.env.API_URL || 'https://espelhagrupos.com.br').replace(/\/+$/, '')
  notifyPasswordReset({
    db,
    user,
    resetUrl: `${dashboardUrl}/nova-senha?c=${encodeURIComponent(token)}`,
    validity: `${Math.round(PASSWORD_RESET_TTL_MS / 60000)} minutos`,
    logger,
  }).catch(() => {})
  trackAnalyticsEventSafe({ userId: user.id, event: 'password_reset_requested' })
  return { sent: true }
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
    // Mostrado para a cliente no painel. Sem isto, conta com acesso encerrado
    // só via a tela normal de plano vencido e não tinha como saber que a
    // decisão foi nossa nem por quê.
    blockedReason: true,
    blockedAt: true,
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
    const {
      name: rawName,
      email: rawEmail,
      password: rawPassword,
      contactPhone: rawContactPhone,
      ref,
      source,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      conversion_prompt_id: conversionPromptId,
      conversion_prompt_variant: conversionPromptVariant,
      landingPage: rawLandingPage,
      gclid: rawGclid,
      coupon_code: couponCode,
      aff_code: rawAffCode,
      affiliateVisitorId: rawAffiliateVisitorId,
      termsAccepted,
      termsVersion: rawTermsVersion,
    } = req.body ?? {}
    const name = normalizeName(rawName)
    const providedEmail = normalizeEmail(rawEmail)
    const email = providedEmail || generateFallbackEmail()
    const isPromoVipFlow = source === 'promo_vip_7dias' && couponCode === 'VIP7DIAS'
    // Celular é OBRIGATÓRIO no cadastro — decisão de produto, não descuido.
    // A auditoria de funil (2026-08-05, §3.4) propôs torná-lo opcional pela
    // regra genérica de "menos campo, mais conversão", e a proposta foi
    // REVERTIDA a pedido da dona do produto: o contato é o que viabiliza
    // procurar a cliente quando ela trava na configuração — que é justamente
    // onde o teste de 7 dias morre. Trocar um contato certo por um cadastro a
    // mais é troca ruim neste estágio, em que o suporte próximo é o
    // diferencial. NÃO tornar opcional de novo sem pedido explícito dela.
    const normalizedPhone = normalizeContactPhone(rawContactPhone)
    const contactPhone = normalizedPhone
    const hasPassword = typeof rawPassword === 'string' && rawPassword.trim().length > 0
    const password = hasPassword ? String(rawPassword) : ''
    // Ausência MUST NOT bloquear o cadastro (FR-005) — string vazia é o fallback.
    const landingPage = sanitizeAttributionValue(rawLandingPage)
    // Identificador de clique do Google Ads. Sanitização própria: o
    // `sanitizeAttributionValue` troca `_` por `-`, e `_` é caractere válido
    // dentro de um gclid — usá-lo aqui corromperia o valor em silêncio e a
    // importação de conversão offline falharia sem erro visível.
    const gclid = /^[A-Za-z0-9_-]{1,200}$/.test(String(rawGclid ?? '').trim())
      ? String(rawGclid).trim()
      : ''

    if (!name || !contactPhone) return reply.code(400).send({ error: 'nome e celular obrigatórios' })
    if (termsAccepted !== true) return reply.code(400).send({ error: 'Aceite os Termos de Uso e ciência de riscos para criar a conta' })
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Formato de email inválido' })
    if (!hasPassword) return reply.code(400).send({ error: 'Senha obrigatória' })
    if (password.length < 8) return reply.code(400).send({ error: 'Senha deve ter no mínimo 8 caracteres' })

    const [existingEmail] = await Promise.all([
      findUserByNormalizedEmail(email),
      ensureUniqueContactPhone(contactPhone),
    ])
    if (existingEmail) return reply.code(409).send({ error: 'Email já cadastrado' })
    // E-mail reservado ao admin responde igual a e-mail já usado: a resposta não
    // pode virar um jeito de descobrir quais endereços dão acesso de dona.
    if (isReservedAdminEmail(email)) return reply.code(409).send({ error: 'Email já cadastrado' })

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date()
    const trialDays = isPromoVipFlow ? PROMO_VIP_TRIAL_DAYS : STANDARD_TRIAL_DAYS
    const accessExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
    const acceptedTermsVersion = await getEffectiveTermsVersion(db).catch(() => (typeof rawTermsVersion === 'string' && rawTermsVersion.trim() ? rawTermsVersion.trim().slice(0, 120) : TERMS_VERSION))
    const referralCode = randomBytes(4).toString('hex')

    let referrer = null
    if (ref) {
      const found = await db.user.findUnique({ where: { referralCode: ref } }).catch(() => null)
      if (found) {
        const useCount = await db.user.count({ where: { referredBy: found.id } })
        if (useCount < 20) referrer = found
      }
    }

    const aff_code = typeof rawAffCode === 'string' ? rawAffCode.trim().toUpperCase() : ''
    const affiliateVisitorId = typeof rawAffiliateVisitorId === 'string' ? rawAffiliateVisitorId.trim().slice(0, 120) : ''
    let affiliateProfileId = undefined
    let affiliateCodeForTouch = null
    let affiliateOwnerUserId = null
    if (aff_code) {
      try {
        const affProfile = await db.affiliateProfile.findUnique({ where: { code: aff_code } })
        if (affProfile?.status === 'approved') {
          affiliateProfileId = affProfile.id
          affiliateCodeForTouch = affProfile.code
          affiliateOwnerUserId = affProfile.userId
        }
      } catch {}
    }

    let user
    try {
      user = await createUserWithSecureFields({
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
        termsAcceptedAt: now,
        termsVersion: acceptedTermsVersion,
        termsAcceptedIp: String(req.ip ?? '').slice(0, 80) || null,
        termsAcceptedUserAgent: String(req.headers?.['user-agent'] ?? '').slice(0, 500) || null,
        ...(affiliateProfileId && { affiliateProfileId }),
      })
    } catch (err) {
      if (String(err?.code) === 'P2002' || String(err?.message ?? '').includes('Unique constraint failed')) {
        return reply.code(409).send({ error: 'Este número de telefone já está cadastrado' })
      }
      throw err
    }

    // A conta já está criada e commitada no banco. A partir daqui NENHUM passo
    // auxiliar pode transformar um cadastro bem-sucedido em erro: se a rota
    // retornasse 500 aqui, o frontend mostraria "falha", a pessoa acharia que
    // não se cadastrou, tentaria de novo e bateria em "telefone já cadastrado"
    // (era exatamente o loop observado em produção). Tudo abaixo é best-effort;
    // o cadastro sempre devolve token e loga a pessoa.
    try {
      await createDefaultBotConfigForUser(user.id)
    } catch (err) {
      req.log?.warn?.({ err, userId: user.id }, 'register: falha ao criar botConfig default (best-effort)')
    }

    if (affiliateProfileId) {
      try {
        await recordAffiliateAttributionTouch({
          affiliateId: affiliateProfileId,
          affiliateCode: affiliateCodeForTouch ?? aff_code,
          userId: user.id,
          visitorId: affiliateVisitorId || null,
          source: source || utmSource || 'affiliate',
          medium: utmMedium || null,
          campaign: utmCampaign || null,
          ipHash: accountAuditId(req.ip),
          uaHash: accountAuditId(req.headers?.['user-agent']),
          db,
        })
        if (affiliateVisitorId) {
          await attachAffiliateAttributionTouchesToUser({ visitorId: affiliateVisitorId, userId: user.id, affiliateId: affiliateProfileId, db })
        } else {
          // O3: sem visitorId no body, casa touches anônimos do mesmo dispositivo.
          await attachOrphanTouchesByDevice({ affiliateId: affiliateProfileId, ipHash: accountAuditId(req.ip), uaHash: accountAuditId(req.headers?.['user-agent']), userId: user.id, db })
        }
      } catch (err) {
        req.log?.warn?.({ err, userId: user.id, affiliateProfileId }, 'register: falha ao gravar touch de afiliado (best-effort)')
      }
    }

    if (referrer) {
      try {
        const base = referrer.accessExpiresAt && referrer.accessExpiresAt > new Date()
          ? referrer.accessExpiresAt.getTime()
          : Date.now()
        await db.user.update({
          where: { id: referrer.id },
          data: { accessExpiresAt: new Date(base + 7 * 24 * 60 * 60 * 1000) },
        })
      } catch (err) {
        req.log?.warn?.({ err, referrerId: referrer.id }, 'register: falha ao creditar bônus de indicação (best-effort)')
      }
    }

    trackAnalyticsEventSafe({
      userId: user.id,
      event: 'signup_created',
      metadata: {
        source: source || utmSource || (affiliateProfileId ? 'affiliate' : 'direct'),
        ref: ref || null,
        aff_code: affiliateProfileId ? aff_code : null,
        promo: isPromoVipFlow ? 'vip7dias' : 'none',
        utm_source: utmSource || source || (affiliateProfileId ? 'affiliate' : 'direct'),
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        utm_content: utmContent || null,
        utm_term: utmTerm || null,
        landing_page: landingPage,
        gclid: gclid || null,
        conversion_prompt_id: conversionPromptId || null,
        conversion_prompt_variant: conversionPromptVariant || null,
        terms_version: acceptedTermsVersion,
      },
    })
    // Esta conta parece repetir o teste de outra? Só AVISA (log + sinal +
    // e-mail interno) — nunca bloqueia o cadastro. Ver
    // src/domain/signup/duplicateTrialSignal.js para o porquê da regra e das
    // invariantes. Best-effort: falha aqui não pode custar uma cliente.
    checkDuplicateTrialAtSignup({
      db,
      user,
      trackEvent: trackAnalyticsEventSafe,
      logger: req.log,
    }).catch(err => {
      req.log?.warn?.({ err, userId: user.id }, 'register: falha ao checar teste repetido (best-effort)')
    })

    // E-mail de boas-vindas: fire-and-forget, só para e-mails reais
    // informados pelo usuário (não para o fallback user_*@sistema.com).
    // No-op quando SMTP não está configurado; nunca derruba o signup.
    if (providedEmail) {
      // Passa pelo motor de e-mails (catálogo + travas + histórico) em vez do
      // builder antigo: assim a admin edita este texto pela aba E-mails.
      notifyWelcome({ db, user, trialEndsAt: user.accessExpiresAt, logger: req.log }).catch(() => {})
    }

    // Quem indicou merece saber na hora — tanto pelo link antigo de indicação
    // quanto pelo programa de afiliadas. Best-effort, nunca derruba o cadastro.
    for (const indicadoraId of new Set([referrer?.id, affiliateOwnerUserId].filter(Boolean))) {
      notifyReferralSignup({ db, referrerUserId: indicadoraId, logger: req.log }).catch(() => {})
    }

    // Trilha de nutrição de leads (011-lead-nurture-emails, D4): o welcome
    // acima cobre o passo dia 0 — semeamos o evento para que a passada
    // diária (sweep.js) não reenvie o dia 0 e comece direto no passo 2.
    // Condicionado a !isUnsubscribed para não reabrir a trilha de um contato
    // já descadastrado (US2 cenário 3) — best-effort, nunca derruba o signup.
    if (providedEmail && isRealEmail(providedEmail)) {
      isUnsubscribed({ db, userId: user.id })
        .then((unsub) => {
          if (unsub) return
          return db.analyticsEvent.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              event: 'nurture_email_sent',
              metadata: JSON.stringify({ step: 0 }),
              createdAt: new Date(),
            },
          })
        })
        .catch((err) => {
          req.log?.warn?.({ err, userId: user.id }, 'register: falha ao semear passo 0 da trilha de nutrição (best-effort)')
        })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email, jti: randomToken(12), pv: passwordVersion(passwordHash) }, { expiresIn: '7d' })
    setAuthCookie(reply, token, req)
    return { user: publicUser(user), token }
  })

  app.post('/login', async (req, reply) => {
    const { email: rawEmail, password } = req.body ?? {}
    const email = normalizeEmail(rawEmail)
    if (!email || !password) return reply.code(400).send({ error: 'email e password obrigatórios' })
    const attempt = consumeLoginAttempt({ email, ip: req.ip })
    if (attempt.blocked) {
      const retryAfter = Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1000))
      reply.header('Retry-After', String(retryAfter))
      trackAnalyticsEventSafe({
        event: 'login_blocked',
        metadata: { acct: accountAuditId(email), ip: req.ip, scope: attempt.blockedScope, attempts: attempt.attempts, emailAttempts: attempt.emailAttempts },
      })
      return reply.code(429).send({ error: 'Muitas tentativas. Tente novamente mais tarde.' })
    }

    const user = await findUserByNormalizedEmail(email)
    if (!user) {
      // Paga o mesmo custo de tempo do bcrypt.compare do caminho feliz para não
      // vazar, via timing, se o e-mail existe (anti-enumeration).
      await bcrypt.compare(password, TIMING_SAFE_DUMMY_HASH)
      trackAnalyticsEventSafe({ event: 'login_failed', metadata: { acct: accountAuditId(email), ip: req.ip, reason: 'no_user', attempts: attempt.attempts } })
      return reply.code(401).send({ error: 'Credenciais inválidas' })
    }
    if (user.status === 'banned' || user.status === 'suspended') {
      // O motivo escrito pela admin ganha do texto genérico: a pessoa merece
      // saber por que perdeu o acesso sem precisar abrir chamado.
      const motivo = String(user.blockedReason ?? '').trim()
      return reply.code(403).send({ error: motivo || 'Conta bloqueada. Entre em contato com o suporte.' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      trackAnalyticsEventSafe({ userId: user.id, event: 'login_failed', metadata: { acct: accountAuditId(email), ip: req.ip, reason: 'bad_password', attempts: attempt.attempts } })
      return reply.code(401).send({ error: 'Credenciais inválidas' })
    }
    clearLoginAttempts({ email, ip: req.ip })

    const updated = await updateLoginActivity(user)
    trackAnalyticsEventSafe({ userId: updated.id, event: 'login_completed' })

    const token = app.jwt.sign({ sub: updated.id, email: updated.email, jti: randomToken(12), pv: passwordVersion(user.passwordHash) }, { expiresIn: '7d' })
    setAuthCookie(reply, token, req)
    return { user: publicUser(updated), token }
  })

  app.post('/logout', async (req, reply) => {
    try {
      const cookieToken = String(req.headers?.cookie ?? '')
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith('wb_auth='))
        ?.slice('wb_auth='.length)
      if (cookieToken) {
        const decoded = app.jwt.verify(decodeURIComponent(cookieToken))
        app.revokeTokenJti?.(decoded?.jti, decoded?.exp)
      }
    } catch (err) {
      req.log.warn({ err: err?.message }, 'Falha ao revogar token no logout')
    }
    const sameSite = String(process.env.COOKIE_SAMESITE ?? 'Lax').trim()
    const cookieDomain = String(process.env.COOKIE_DOMAIN ?? '').trim()
    const parts = ['wb_auth=','Path=/','HttpOnly',`SameSite=${sameSite}`,'Max-Age=0']
    if (cookieDomain) parts.push(`Domain=${cookieDomain}`)
    reply.header('Set-Cookie', parts.join('; '))
    return { ok: true }
  })

  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    let user = await findCurrentUser(req.user.sub)
    if (!user.referralCode) {
      user = await ensureReferralCode(req.user.sub)
    }
    return user
  })

  // ---------------------------------------------------------------------
  // Esqueci minha senha. Sem isso, quem perdia a senha só voltava pelo
  // suporte — e a conta some do produto até alguém responder.
  //
  // O link é um token assinado que morre em 1h e vale UMA vez (a assinatura
  // inclui a impressão da senha atual: trocou a senha, todo link antigo cai).
  // Nenhuma tabela nova.
  // ---------------------------------------------------------------------
  app.post('/forgot-password', async (req, reply) => {
    const email = normalizeEmail(req.body?.email)
    // Resposta SEMPRE igual, exista ou não a conta: senão esta rota vira um
    // detector de "quem tem conta aqui".
    const respostaNeutra = {
      ok: true,
      message: 'Se existir uma conta com esse e-mail, enviamos o link para criar uma nova senha. Confira também a caixa de spam.',
    }
    if (!email) return reply.code(200).send(respostaNeutra)

    // Balde PRÓPRIO (não o do login): quem errou a senha várias vezes é
    // justamente quem vem pedir o link, e o balde compartilhado já vinha
    // vazio — a recuperação respondia 429 em vez de mandar o e-mail.
    const rate = consumePasswordResetAttempt({ email, ip: req.ip })
    if (rate.blocked) {
      reply.header('Retry-After', Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)))
      return reply.code(429).send({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' })
    }

    await requestPasswordResetForEmail({ email, logger: req.log })
    return reply.code(200).send(respostaNeutra)
  })

  app.post('/reset-password', async (req, reply) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : ''

    if (!password) return reply.code(400).send({ error: 'Escolha uma senha nova.' })
    if (password.length < 8) return reply.code(400).send({ error: 'A senha precisa ter pelo menos 8 caracteres.' })
    if (password.length > 200) return reply.code(400).send({ error: 'Essa senha é longa demais.' })
    if (confirmPassword && confirmPassword !== password) return reply.code(400).send({ error: 'As duas senhas não são iguais.' })

    const secret = resolveJwtSecretForReset()
    const userId = peekPasswordResetUserId(token)
    const linkInvalido = { error: 'Este link não vale mais. Peça um novo na tela de entrada — eles duram pouco tempo de propósito.' }
    if (!secret || !userId) return reply.code(400).send(linkInvalido)

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, passwordHash: true, status: true } })
    if (!user) return reply.code(400).send(linkInvalido)
    if (user.status === 'banned' || user.status === 'suspended') return reply.code(403).send({ error: 'Esta conta está bloqueada. Fale com o suporte.' })

    const check = verifyPasswordResetToken({ token, passwordHash: user.passwordHash, secret })
    if (!check.valid) return reply.code(400).send(linkInvalido)

    const passwordHash = await bcrypt.hash(password, 10)
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })
    // Redefinir a senha derruba todo login anterior (ver src/auth/sessionVersion.js).
    app.invalidateSessionVersion?.(user.id)
    clearLoginAttempts({ email: normalizeEmail(user.email), ip: req.ip })
    trackAnalyticsEventSafe({ userId: user.id, event: 'password_reset_completed' })

    const authToken = app.jwt.sign({ sub: user.id, email: user.email, jti: randomToken(12), pv: passwordVersion(passwordHash) }, { expiresIn: '7d' })
    setAuthCookie(reply, authToken, req)
    return { ok: true, token: authToken, message: 'Senha trocada! Já entramos com a sua conta.' }
  })

  // Troca de senha autenticada: exige a senha atual, valida a confirmação,
  // grava hash novo e renova a sessão atual com um token novo.
  app.patch('/me/password', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
    const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : ''

    if (!currentPassword) return reply.code(400).send({ error: 'Senha atual obrigatória' })
    if (!newPassword) return reply.code(400).send({ error: 'Nova senha obrigatória' })
    if (newPassword.length < 8) return reply.code(400).send({ error: 'Nova senha deve ter no mínimo 8 caracteres' })
    if (newPassword.length > 200) return reply.code(400).send({ error: 'Nova senha muito longa' })
    if (confirmPassword && confirmPassword !== newPassword) return reply.code(400).send({ error: 'Confirmação de senha não confere' })

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, email: true } })
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado' })

    const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!currentMatches) return reply.code(400).send({ error: 'Senha atual inválida' })

    const samePassword = await bcrypt.compare(newPassword, user.passwordHash)
    if (samePassword) return reply.code(400).send({ error: 'A nova senha precisa ser diferente da senha atual' })

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await db.user.update({ where: { id: userId }, data: { passwordHash } })
    app.invalidateSessionVersion?.(userId)

    if (req.user?.jti) app.revokeTokenJti?.(req.user.jti, req.user.exp)
    const token = app.jwt.sign({ sub: user.id, email: user.email, jti: randomToken(12), pv: passwordVersion(passwordHash) }, { expiresIn: '7d' })
    setAuthCookie(reply, token, req)
    trackAnalyticsEventSafe({ userId, event: 'account_password_updated' })
    return { ok: true, token }
  })

  // Minha conta (2026-09-23): a cliente corrige o próprio nome. Só o nome —
  // o celular de cadastro NÃO é editável aqui: ele é a trava contra teste
  // grátis repetido (número único por conta, ver register) e trocá-lo pela
  // tela liberaria o número para uma conta nova.
  app.patch('/me/name', { onRequest: [app.authenticate] }, async (req, reply) => {
    const name = normalizeName(req.body?.name)
    if (!name) return reply.code(400).send({ error: 'Escreva o seu nome.' })
    if ([...name].length > 100) return reply.code(400).send({ error: 'O nome pode ter no máximo 100 caracteres.' })
    await db.user.update({ where: { id: req.user.sub }, data: { name } })
    const updated = await findCurrentUser(req.user.sub)
    return publicUser(updated)
  })

  // Permite ao usuário trocar o e-mail da própria conta. Necessário porque o
  // `payer_email` da assinatura recorrente (Mercado Pago) vem daqui — contas
  // com e-mail fictício/fallback `@sistema.com` não conseguem assinar até
  // cadastrar um e-mail real (ver src/domain/payments/payerEmail.js). A
  // identidade da sessão usa `sub` (userId), não o e-mail, então trocar o
  // e-mail NÃO invalida o token atual.
  app.patch('/me/email', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const email = normalizeEmail(req.body?.email)
    if (!email) return reply.code(400).send({ error: 'E-mail obrigatório' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Formato de e-mail inválido' })
    if (email.endsWith('@sistema.com')) return reply.code(400).send({ error: 'Use um e-mail real — o domínio @sistema.com é reservado para contas sem e-mail.' })

    const existing = await findUserByNormalizedEmail(email)
    if (existing && existing.id !== userId) {
      return reply.code(409).send({ error: 'Este e-mail já está em uso por outra conta.' })
    }
    // Trocar a própria conta para um e-mail de dona do admin daria o painel
    // inteiro sem prova de posse do endereço (ver src/auth/reservedAdminEmails.js).
    // Só a própria conta que já tem o e-mail passa (reenviar o mesmo valor).
    if (isReservedAdminEmail(email) && existing?.id !== userId) {
      return reply.code(409).send({ error: 'Este e-mail já está em uso por outra conta.' })
    }

    try {
      await db.user.update({ where: { id: userId }, data: { email } })
    } catch (err) {
      if (String(err?.code) === 'P2002') return reply.code(409).send({ error: 'Este e-mail já está em uso por outra conta.' })
      throw err
    }

    trackAnalyticsEventSafe({ userId, event: 'account_email_updated' })
    const updated = await findCurrentUser(userId)
    return publicUser(updated)
  })
}

// Ativa a limpeza periódica assim que o módulo é importado (igual ao padrão de
// activityCacheCleanup em server.js). `unref()` garante que não segura o event loop.
startLoginAttemptsCleanup()

export function __debugLoginAttemptsSize() { return loginAttempts.size }
export function __debugLoginAttemptsByEmailSize() { return loginAttemptsByEmail.size }
