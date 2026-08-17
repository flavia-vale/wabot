// Aceita qualquer subdomínio antes do domínio registrável (produto., lista.,
// m., www. etc.). `(?:[a-z0-9-]+\.)*` exige um ponto separador, então não
// casa hosts coladas como `notmercadolivre.com.br`.
const PATTERNS = {
  mercadolivre: /https?:\/\/(?:[a-z0-9-]+\.)*(?:mercadolivre\.com\.br|mercadolivre\.com|mercadolibre\.com|meli\.la|mluvem\.com)[^\s]*/gi,
  amazon:       /https?:\/\/(?:[a-z0-9-]+\.)*(?:amazon\.com\.br|link\.amazon|amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzn\.divulguei\.app|amzlink\.to)[^\s]*/gi,
  shopee:       /https?:\/\/(?:[a-z0-9-]+\.)*(?:shope\.ee|shopee\.com\.br)[^\s]*/gi,
  magazineluiza:/https?:\/\/(?:[a-z0-9-]+\.)*(?:magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)[^\s]*/gi,
  // s.shein.com NÃO existe — não incluir (research.md D-012).
  shein:        /https?:\/\/(?:[a-z0-9-]+\.)*(?:shein\.com|onelink\.shein\.com|shein\.top)[^\s]*/gi,
}

export function detectLinks(text) {
  const found = []
  for (const [platform, regex] of Object.entries(PATTERNS)) {
    regex.lastIndex = 0
    const matches = text.match(regex)
    if (matches) {
      for (const url of matches) {
        found.push({ platform, url: url.replace(/[.,;!?)'">]+$/, '') })
      }
    }
  }
  return found
}

// Fonte única de verdade para "este URL é de um marketplace de oferta?".
// Usa exatamente os mesmos padrões de detectLinks para que o sanitizador
// (messageProcessor) nunca remova um link que o pipeline iria converter.
export function isOfferUrl(url) {
  const raw = String(url ?? '')
  for (const regex of Object.values(PATTERNS)) {
    regex.lastIndex = 0
    if (regex.test(raw)) return true
  }
  return false
}
