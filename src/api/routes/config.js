import db from '../../db.js'
import { reloadConfig } from '../../manager.js'
import { DEFAULT_BRANDING_CTA_TEXT, MAX_BRANDING_CTA_CHARS, normalizeBrandingCtaText, normalizeBrandingLink } from '../../messageProcessor.js'
import { buildFeatureGateError, canUseAdvancedPreservation, FEATURE_CODES } from '../../billing/plans.js'

const DEFAULT_COPY_VARIATION_POOL = {
  greetings: [
    '🚨 COOOOOORRE QUE TÁ ACABANDO!',
    '💡 UTILIDADE PÚBLICA!!',
    '😱 TÁ BARATOOO DEMAIS!',
    '🍌 PREÇO DE BANANA!!',
    '🔥 PARA TUDO E OLHA ISSO!',
    '💸 O GERENTE ENLOUQUECEU!!',
    '⚡ OFERTA RELÂMPAGO, CLICA JÁ!',
    '🎁 QUASE DE GRAÇA, SÉRIO!!',
    '💎 ACHADO DE MILHÕES!!',
    '🏃 VOLTOU PRO ESTOQUE, VOA!',
    '💥 CHOCADO COM ESSE VALOR!',
    '🤑 SÓ QUEM FOR RÁPIDO VAI PEGAR!',
  ],
  ctas: [
    '📲 Entre no nosso grupo oficial:',
    '👥 Vem pro grupo economizar com a gente:',
    '👇 Clique aqui e faça parte do nosso grupo VIP:',
    '🤫 Acesse nosso grupo secreto de ofertas:',
    '🚀 Receba os melhores achadinhos direto no grupo:',
    '🔔 Quer ver as promoções primeiro? Entre no grupo:',
    '💥 Não perca nenhum bug! Faça parte do grupo:',
    '🛒 Garanta os melhores descontos entrando no grupo:',
    '🤝 Junte-se à nossa comunidade de achadinhos:',
    '👀 Para não perder nadinha, vem pro grupo:',
  ],
  trailers: [
    '⚠️ Atenção: Preços e estoque podem mudar a qualquer momento!',
    '🚨 O valor promocional e a disponibilidade dependem do estoque da loja.',
    '⏳ Corra! Oferta por tempo limitado ou até durarem os estoques.',
    '📝 Preço sujeito a alteração e produto sujeito a esgotar sem aviso prévio.',
    '🏃💨 Garanta logo, porque o estoque voa e o preço pode subir rapidinho!',
    '🔔 Aviso: A loja parceira pode alterar o valor ou encerrar a oferta a qualquer minuto.',
    '🛒 Unidades promocionais limitadas! Preço sujeito a reajuste no site.',
    '📉 Desconto válido por tempo limitado, sujeito a alteração e fim de estoque.',
    'ℹ️ Os preços e a disponibilidade do produto são de responsabilidade total da loja.',
    '💥 Aproveite rápido: Estoques limitados e valores sujeitos a alteração.',
  ],
}
export const DEFAULT_COPY_VARIATION_POOL_JSON = JSON.stringify(DEFAULT_COPY_VARIATION_POOL)

const DEFAULTS = {
  delayMin: 5,
  delayMax: 15,
  platforms: 'shopee,amazon,mercadolivre,magazineluiza',
  blockedKeywords: '',
  welcomeMsg: '',
  feedGlobal: false,
  postToStatus: false,
  brandingGroupLink: '',
  brandingCtaText: DEFAULT_BRANDING_CTA_TEXT,
  copyVariationPoolJson: DEFAULT_COPY_VARIATION_POOL_JSON,
}


async function getPlanSubject(userId) {
  return db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
}

async function ensureAdvancedPreservationAllowed(userId, reply) {
  const user = await getPlanSubject(userId)
  if (canUseAdvancedPreservation(user ?? { plan: 'basic' })) return true
  reply.code(403).send(buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION))
  return false
}

function isIntegerInRange(value) {
  return Number.isInteger(value) && value >= 0 && value <= 300
}

export async function configRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    if (!cfg) return { ...DEFAULTS, userId: req.user.sub }
    const poolJson = cfg.copyVariationPoolJson
    const effectivePoolJson = !poolJson || poolJson === '{}' ? DEFAULT_COPY_VARIATION_POOL_JSON : poolJson
    return { ...cfg, copyVariationPoolJson: effectivePoolJson }
  })

  app.put('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { delayMin, delayMax, platforms, blockedKeywords, welcomeMsg, feedGlobal, postToStatus, brandingGroupLink, brandingCtaText, copyVariationPoolJson } = req.body ?? {}

    if (delayMin !== undefined && !isIntegerInRange(delayMin)) {
      return reply.code(400).send({ error: 'delayMin deve ser um número inteiro entre 0 e 300' })
    }
    if (delayMax !== undefined && !isIntegerInRange(delayMax)) {
      return reply.code(400).send({ error: 'delayMax deve ser um número inteiro entre 0 e 300' })
    }
    if (feedGlobal !== undefined && typeof feedGlobal !== 'boolean') {
      return reply.code(400).send({ error: 'feedGlobal deve ser boolean' })
    }
    if (postToStatus !== undefined && typeof postToStatus !== 'boolean') {
      return reply.code(400).send({ error: 'postToStatus deve ser boolean' })
    }

    if (copyVariationPoolJson !== undefined) {
      if (typeof copyVariationPoolJson !== 'string') {
        return reply.code(400).send({ error: 'copyVariationPoolJson deve ser string JSON' })
      }
      try { JSON.parse(copyVariationPoolJson) } catch {
        return reply.code(400).send({ error: 'copyVariationPoolJson contém JSON inválido' })
      }
    }

    const requestsAdvancedPreservation = feedGlobal === true || postToStatus === true
    if (requestsAdvancedPreservation && !(await ensureAdvancedPreservationAllowed(userId, reply))) return
    const rawBrandingGroupLink = String(brandingGroupLink ?? '').trim()
    const normalizedBrandingGroupLink = normalizeBrandingLink(rawBrandingGroupLink)
    if (brandingGroupLink !== undefined && rawBrandingGroupLink && !normalizedBrandingGroupLink) {
      return reply.code(400).send({ error: 'Informe um link válido começando com http:// ou https://' })
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
        feedGlobal: feedGlobal ?? DEFAULTS.feedGlobal,
        postToStatus: postToStatus ?? DEFAULTS.postToStatus,
        brandingGroupLink: normalizedBrandingGroupLink,
        brandingCtaText: normalizedBrandingCtaText,
        ...(copyVariationPoolJson !== undefined && { copyVariationPoolJson }),
      },
      update: {
        ...(delayMin !== undefined && { delayMin }),
        ...(delayMax !== undefined && { delayMax }),
        ...(platforms !== undefined && { platforms }),
        ...(blockedKeywords !== undefined && { blockedKeywords }),
        ...(welcomeMsg !== undefined && { welcomeMsg }),
        ...(feedGlobal !== undefined && { feedGlobal }),
        ...(postToStatus !== undefined && { postToStatus }),
        ...(brandingGroupLink !== undefined && { brandingGroupLink: normalizedBrandingGroupLink }),
        ...(brandingCtaText !== undefined && { brandingCtaText: normalizedBrandingCtaText }),
        ...(copyVariationPoolJson !== undefined && { copyVariationPoolJson }),
      },
    })
    reloadConfig(userId)
    return cfg
  })
}
