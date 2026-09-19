import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'
import { hasUsefulOfferInfo, withTimeout } from '../converters/offerEngine.js'
import { fetchProductInfo as defaultFetchProductInfo } from '../converters/productInfoScraper.js'
import { parseOfferPriceToCents } from './clientCouponPolicy.js'

// Teto de tempo do scrape do modo template. O espelhamento roda numa fila
// serial com MSG_QUEUE_TIMEOUT_MS=25s por mensagem; o scrape do template NÃO
// pode consumir esse orçamento todo, senão uma loja lenta trava a fila inteira.
// Ao estourar, applyMirrorTemplate cai no relay (texto original). Override via
// env MIRROR_TEMPLATE_SCRAPE_BUDGET_MS.
const MIRROR_TEMPLATE_SCRAPE_BUDGET_MS = Math.max(
  1000,
  Number(process.env.MIRROR_TEMPLATE_SCRAPE_BUDGET_MS) || 6000,
)

const UNRESOLVED_OFFER_PLACEHOLDER_RE = /\{(?:produto|preço|preço_de|desconto|rating|vendas|link|loja|linhaDeCupom|preçoDoTexto)\}/g
const PLATFORM_LABELS = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  magazineluiza: 'Magazine Luiza',
  shein: 'SHEIN',
  aliexpress: 'AliExpress',
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

function applyMirrorGlobalLinkVariables(body, botConfig = {}) {
  return String(body || '')
    .replace(/\{\{grupoLink\}\}/g, botConfig?.brandingGroupLink || '')
    .replace(/\{\{cupomLink\}\}/g, botConfig?.couponLink || '')
}

// Preserva a copy do cupom exatamente como chegou do grupo de origem. O
// marketplace não expõe essa frase no scrape do produto: ela pertence ao texto
// editorial da oferta (código, valor OFF e instrução de resgate). Escolhemos a
// linha mais característica quando "cupom" aparece mais de uma vez; por exemplo,
// "Por R$ 180 c/cupom" perde para "Use o cupom CLUBE...".
export function extractCouponLine(text = '') {
  const candidates = String(text || '')
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => /\b(?:cupom|cupons)\b/i.test(line) && !/^https?:\/\//i.test(line))
    .map(({ line, index }) => {
      let score = 1
      if (/🎟(?:️)?/.test(line)) score += 4
      if (/\b(?:use|usar|resgate|resgatar|aplique|aplicar|insira|digite|adicione|adicionar|selecione|selecionar|ative|ativar)\b/i.test(line)) score += 5
      if (/\b(?:cupom|cupons)\s*:/i.test(line)) score += 3
      if (/\b(?:cupom|cupons)\b[^\n]{0,30}\b[A-Z0-9]{5,}\b/.test(line)) score += 2
      if (/\b(?:cupom|cupons)\b[^\n]{0,40}\b\d{1,3}\s*%\s*off\b/i.test(line)) score += 3
      if (/\bc\s*\/\s*cupom\b/i.test(line)) score -= 3
      return { line, index, score }
    })

  candidates.sort((a, b) => b.score - a.score || a.index - b.index)
  const winner = candidates[0]
  return winner && winner.score >= 3 ? winner.line : ''
}

const TEXT_PRICE_DE_RE = /\bde\s*:?\s*(?:R\$\s*)?\d/i
const TEXT_PRICE_POR_RE = /\bpor\s*:?\s*(?:R\$\s*)?\d/i

// O valor final anunciado com cupom muitas vezes existe apenas na copy do
// grupo, não na página da loja. Capturamos o bloco "De/Por" anterior ao cupom:
// ele pode estar inteiro numa linha ou dividido em duas linhas consecutivas.
// Mantemos emojis, "no Pix", parcelas e demais texto editorial intactos.
export function extractTextPrice(text = '', couponLine = extractCouponLine(text)) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim())
  // String vazia não representa um cupom: sem esta guarda, findIndex casaria
  // com a primeira linha em branco da mensagem e encerraria a busca antes do
  // bloco de preço.
  const couponIndex = couponLine ? lines.findIndex(line => line === couponLine) : -1
  // Com cupom, o limite evita confundir valores de "R$ X OFF" da instrução
  // com o preço do produto. Sem cupom, percorremos a mensagem inteira: ofertas
  // também anunciam um "De/Por" editorial sem necessariamente trazer cupom.
  const searchEnd = couponIndex >= 0 ? couponIndex : lines.length

  for (let index = searchEnd - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!TEXT_PRICE_POR_RE.test(line)) continue
    if (TEXT_PRICE_DE_RE.test(line)) return line

    let previousIndex = index - 1
    while (previousIndex >= 0 && !lines[previousIndex]) previousIndex -= 1
    if (previousIndex >= 0 && TEXT_PRICE_DE_RE.test(lines[previousIndex])) {
      return `${lines[previousIndex]}\n${line}`
    }
    return line
  }

  return ''
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

  const mlCredentials = typeof credentialsMap?.__onCredentialPatch === 'function'
    ? (credentialsMap.mercadolivre ? { ...credentialsMap.mercadolivre, __onCredentialPatch: credentialsMap.__onCredentialPatch } : null)
    : (credentialsMap?.mercadolivre || null)

  const scrapeOpts = {
    mlCredentials,
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

// Retorno: { text, couponContext }. `couponContext` é `{ platform, priceCents }`
// quando o template foi de fato aplicado (dados já resolvidos nesta função,
// sem nenhuma leitura extra de rede/loja — FR-028c) ou `null` quando o
// template caiu no relay/texto original (nada para resolver).
//
// specs/017-client-coupon-catalog (Trava #1, D3 da pesquisa): o token
// `{cupom}` NÃO é mais substituído/removido aqui — ele sobrevive intacto no
// texto final e é resolvido só no momento do envio (processSendJob), para
// que FR-014 (cupom desligado depois de enfileirado não sai) valha mesmo
// numa mensagem que fica horas esperando na fila. `extractCouponLine` NÃO foi
// apagada: continua sendo o delimitador de `extractTextPrice`, que alimenta
// `{preçoDoTexto}` (FR-021).
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
  if (!body) return { text, couponContext: null }
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
    return { text, couponContext: null }
  }
  if (!fields?.link) return { text, couponContext: null }
  // Decisão de produto 3.1 + blindagem anti-lixo: uma oferta SEM TÍTULO é
  // inútil — e é exatamente a assinatura de um scrape envenenado (página
  // anti-bot do ML/Amazon: título genérico já filtrado para '' + preço de
  // outro produto). Renderizar produziria uma mensagem quebrada e descartaria
  // a caption original útil. Sem título confiável, cai no relay.
  if (!String(fields.title || '').trim()) {
    logger?.warn?.({ originalUrl, convertedUrl, platform }, 'Template de espelhamento: scrape sem título confiável; mantendo texto original (relay)')
    return { text, couponContext: null }
  }
  // A copy da origem só deve participar do caminho de template quando a
  // cliente pediu explicitamente a variável. Além de evitar trabalho em todos
  // os templates existentes, isso mantém a separação histórica: sem o token,
  // título/preço continuam vindo exclusivamente do scrape da oferta.
  const usesCouponCopy = body.includes('{linhaDeCupom}') || body.includes('{preçoDoTexto}')
  const couponLine = usesCouponCopy ? extractCouponLine(text) : ''
  const usesTextPrice = body.includes('{preçoDoTexto}')
  // `{preçoDoTexto}` nunca pode abrir um buraco no template: a copy editorial
  // tem prioridade quando foi encontrada; caso contrário, usa o preço atual
  // confiável que o scraper da loja já colocou em `{preço}`.
  const textPrice = usesTextPrice
    ? (extractTextPrice(text, couponLine) || fields.price || '')
    : ''
  const rendered = buildMobileOfferText({
    product: { ...fields, couponLine, textPrice },
    link: fields.link,
    template: templateKey,
    templateBody: applyMirrorGlobalLinkVariables(body, botConfig),
    preserveAutomationPlaceholders: false,
  })
  const renderedText = stripUnresolvedPlaceholders(rendered) || text
  // priceCents vem do MESMO preço já raspado que alimenta {preço} — nenhuma
  // leitura nova de rede/loja (FR-028c). `platform` é o que o conversor já
  // resolveu (parâmetro desta função).
  const couponContext = { platform: platform || null, priceCents: parseOfferPriceToCents(fields.price) }
  return { text: renderedText, couponContext }
}
