import dbDefault from '../../db.js'
import { reloadConfig } from '../../manager.js'
import { DEFAULT_BRANDING_CTA_TEXT, MAX_BRANDING_CTA_CHARS, normalizeBrandingCtaText, normalizeBrandingLink } from '../../messageProcessor.js'
import { buildFeatureGateError, canUseAdvancedPreservation, canUseCopyVariation, FEATURE_CODES } from '../../billing/plans.js'
import { DEFAULT_COPY_VARIATION_POOL_JSON, resolveCopyVariationPoolJson } from '../../core/copyVariation.js'
import { canonicalizeTemplateStoreJson } from '../../core/templateVariables.js'
export { DEFAULT_COPY_VARIATION_POOL_JSON } from '../../core/copyVariation.js'

const DEFAULTS = {
  delayMin: 5,
  delayMax: 15,
  platforms: 'shopee,amazon,mercadolivre,magazineluiza,shein,aliexpress',
  blockedKeywords: '',
  welcomeMsg: '',
  postToStatus: false,
  brandingGroupLink: '',
  couponLink: '',
  brandingCtaText: DEFAULT_BRANDING_CTA_TEXT,
  copyVariationPoolJson: DEFAULT_COPY_VARIATION_POOL_JSON,
  copyVariationEnabled: false,
  mobileTemplatesJson: '{}',
  mobileCouponLinksJson: '{}',
  mirrorTemplateKeyDefault: null,
  primaryLinkTargetDefault: 'first',
}


async function getPlanSubject(db, userId) {
  return db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
}

async function ensureAdvancedPreservationAllowed(db, userId, reply) {
  const user = await getPlanSubject(db, userId)
  if (canUseAdvancedPreservation(user ?? { plan: 'basic' })) return true
  reply.code(403).send(buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION))
  return false
}

function isIntegerInRange(value) {
  return Number.isInteger(value) && value >= 0 && value <= 300
}

export async function configRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    if (!cfg) return { ...DEFAULTS, userId: req.user.sub }
    return {
      ...cfg,
      copyVariationPoolJson: resolveCopyVariationPoolJson(cfg.copyVariationPoolJson),
      mobileTemplatesJson: canonicalizeTemplateStoreJson(cfg.mobileTemplatesJson ?? '{}'),
      mobileCouponLinksJson: cfg.mobileCouponLinksJson ?? '{}',
    }
  })

  app.put('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { delayMin, delayMax, platforms, blockedKeywords, welcomeMsg, postToStatus, brandingGroupLink, brandingCtaText, couponLink, copyVariationPoolJson, copyVariationEnabled, mobileTemplatesJson, mobileCouponLinksJson, mirrorTemplateKeyDefault, primaryLinkTargetDefault } = req.body ?? {}

    if (delayMin !== undefined && !isIntegerInRange(delayMin)) {
      return reply.code(400).send({ error: 'delayMin deve ser um número inteiro entre 0 e 300' })
    }
    if (delayMax !== undefined && !isIntegerInRange(delayMax)) {
      return reply.code(400).send({ error: 'delayMax deve ser um número inteiro entre 0 e 300' })
    }
    if (postToStatus !== undefined && typeof postToStatus !== 'boolean') {
      return reply.code(400).send({ error: 'postToStatus deve ser boolean' })
    }
    if (copyVariationEnabled !== undefined && typeof copyVariationEnabled !== 'boolean') {
      return reply.code(400).send({ error: 'copyVariationEnabled deve ser boolean' })
    }

    if (copyVariationPoolJson !== undefined) {
      if (typeof copyVariationPoolJson !== 'string') {
        return reply.code(400).send({ error: 'copyVariationPoolJson deve ser string JSON' })
      }
      try { JSON.parse(copyVariationPoolJson) } catch {
        return reply.code(400).send({ error: 'copyVariationPoolJson contém JSON inválido' })
      }
    }

    for (const [field, value] of [['mobileTemplatesJson', mobileTemplatesJson], ['mobileCouponLinksJson', mobileCouponLinksJson]]) {
      if (value === undefined) continue
      if (typeof value !== 'string') {
        return reply.code(400).send({ error: `${field} deve ser string JSON` })
      }
      if (value.length > 20_000) {
        return reply.code(400).send({ error: `${field} excede o tamanho máximo permitido` })
      }
      try { JSON.parse(value) } catch {
        return reply.code(400).send({ error: `${field} contém JSON inválido` })
      }
    }

    if (mirrorTemplateKeyDefault !== undefined && mirrorTemplateKeyDefault !== null && String(mirrorTemplateKeyDefault).trim() && !/^[A-Za-z0-9_-]{1,80}$/.test(String(mirrorTemplateKeyDefault).trim())) {
      return reply.code(400).send({ error: 'mirrorTemplateKeyDefault inválido' })
    }
    if (primaryLinkTargetDefault !== undefined && !['first', 'last'].includes(primaryLinkTargetDefault)) {
      return reply.code(400).send({ error: 'primaryLinkTargetDefault inválido' })
    }
    const normalizedMirrorTemplateKeyDefault = mirrorTemplateKeyDefault === undefined
      ? undefined
      : (String(mirrorTemplateKeyDefault ?? '').trim() || null)

    // Divisão Basic/PRO (2026-09-23): variação do texto é do PRO. Desligar e
    // editar as frases seguem liberados — só LIGAR exige o plano.
    if (copyVariationEnabled === true) {
      const subject = await getPlanSubject(db, userId)
      if (!canUseCopyVariation(subject ?? { plan: 'basic' })) {
        return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.COPY_VARIATION))
      }
    }

    const requestsAdvancedPreservation = postToStatus === true
    if (requestsAdvancedPreservation && !(await ensureAdvancedPreservationAllowed(db, userId, reply))) return
    const rawBrandingGroupLink = String(brandingGroupLink ?? '').trim()
    const normalizedBrandingGroupLink = normalizeBrandingLink(rawBrandingGroupLink)
    if (brandingGroupLink !== undefined && rawBrandingGroupLink && !normalizedBrandingGroupLink) {
      return reply.code(400).send({ error: 'Informe um link válido começando com http:// ou https://' })
    }
    const rawCouponLink = String(couponLink ?? '').trim()
    const normalizedCouponLink = normalizeBrandingLink(rawCouponLink)
    if (couponLink !== undefined && rawCouponLink && !normalizedCouponLink) {
      return reply.code(400).send({ error: 'Link de cupom inválido. Informe uma URL começando com http:// ou https://' })
    }
    const normalizedBrandingCtaText = normalizeBrandingCtaText(brandingCtaText)
    if (brandingCtaText !== undefined && String(brandingCtaText ?? '').trim().length > MAX_BRANDING_CTA_CHARS) {
      return reply.code(400).send({ error: `Texto do CTA deve ter no máximo ${MAX_BRANDING_CTA_CHARS} caracteres` })
    }

    const existing = await db.botConfig.findUnique({ where: { userId } })
    const nextDelayMin = delayMin ?? existing?.delayMin ?? DEFAULTS.delayMin
    const nextDelayMax = delayMax ?? existing?.delayMax ?? DEFAULTS.delayMax
    if (nextDelayMin > nextDelayMax) {
      return reply.code(400).send({ error: 'delayMin não pode ser maior que delayMax' })
    }

    const cfg = await db.botConfig.upsert({
      where: { userId },
      create: {
        userId,
        delayMin: delayMin ?? DEFAULTS.delayMin,
        delayMax: delayMax ?? DEFAULTS.delayMax,
        platforms: platforms ?? DEFAULTS.platforms,
        blockedKeywords: blockedKeywords ?? '',
        welcomeMsg: welcomeMsg ?? '',
        postToStatus: postToStatus ?? DEFAULTS.postToStatus,
        brandingGroupLink: normalizedBrandingGroupLink,
        brandingCtaText: normalizedBrandingCtaText,
        couponLink: normalizedCouponLink,
        copyVariationPoolJson: copyVariationPoolJson === undefined
          ? DEFAULTS.copyVariationPoolJson
          : resolveCopyVariationPoolJson(copyVariationPoolJson),
        copyVariationEnabled: copyVariationEnabled ?? DEFAULTS.copyVariationEnabled,
        ...(mobileTemplatesJson !== undefined && { mobileTemplatesJson: canonicalizeTemplateStoreJson(mobileTemplatesJson) }),
        ...(mobileCouponLinksJson !== undefined && { mobileCouponLinksJson }),
        ...(normalizedMirrorTemplateKeyDefault !== undefined && { mirrorTemplateKeyDefault: normalizedMirrorTemplateKeyDefault }),
        ...(primaryLinkTargetDefault !== undefined && { primaryLinkTargetDefault }),
      },
      update: {
        ...(delayMin !== undefined && { delayMin }),
        ...(delayMax !== undefined && { delayMax }),
        ...(platforms !== undefined && { platforms }),
        ...(blockedKeywords !== undefined && { blockedKeywords }),
        ...(welcomeMsg !== undefined && { welcomeMsg }),
        ...(postToStatus !== undefined && { postToStatus }),
        ...(brandingGroupLink !== undefined && { brandingGroupLink: normalizedBrandingGroupLink }),
        ...(brandingCtaText !== undefined && { brandingCtaText: normalizedBrandingCtaText }),
        ...(couponLink !== undefined && { couponLink: normalizedCouponLink }),
        ...(copyVariationPoolJson !== undefined && { copyVariationPoolJson: resolveCopyVariationPoolJson(copyVariationPoolJson) }),
        ...(copyVariationEnabled !== undefined && { copyVariationEnabled }),
        ...(mobileTemplatesJson !== undefined && { mobileTemplatesJson: canonicalizeTemplateStoreJson(mobileTemplatesJson) }),
        ...(mobileCouponLinksJson !== undefined && { mobileCouponLinksJson }),
        ...(normalizedMirrorTemplateKeyDefault !== undefined && { mirrorTemplateKeyDefault: normalizedMirrorTemplateKeyDefault }),
        ...(primaryLinkTargetDefault !== undefined && { primaryLinkTargetDefault }),
      },
    })
    reloadConfig(userId)
    return cfg
  })
}
