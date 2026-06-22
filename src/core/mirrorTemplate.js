import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'
import { buildScrapedOffer as defaultBuildScrapedOffer } from '../converters/offerEngine.js'

const UNRESOLVED_OFFER_PLACEHOLDER_RE = /\{(?:produto|preço|preço_de|desconto|rating|vendas|link|loja)\}/g
const PLATFORM_LABELS = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  magazineluiza: 'Magazine Luiza',
}

function parseTemplateStore(json) {
  try {
    return JSON.parse(json || '{}')
  } catch {
    return {}
  }
}

function stripUnresolvedPlaceholders(text = '') {
  return String(text || '')
    .replace(UNRESOLVED_OFFER_PLACEHOLDER_RE, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\*\s*\*/g, '')
    .replace(/~\s*~/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^\s*(?:💰|💥|👉|🛒)?\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function resolveMirrorTemplateBody(botConfig, templateKey) {
  const key = String(templateKey || '').trim()
  if (!key) return null
  const templates = composeTemplates(parseTemplateStore(botConfig?.mobileTemplatesJson))
  return templates.find((template) => template.key === key)?.body || null
}

function buildAlreadyConvertedConverter({ platform, originalUrl, convertedUrl }) {
  return async (requestedPlatform, requestedUrl) => {
    if (!convertedUrl || !originalUrl || convertedUrl === originalUrl) return null
    if (platform && requestedPlatform && platform !== requestedPlatform) return null
    if (requestedUrl !== originalUrl) return null
    return { url: convertedUrl, warning: null }
  }
}

export async function resolveMirrorOfferFromLink({
  originalUrl = '',
  convertedUrl = '',
  platform = null,
  credentialsMap = {},
  buildOffer = defaultBuildScrapedOffer,
  logger = null,
} = {}) {
  const sourceUrl = String(originalUrl || convertedUrl || '').trim()
  const displayUrl = String(convertedUrl || originalUrl || '').trim()
  if (!sourceUrl || !displayUrl) return null

  const offer = await buildOffer({
    url: sourceUrl,
    platform,
    credentialsMap,
    keepOriginalLink: false,
    convertLink: buildAlreadyConvertedConverter({ platform, originalUrl: sourceUrl, convertedUrl: displayUrl }),
    logger,
  })

  return {
    title: offer?.title || '',
    oldPrice: offer?.oldPrice || '',
    price: offer?.newPrice || '',
    // O scraper pode devolver finalUrl/displayUrl canônico sem tag. No espelhamento,
    // o link que deve sair no template é sempre o convertido já aprovado pelo pipeline.
    link: displayUrl,
    storeName: PLATFORM_LABELS[platform] || platform || '',
  }
}

export async function applyMirrorTemplate(text, {
  botConfig = {},
  templateKey = '',
  originalUrl = '',
  convertedUrl = '',
  platform = null,
  credentialsMap = {},
  buildOffer = defaultBuildScrapedOffer,
  logger = null,
} = {}) {
  const body = resolveMirrorTemplateBody(botConfig, templateKey)
  if (!body) return text
  let fields
  try {
    fields = await resolveMirrorOfferFromLink({ originalUrl, convertedUrl, platform, credentialsMap, buildOffer, logger })
  } catch (err) {
    logger?.warn?.({ err: err?.message, originalUrl, convertedUrl, platform }, 'Template de espelhamento: falha ao buscar dados pelo link; mantendo texto original')
    return text
  }
  if (!fields?.link) return text
  const rendered = buildMobileOfferText({
    product: fields,
    link: fields.link,
    template: templateKey,
    templateBody: body,
    bonusMode: botConfig?.brandingGroupLink ? 'group' : '',
    groupBonus: {
      link: botConfig?.brandingGroupLink || '',
      cta: botConfig?.brandingCtaText || '',
    },
    preserveAutomationPlaceholders: false,
  })
  return stripUnresolvedPlaceholders(rendered) || text
}
