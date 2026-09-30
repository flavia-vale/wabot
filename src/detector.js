// Domínios canônicos da SHEIN — fonte única, reusada tanto para montar o
// regex de extração abaixo quanto para validar um host isolado de forma
// ANCORADA (`isSheinHostname`, usada por src/converters/shein.js após
// resolver redirect). Os outros PATTERNS abaixo não têm essa segunda função
// hoje — se algum conversor futuro precisar validar host pós-redirect de
// outra loja, replique este padrão (lista de domínios + `isHostInDomainList`)
// em vez de reusar o regex de extração de texto como validador (T070: era
// exatamente esse reuso que deixava `shein.com.evil.net` passar, porque o
// regex de extração termina em `[^\s]*` de propósito — ele existe para
// capturar o link INTEIRO em texto corrido, não para dizer onde o host
// termina).
const SHEIN_DOMAINS = ['shein.com', 'onelink.shein.com', 'shein.top']
const ALIEXPRESS_DOMAINS = ['aliexpress.com', 'aliexpress.us']

// Verdadeiro se `hostname` for exatamente um dos domínios de `domains`, ou um
// subdomínio dele com separador de ponto (`br.shein.com` sim,
// `shein.com.evil.net`/`shein.company.io` não). Reutilizável por qualquer
// conversor que precise validar host pós-redirect.
export function isHostInDomainList(hostname, domains) {
  const host = String(hostname || '').toLowerCase()
  return domains.some((d) => host === d || host.endsWith('.' + d))
}

export function isSheinHostname(hostname) {
  return isHostInDomainList(hostname, SHEIN_DOMAINS)
}

const SHEIN_DOMAIN_ALT = SHEIN_DOMAINS.map((d) => d.replace(/\./g, '\\.')).join('|')
const ALIEXPRESS_DOMAIN_ALT = ALIEXPRESS_DOMAINS.map((d) => d.replace(/\./g, '\\.')).join('|')

// Aceita qualquer subdomínio antes do domínio registrável (produto., lista.,
// m., www. etc.). `(?:[a-z0-9-]+\.)*` exige um ponto separador, então não
// casa hosts coladas como `notmercadolivre.com.br`.
// Exportado (além de usado internamente) para que conversores possam validar
// se um host resolvido pertence de fato à loja — fonte única, sem duplicar a
// lista de domínios (ex.: src/converters/shein.js, guarda de host pós-redirect).
export const PATTERNS = {
  mercadolivre: /https?:\/\/(?:[a-z0-9-]+\.)*(?:mercadolivre\.com\.br|mercadolivre\.com|mercadolibre\.com|meli\.la|mluvem\.com)[^\s]*/gi,
  amazon:       /https?:\/\/(?:[a-z0-9-]+\.)*(?:amazon\.com\.br|link\.amazon|amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzn\.divulguei\.app|amzlink\.to)[^\s]*/gi,
  shopee:       /https?:\/\/(?:[a-z0-9-]+\.)*(?:shope\.ee|shopee\.com\.br)[^\s]*/gi,
  magazineluiza:/https?:\/\/(?:[a-z0-9-]+\.)*(?:magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)[^\s]*/gi,
  // s.shein.com NÃO existe — não incluir (research.md D-012).
  // T070: ao contrário das lojas acima, a entrada da SHEIN exige um
  // delimitador (`/`, `?`, `#`, espaço ou fim de string) logo após o domínio
  // registrável — sem isso, `[^\s]*` sozinho deixava o extrator (e quem o
  // reusasse como validador de host) casar `shein.com.attacker.net` como se
  // fosse SHEIN. As outras entradas não mudam (Mercado Livre é referência de
  // qualidade e não pode mudar — FR-023).
  shein: new RegExp(
    String.raw`https?://(?:[a-z0-9-]+\.)*(?:${SHEIN_DOMAIN_ALT})(?=[/?#:]|\s|$)[^\s]*`,
    'gi',
  ),
  aliexpress: new RegExp(
    String.raw`https?://(?:[a-z0-9-]+\.)*(?:${ALIEXPRESS_DOMAIN_ALT})(?=[/?#:]|\s|$)[^\s]*`,
    'gi',
  ),
}

const TRAILING_URL_PUNCTUATION_RE = /[.,;!?)'">]+$/
const WHATSAPP_FORMAT_MARKERS = new Set(['*', '_', '~', '`'])

// O WhatsApp usa caracteres colados ao texto para formatar mensagens, por
// exemplo `*https://meli.la/abc*`. Os padrões de marketplace capturam até o
// próximo espaço, então o marcador de fechamento também entra no match. Só o
// removemos quando existe o MESMO marcador imediatamente antes da URL: assim
// um `_`/`~` que pertença de verdade ao caminho continua intacto.
export function normalizeDetectedUrl(rawUrl, textBeforeUrl = '') {
  let url = String(rawUrl || '').replace(TRAILING_URL_PUNCTUATION_RE, '')
  const openingMarkers = String(textBeforeUrl || '').match(/[*_~`]+$/)?.[0] || ''

  while (url && WHATSAPP_FORMAT_MARKERS.has(url.at(-1)) && openingMarkers.includes(url.at(-1))) {
    url = url.slice(0, -1)
  }

  return url.replace(TRAILING_URL_PUNCTUATION_RE, '')
}

const ANY_URL_RE = /https?:\/\/[^\s]+/gi

function isStaticOfferUrl(url) {
  for (const regex of Object.values(PATTERNS)) {
    regex.lastIndex = 0
    if (regex.test(url)) return true
  }
  return false
}

// Redes de afiliados por cliente, em ORDEM FIXA de prioridade (decisão da
// dona do produto, 2026-09-30): a mesma loja aprovada em mais de uma rede sai
// pela primeira da lista que a reconhece. Rede desligada no grupo, sem conta
// ou sem aprovação na loja não entra nas opções → a próxima assume.
// Lomadee entra aqui quando tiver conversão.
export const AFFILIATE_NETWORK_PRIORITY = Object.freeze([
  ['awin', 'isAwinLink'],
  ['rakuten', 'isRakutenLink'],
])

/** Primeira rede (na ordem acima) que reconhece o link, ou null. */
export function networkForUrl(url, offerOptions = {}) {
  for (const [network, method] of AFFILIATE_NETWORK_PRIORITY) {
    const matcher = offerOptions?.[network]
    if (matcher && typeof matcher[method] === 'function' && matcher[method](url)) return network
  }
  return null
}

function hasNetworkOptions(offerOptions) {
  return AFFILIATE_NETWORK_PRIORITY.some(([network, method]) => typeof offerOptions?.[network]?.[method] === 'function')
}

// `offerOptions` (opcional): `{ awin, rakuten }` = lojas de cada rede em que a
// CLIENTE foi aprovada (src/integrations/<rede>/storeMatcher.js). Sem elas,
// nada muda: a lista de lojas é só a fixa acima. As lojas fixas sempre
// ganham — um link da Shopee nunca vira "awin"/"rakuten", mesmo se a Shopee
// aparecer um dia no programa da cliente.
export function detectLinks(text, offerOptions = {}) {
  const found = []
  for (const [platform, regex] of Object.entries(PATTERNS)) {
    regex.lastIndex = 0
    for (const match of String(text || '').matchAll(regex)) {
      const url = normalizeDetectedUrl(match[0], String(text || '').slice(0, match.index))
      if (url) found.push({ platform, url })
    }
  }
  if (hasNetworkOptions(offerOptions)) {
    ANY_URL_RE.lastIndex = 0
    for (const match of String(text || '').matchAll(ANY_URL_RE)) {
      const url = normalizeDetectedUrl(match[0], String(text || '').slice(0, match.index))
      if (!url || isStaticOfferUrl(url)) continue
      const network = networkForUrl(url, offerOptions)
      if (network) found.push({ platform: network, url })
    }
  }
  return found
}

// Fonte única de verdade para "este URL é de um marketplace de oferta?".
// Usa exatamente os mesmos padrões de detectLinks para que o sanitizador
// (messageProcessor) nunca remova um link que o pipeline iria converter.
export function isOfferUrl(url, offerOptions = {}) {
  const raw = String(url ?? '')
  if (isStaticOfferUrl(raw)) return true
  return Boolean(networkForUrl(raw, offerOptions))
}
