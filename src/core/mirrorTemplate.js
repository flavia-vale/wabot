import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'
import { buildScrapedOffer as defaultBuildScrapedOffer, withTimeout } from '../converters/offerEngine.js'

// Teto de tempo do scrape do modo template. O espelhamento roda numa fila
// serial com MSG_QUEUE_TIMEOUT_MS=25s por mensagem; o scrape do template
// (buildScrapedOffer -> fetchProductInfo, até 2x) NÃO pode consumir esse
// orçamento todo, senão uma loja lenta trava a fila inteira. Ao estourar,
// resolveMirrorOfferFromLink lança e applyMirrorTemplate cai no relay (texto
// original). Override via env MIRROR_TEMPLATE_SCRAPE_BUDGET_MS.
const MIRROR_TEMPLATE_SCRAPE_BUDGET_MS = Math.max(
  1000,
  Number(process.env.MIRROR_TEMPLATE_SCRAPE_BUDGET_MS) || 6000,
)

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
  scrapeBudgetMs = MIRROR_TEMPLATE_SCRAPE_BUDGET_MS,
  logger = null,
} = {}) {
  const sourceUrl = String(originalUrl || convertedUrl || '').trim()
  const displayUrl = String(convertedUrl || originalUrl || '').trim()
  if (!sourceUrl || !displayUrl) return null

  const offer = await withTimeout(
    buildOffer({
      url: sourceUrl,
      platform,
      credentialsMap,
      keepOriginalLink: false,
      convertLink: buildAlreadyConvertedConverter({ platform, originalUrl: sourceUrl, convertedUrl: displayUrl }),
      logger,
    }),
    scrapeBudgetMs,
    'Tempo limite do scrape do template de espelhamento excedido',
  )

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
  scrapeBudgetMs = MIRROR_TEMPLATE_SCRAPE_BUDGET_MS,
  logger = null,
} = {}) {
  const body = resolveMirrorTemplateBody(botConfig, templateKey)
  if (!body) return text
  let fields
  try {
    fields = await resolveMirrorOfferFromLink({ originalUrl, convertedUrl, platform, credentialsMap, buildOffer, scrapeBudgetMs, logger })
  } catch (err) {
    logger?.warn?.({ err: err?.message, originalUrl, convertedUrl, platform }, 'Template de espelhamento: falha ao buscar dados pelo link; mantendo texto original')
    return text
  }
  if (!fields?.link) return text
  // Decisão de produto 3.1: scrape sem título E sem preço = não temos o que
  // montar. Renderizar o template aqui produziria uma mensagem quase vazia
  // (só link + branding) e DESCARTARIA a caption original útil. Cai no relay.
  if (!String(fields.title || '').trim() && !String(fields.price || '').trim()) {
    logger?.warn?.({ originalUrl, convertedUrl, platform }, 'Template de espelhamento: scrape sem título/preço; mantendo texto original (relay)')
    return text
  }
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
