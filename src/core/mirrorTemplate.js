import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'
import { hasUsefulOfferInfo, withTimeout } from '../converters/offerEngine.js'
import { fetchProductInfo as defaultFetchProductInfo } from '../converters/productInfoScraper.js'

// Teto de tempo do scrape do modo template. O espelhamento roda numa fila
// serial com MSG_QUEUE_TIMEOUT_MS=25s por mensagem; o scrape do template NÃO
// pode consumir esse orçamento todo, senão uma loja lenta trava a fila inteira.
// Ao estourar, applyMirrorTemplate cai no relay (texto original). Override via
// env MIRROR_TEMPLATE_SCRAPE_BUDGET_MS.
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

// Lê título/preço do PRODUTO espelhado e devolve os campos para o template.
//
// Caminho (igual ao "Gerar oferta", que comprovadamente acerta): o scraper
// `fetchProductInfo` recebe o link do produto e devolve título/preço — ele já
// resolve short link (meli.la/social, Shopee), aplica cookie do ML e contorna
// anti-bot. Aqui NÃO reconvertemos (o worker já converteu): o link de afiliado
// emitido na oferta é sempre `convertedUrl`.
//
// IMPORTANTE — qual link raspar: preferimos o link ORIGINAL do upstream. O link
// CONVERTIDO de afiliado do ML costuma ser um `/sec/` de vitrine que cai no
// anti-bot (`og:title` = "Mercado Libre", preço de outro produto) e
// contaminaria a oferta. Raspar a página de produto original é o alvo confiável;
// como o convertido é derivado do original, é o MESMO produto. O `{link}` da
// oferta continua sendo o convertido (afiliado) — nunca o finalUrl canônico do
// scraper, para não vazar comissão.
export async function resolveMirrorOfferFromLink({
  originalUrl = '',
  convertedUrl = '',
  platform = null,
  credentialsMap = {},
  fetchInfo = defaultFetchProductInfo,
  logger = null,
} = {}) {
  const original = String(originalUrl || '').trim()
  // Link EMITIDO na oferta = estritamente o convertido (afiliado do NOSSO
  // cliente) já aprovado pelo worker. NUNCA cai para o link original do
  // upstream (que é de outro afiliado) — isso vazaria a comissão para um
  // terceiro. Sem link convertido, não há oferta válida: o chamador faz relay.
  const converted = String(convertedUrl || '').trim()
  if (!converted) return null

  const scrapeOpts = {
    mlCredentials: credentialsMap?.mercadolivre || null,
    shopeeCredentials: credentialsMap?.shopee || null,
  }

  // Alvos de scrape, na ordem de confiabilidade: original primeiro, convertido
  // só como último recurso (e apenas se diferente).
  const candidates = []
  if (original) candidates.push(original)
  if (converted && converted !== original) candidates.push(converted)

  let info = null
  for (const candidate of candidates) {
    let scraped = null
    try {
      scraped = await fetchInfo(candidate, scrapeOpts)
    } catch (err) {
      logger?.warn?.({ err: err?.message, candidate, platform }, 'Template de espelhamento: scrape do candidato falhou')
      scraped = null
    }
    if (hasUsefulOfferInfo(scraped)) { info = scraped; break }
    if (!info && scraped) info = scraped
  }

  return {
    title: info?.title || '',
    oldPrice: info?.oldPrice || '',
    price: info?.newPrice || '',
    link: converted,
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
  fetchInfo = defaultFetchProductInfo,
  scrapeBudgetMs = MIRROR_TEMPLATE_SCRAPE_BUDGET_MS,
  logger = null,
} = {}) {
  const body = resolveMirrorTemplateBody(botConfig, templateKey)
  if (!body) return text
  let fields
  try {
    // Orçamento de tempo único cobrindo TODO o scrape (todos os candidatos).
    // Ao estourar, lança e cai no relay abaixo.
    fields = await withTimeout(
      resolveMirrorOfferFromLink({ originalUrl, convertedUrl, platform, credentialsMap, fetchInfo, logger }),
      scrapeBudgetMs,
      'Tempo limite do scrape do template de espelhamento excedido',
    )
  } catch (err) {
    logger?.warn?.({ err: err?.message, originalUrl, convertedUrl, platform }, 'Template de espelhamento: falha ao buscar dados pelo link; mantendo texto original')
    return text
  }
  if (!fields?.link) return text
  // Decisão de produto 3.1 + blindagem anti-lixo: uma oferta SEM TÍTULO é
  // inútil — e é exatamente a assinatura de um scrape envenenado (página
  // anti-bot do ML/Amazon: título genérico já filtrado para '' + preço de
  // outro produto). Renderizar produziria uma mensagem quebrada e descartaria
  // a caption original útil. Sem título confiável, cai no relay.
  if (!String(fields.title || '').trim()) {
    logger?.warn?.({ originalUrl, convertedUrl, platform }, 'Template de espelhamento: scrape sem título confiável; mantendo texto original (relay)')
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
