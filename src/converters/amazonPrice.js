// Preço da Amazon: qual número é o que a cliente vê na loja (RCA 2026-09-16).
//
// A oferta espelhada saía com preço DIFERENTE do que está na Amazon. Medido em
// marcação real da loja, quatro caminhos produziam número errado:
//
// 1. O preço de TABELA (riscado, "De: R$ 299,00") aparece antes do preço a
//    pagar dentro do mesmo bloco — o extrator antigo pegava o primeiro
//    `a-offscreen` depois da âncora e publicava o preço MAIOR.
// 2. Preço de OUTRO VENDEDOR / usado (`usedbuyBox`, "Outras ofertas") era
//    publicado quando o buy box estava indisponível — preço MENOR que o real.
// 3. A Amazon hoje quebra o `a-price-whole` com um `<span a-price-decimal>`
//    aninhado; o regex antigo exigia só dígitos e ponto, então não casava e a
//    oferta ficava sem preço (caindo em fallbacks genéricos piores).
// 4. Parcela ("em até 10x de R$ 129,90") é um `a-price` como qualquer outro.
//
// A regra aqui é uma só: publicar o preço A PAGAR do buy box. Na dúvida,
// devolver vazio — oferta sem preço é recuperável, oferta com preço errado
// vira reclamação de cliente.

// Ordem das alternativas importa: em JS a regex tenta a primeira que casa na
// posição, então o formato com milhar precisa vir antes de `\d+,\d{2}`, que
// precisa vir antes de `\d+`. Invertido, "1.299,90" sairia como "1".
const PRICE_NUMBER_RE = /([0-9]{1,3}(?:\.[0-9]{3})+,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+(?:\.[0-9]{3})+|[0-9]+)/

// Contêineres que a Amazon usa para preço que NÃO é o do buy box: usado,
// "outras ofertas", vendedores terceiros e blocos de recomendação. Um preço
// que aparece depois do primeiro marcador desses não representa a compra.
const OTHER_OFFERS_MARKER_RE = /id=["'](?:usedbuyBox|olp[-_][^"']*|aod-[^"']*|mbc)["']|class=["'][^"']*(?:olp-link|aod-offer|sims-fbt|similarities-widget|comparison_table)[^"']*["']/i

// Blocos onde o preço a pagar mora. Restringir a busca a eles evita colher
// preço de acessório, de "compre junto" ou de produto recomendado.
const CORE_PRICE_CONTAINER_RE = /id=["'](?:corePriceDisplay_desktop_feature_div|corePriceDisplay_mobile_feature_div|corePrice_feature_div|corePrice_desktop|apex_desktop|apex_mobile)["']/i

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '')
}

function parseAmount(raw) {
  const text = stripTags(raw).replace(/&nbsp;|&#160;/gi, ' ')
  const match = text.match(PRICE_NUMBER_RE)
  return match?.[1] ? match[1] : ''
}

// Converte "1.299,90" / "199,90" em número para poder comparar preços (o "de"
// tem que ser maior que o "por"; senão não é preço de tabela, é outra coisa).
export function amountToNumber(price) {
  const cleaned = String(price || '').trim()
  if (!cleaned) return null
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const num = Number(normalized)
  return Number.isFinite(num) && num > 0 ? num : null
}

// Varre todos os `<span class="... a-price ...">` do HTML devolvendo, para cada
// um, o valor, a posição no documento e se ele é riscado (preço de tabela) ou
// marcado como o preço a pagar.
function classTokens(attrs) {
  const match = String(attrs || '').match(/\bclass=["']([^"']*)["']/i)
  return match?.[1] ? match[1].trim().split(/\s+/) : []
}

// `a-price` precisa ser a classe INTEIRA: `a-price-whole`, `a-price-symbol` e
// `a-price-fraction` são pedaços do mesmo preço, não preços separados.
function isPriceSpan(attrs) {
  return classTokens(attrs).includes('a-price')
}

function collectPriceSpans(html) {
  const spans = []
  const re = /<span([^>]*\ba-price\b[^>]*)>/gi
  for (const match of html.matchAll(re)) {
    const attrs = match[1] || ''
    if (!isPriceSpan(attrs)) continue
    const start = (match.index ?? 0) + match[0].length
    // Janela a partir da abertura da tag, cortada na PRÓXIMA abertura de
    // `a-price`: sem o corte, um preço riscado sem `a-offscreen` próprio
    // roubaria o valor do span seguinte.
    let window = html.slice(start, start + 400)
    for (const nested of window.matchAll(/<span([^>]*\ba-price\b[^>]*)>/gi)) {
      if (isPriceSpan(nested[1] || '')) { window = window.slice(0, nested.index ?? 0); break }
    }
    const offscreen = window.match(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const value = parseAmount(offscreen?.[1] ?? window)
    if (!value) continue
    const tokens = classTokens(attrs)
    const payable = tokens.includes('priceToPay') || tokens.includes('apexPriceToPay')
    // `data-a-strike` é o único marcador inequívoco de preço de tabela.
    // `a-text-price` sozinho também costuma marcar o riscado, mas a Amazon
    // combina as duas classes com `apexPriceToPay` em alguns layouts — nesses
    // o preço a pagar manda, senão a oferta sai sem preço nenhum.
    const strike = /data-a-strike=["']true["']/i.test(attrs)
      || (tokens.includes('a-text-price') && !payable)
    spans.push({ value, index: match.index ?? 0, strike, payable })
  }
  return spans
}

// Fallback para quando não há `a-offscreen`: a Amazon monta o preço visível em
// `a-price-whole` + `a-price-fraction`. O `whole` hoje carrega um span de
// vírgula aninhado, por isso o conteúdo é limpo com stripTags em vez de exigir
// só dígitos.
function extractFromWholeAndFraction(html) {
  const whole = html.match(/<span[^>]+class=["'][^"']*a-price-whole[^"']*["'][^>]*>([\s\S]{0,120}?)<\/span>\s*(?:<\/span>)?/i)
  const fraction = html.match(/<span[^>]+class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*([0-9]{2})\s*<\/span>/i)
  if (!whole?.[1] || !fraction?.[1]) return ''
  const wholeDigits = stripTags(whole[1]).replace(/[^0-9.]/g, '').replace(/\.$/, '')
  if (!wholeDigits) return ''
  return `${wholeDigits},${fraction[1]}`
}

/**
 * Devolve o preço a pagar (`newPrice`) e o preço de tabela (`oldPrice`) do buy
 * box da Amazon. Vazio quando não dá para afirmar qual é — nunca chuta.
 */
export function extractAmazonBuyBoxPrice(html) {
  const empty = { newPrice: '', oldPrice: '' }
  if (!html) return empty

  const otherOffersAt = html.search(OTHER_OFFERS_MARKER_RE)
  const coreAt = html.search(CORE_PRICE_CONTAINER_RE)
  // Preço depois do primeiro marcador de "outras ofertas" não é do buy box.
  // Quando o bloco de preço principal vem DEPOIS desse marcador (o marcador
  // casou num trecho anterior irrelevante), o corte não se aplica.
  const cutAt = otherOffersAt >= 0 && (coreAt < 0 || coreAt < otherOffersAt) ? otherOffersAt : Infinity

  const spans = collectPriceSpans(html).filter((span) => span.index < cutAt)

  const payable = spans.find((span) => span.payable && !span.strike)
  const inCore = coreAt >= 0 ? spans.filter((span) => span.index >= coreAt) : []
  const newPrice = payable?.value
    || inCore.find((span) => !span.strike)?.value
    || spans.find((span) => !span.strike)?.value
    || (cutAt === Infinity ? extractFromWholeAndFraction(html) : extractFromWholeAndFraction(html.slice(0, cutAt)))
    || ''

  if (!newPrice) return empty

  const newNumber = amountToNumber(newPrice)
  const oldCandidate = spans.find((span) => {
    if (!span.strike) return false
    const value = amountToNumber(span.value)
    return value != null && newNumber != null && value > newNumber
  })

  return { newPrice, oldPrice: oldCandidate?.value || '' }
}
